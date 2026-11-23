import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';
import { AuthError } from '../../auth/types/errors.js';
import { readAsSubject } from '../../auth/repositories/lifecycle.js';
import type { NutritionDocument, NutritionVersion } from '../types/nutrition.js';

export const conflict = (message = 'El plan nutricional cambió. Actualiza antes de guardar.'): never => {
  throw new AuthError(409, 'NUTRITION_CONFLICT', message);
};
export const missing = (): never => {
  throw new AuthError(404, 'NUTRITION_NOT_FOUND', 'El plan nutricional no está disponible.');
};
export const forbidden = (): never => {
  throw new AuthError(403, 'NUTRITION_READ_ONLY', 'No tienes permiso para modificar este plan.');
};

// Prescribing without a physical evaluation would mean guessing weight/composition.
export async function requireEvaluation(c: PoolClient, clientId: string): Promise<void> {
  const { rowCount } = await c.query('SELECT 1 FROM private.client_evaluations WHERE client_id=$1 LIMIT 1', [clientId]);
  if (!rowCount)
    throw new AuthError(
      409,
      'NUTRITION_EVALUATION_REQUIRED',
      'Registra una evaluación física del cliente antes de prescribir su alimentación.',
    );
}

export interface Scope {
  clientId: string;
  timeZone: string;
  canWrite: boolean;
  birthDate?: string | null;
}

export async function scope(
  c: PoolClient,
  identity: SessionIdentity,
  clientId: string | null,
  write = false,
): Promise<Scope> {
  if (identity.role === 'professional') {
    const {
      rows: [allowed],
    } = await c.query('SELECT private.nutrition_professional($1) AS allowed', [identity.id]);
    if (!allowed?.allowed) throw forbidden();
    if (!clientId) throw missing();
    const {
      rows: [client],
    } = await c.query(
      `SELECT c.id, c.time_zone, c.status, c.birth_date::text AS birth_date FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=$1 AND p.user_id=$2 ${write ? 'FOR UPDATE OF c' : ''}`,
      [clientId, identity.id],
    );
    if (!client) throw missing();
    if (write && client.status !== 'active') throw forbidden();
    return {
      clientId: client.id,
      timeZone: client.time_zone ?? 'America/Mexico_City',
      canWrite: client.status === 'active',
      birthDate: client.birth_date ?? null,
    };
  }

  if (identity.role === 'client') {
    const {
      rows: [client],
    } = await c.query(
      `SELECT c.id, c.time_zone, private.nutrition_client_access(c.id, true) AS writable FROM private.clients c WHERE c.user_id=$1`,
      [identity.id],
    );
    if (!client || (clientId && client.id !== clientId)) throw missing();
    if (write && !client.writable) throw forbidden();
    return { clientId: client.id, timeZone: client.time_zone ?? 'America/Mexico_City', canWrite: client.writable };
  }

  throw forbidden();
}

export const read = <T>(pool: Pool, identity: SessionIdentity, work: (c: PoolClient) => Promise<T>) =>
  readAsSubject(pool, identity.id, work);

const projection = `SELECT v.*, p.client_id FROM private.nutrition_versions v JOIN private.nutrition_plans p ON p.id=v.plan_id`;

/** Backfill newly added optional fields to null for previously stored JSONB documents. */
function normalizeDocument(document: NutritionDocument): NutritionDocument {
  return {
    ...document,
    generalInstructions: document.generalInstructions ?? null,
    fiberTargetG: document.fiberTargetG ?? null,
    hydrationTargetMl: document.hydrationTargetMl ?? null,
    restDayTargets: document.restDayTargets ?? null,
    periWorkout: document.periWorkout ?? null,
    suggestionMeta: document.suggestionMeta ?? null,
    meals: document.meals.map((meal) => ({
      ...meal,
      instructions: meal.instructions ?? null,
      scheduleTime: meal.scheduleTime ?? null,
      category: meal.category ?? null,
      targetCalories: meal.targetCalories ?? null,
      targetProteinG: meal.targetProteinG ?? null,
      targetCarbsG: meal.targetCarbsG ?? null,
      targetFatG: meal.targetFatG ?? null,
      items: meal.items.map((item) => ({
        ...item,
        instructions: item.instructions ?? null,
        kind: item.kind ?? 'food',
        recipeIngredients: item.recipeIngredients ?? null,
        foodGroup: item.foodGroup ?? null,
        substitutes: item.substitutes ?? null,
        calories: item.calories ?? null,
        proteinG: item.proteinG ?? null,
        carbsG: item.carbsG ?? null,
        fatG: item.fatG ?? null,
      })),
    })),
  };
}

function mapVersion(row: {
  document: NutritionDocument;
  id: string;
  plan_id: string;
  client_id: string | null;
  number: number;
  revision: number;
  published: boolean;
  created_at: Date;
}): NutritionVersion {
  return {
    ...normalizeDocument(row.document),
    id: row.id,
    planId: row.plan_id,
    clientId: row.client_id,
    number: row.number,
    revision: row.revision,
    published: row.published,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function version(c: PoolClient, id: string): Promise<NutritionVersion> {
  const {
    rows: [row],
  } = await c.query(`${projection} WHERE v.id=$1`, [id]);
  return row ? mapVersion(row) : missing();
}

export async function versions(c: PoolClient, identity: SessionIdentity, clientId: string) {
  const { rows } = await c.query(
    `${projection} WHERE p.owner_id=$1 AND p.client_id=$2::uuid ORDER BY v.created_at DESC, v.number DESC`,
    [identity.id, clientId],
  );
  return rows.map(mapVersion);
}

export async function ownedPlan(c: PoolClient, identity: SessionIdentity, planId: string, clientId: string) {
  const {
    rows: [row],
  } = await c.query('SELECT id FROM private.nutrition_plans WHERE id=$1 AND owner_id=$2 AND client_id=$3::uuid', [
    planId,
    identity.id,
    clientId,
  ]);
  if (!row) throw missing();
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [planId]);
}

export async function getOrCreatePlanId(
  c: PoolClient,
  identity: SessionIdentity,
  clientId: string,
  preferredPlanId?: string,
): Promise<string> {
  const {
    rows: [row],
  } = await c.query('SELECT id FROM private.nutrition_plans WHERE owner_id=$1 AND client_id=$2::uuid', [
    identity.id,
    clientId,
  ]);
  if (row) return row.id;
  const newId = preferredPlanId ?? randomUUID();
  await c.query('INSERT INTO private.nutrition_plans(id, owner_id, client_id) VALUES($1, $2, $3)', [
    newId,
    identity.id,
    clientId,
  ]);
  return newId;
}

export async function storeVersion(
  c: PoolClient,
  planId: string,
  id: string,
  document: NutritionDocument,
  revision?: number,
): Promise<NutritionVersion> {
  if (revision !== undefined) {
    const { rowCount } = await c.query(
      'UPDATE private.nutrition_versions SET document=$3, revision=revision+1 WHERE id=$1 AND plan_id=$2 AND revision=$4 AND NOT published',
      [id, planId, JSON.stringify(document), revision],
    );
    if (!rowCount) throw conflict();
    await c.query('DELETE FROM private.nutrition_items WHERE version_id=$1', [id]);
    await c.query('DELETE FROM private.nutrition_meals WHERE version_id=$1', [id]);
  } else {
    if ((await c.query('SELECT 1 FROM private.nutrition_versions WHERE plan_id=$1 AND NOT published', [planId])).rowCount) {
      throw conflict('Ya existe un borrador. Continúa editándolo.');
    }
    await c.query(
      'INSERT INTO private.nutrition_versions(id, plan_id, number, document) SELECT $1, $2, COALESCE(max(number), 0)+1, $3 FROM private.nutrition_versions WHERE plan_id=$2',
      [id, planId, JSON.stringify(document)],
    );
  }

  for (const [i, meal] of document.meals.entries()) {
    await c.query(
      'INSERT INTO private.nutrition_meals(version_id, id, ordinal, name, instructions) VALUES($1, $2, $3, $4, $5)',
      [id, meal.id, i, meal.name, meal.instructions],
    );
    for (const [j, item] of meal.items.entries()) {
      await c.query(
        'INSERT INTO private.nutrition_items(version_id, meal_id, id, ordinal, name, quantity, unit, instructions) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, meal.id, item.id, j, item.name, item.quantity, item.unit, item.instructions],
      );
    }
  }

  return version(c, id);
}

export async function active(c: PoolClient, clientId: string) {
  const {
    rows: [row],
  } = await c.query('SELECT version_id, revision FROM private.nutrition_active WHERE client_id=$1', [clientId]);
  return row
    ? { versionId: row.version_id as string, revision: row.revision as number }
    : { versionId: null, revision: 0 };
}

export async function activate(
  c: PoolClient,
  identity: SessionIdentity,
  clientId: string,
  v: NutritionVersion,
  expectedActive: number | undefined,
  now: Date,
  localDate: string,
  timeZone: string,
) {
  const previous = await active(c, clientId);
  if (expectedActive !== undefined && expectedActive > 0 && previous.revision !== expectedActive) {
    throw conflict('El plan nutricional activo cambió en otro dispositivo.');
  }
  if (!v.published) {
    await c.query('UPDATE private.nutrition_versions SET published=true, revision=revision+1 WHERE id=$1 AND revision=$2', [
      v.id,
      v.revision,
    ]);
  }
  const nextRevision = previous.revision + 1;
  await c.query(
    'INSERT INTO private.nutrition_active(client_id, plan_id, version_id, revision) VALUES($1, $2, $3, $4) ON CONFLICT(client_id) DO UPDATE SET plan_id=excluded.plan_id, version_id=excluded.version_id, revision=excluded.revision',
    [clientId, v.planId, v.id, nextRevision],
  );
  await c.query(
    'INSERT INTO private.nutrition_activations(client_id, plan_id, version_id, activated_at, local_date, time_zone, revision) VALUES($1, $2, $3, $4, $5::date, $6, $7)',
    [clientId, v.planId, v.id, now, localDate, timeZone, nextRevision],
  );
  return { version: await version(c, v.id), activeRevision: nextRevision };
}

export async function activeClientPlan(c: PoolClient, clientId: string): Promise<NutritionVersion | null> {
  const {
    rows: [row],
  } = await c.query(
    `${projection} JOIN private.nutrition_active a ON a.version_id=v.id WHERE a.client_id=$1 AND v.published`,
    [clientId],
  );
  return row ? mapVersion(row) : null;
}

export async function activeProfessionalPlan(
  c: PoolClient,
  identity: SessionIdentity,
  clientId: string,
): Promise<{ plan: NutritionVersion | null; activeRevision: number }> {
  const {
    rows: [row],
  } = await c.query(
    `${projection} JOIN private.nutrition_active a ON a.version_id=v.id WHERE p.owner_id=$1 AND a.client_id=$2::uuid AND v.published`,
    [identity.id, clientId],
  );
  if (!row) return { plan: null, activeRevision: 0 };
  const currentActive = await active(c, clientId);
  return { plan: mapVersion(row), activeRevision: currentActive.revision };
}

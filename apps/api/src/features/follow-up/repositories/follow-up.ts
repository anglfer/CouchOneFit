import type { PoolClient } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';
import { AuthError } from '../../auth/types/errors.js';
import { skinfoldResults } from '../../evaluations/domain/body-fat-estimation.js';
import type { CheckIn, CheckInValues, SharedMeasurement, Visibility } from '../types/follow-up.js';

export const conflict = (message = 'El check-in cambió en otro dispositivo. Actualiza antes de guardar.'): never => {
  throw new AuthError(409, 'CHECK_IN_CONFLICT', message);
};
export const missing = (): never => {
  throw new AuthError(404, 'FOLLOW_UP_NOT_FOUND', 'El seguimiento no está disponible.');
};
export const readOnly = (): never => {
  throw new AuthError(403, 'CHECK_IN_READ_ONLY', 'Puedes consultar tu información, pero el registro está pausado por ahora.');
};
export const denied = (): never => {
  throw new AuthError(403, 'VISIBILITY_DENIED', 'Tu profesional no ha compartido esta información.');
};

export interface Scope {
  clientId: string;
  timeZone: string;
  canWrite: boolean;
}

/** Ownership first: a professional only reaches its own portfolio, a client only itself. */
export async function scope(c: PoolClient, identity: SessionIdentity, clientId: string | null, write = false): Promise<Scope> {
  if (identity.role === 'professional' && clientId) {
    const { rows: [allowed] } = await c.query('SELECT private.training_professional($1) AS allowed', [identity.id]);
    if (!allowed.allowed) throw new AuthError(403, 'FOLLOW_UP_UNAVAILABLE', 'Se requiere una suscripción vigente para consultar el seguimiento.');
    const { rows: [client] } = await c.query(
      `SELECT c.id,c.time_zone,c.status FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=$1 AND p.user_id=$2 ${write ? 'FOR UPDATE OF c' : ''}`,
      [clientId, identity.id],
    );
    if (!client) return missing();
    return { clientId: client.id, timeZone: client.time_zone, canWrite: client.status === 'active' };
  }
  if (identity.role !== 'client' || clientId) return missing();
  // Serializes saves of the same client so the unique date/revision checks never race.
  if (write) await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`check-in:${identity.id}`]);
  const { rows: [client] } = await c.query(
    'SELECT c.id,c.time_zone,private.training_client_access(c.id,true) AS writable FROM private.clients c WHERE c.user_id=$1',
    [identity.id],
  );
  if (!client) return missing();
  if (write && !client.writable) return readOnly();
  return { clientId: client.id, timeZone: client.time_zone, canWrite: client.writable };
}

const columns = `id,local_date::text AS local_date,time_zone,revision,body_weight_kg,sleep_hours,stress,energy,hunger,nutrition_compliance,nutrition_version_id,comment,created_at,updated_at`;
const decimal = (value: string | null) => (value === null ? null : Number(value));
const oneDecimal = (value: number | undefined) =>
  value === undefined ? null : Math.round(value * 10) / 10;
function map(row: Record<string, any>): CheckIn {
  return {
    id: row.id,
    localDate: row.local_date,
    timeZone: row.time_zone,
    revision: row.revision,
    bodyWeightKg: decimal(row.body_weight_kg),
    sleepHours: decimal(row.sleep_hours),
    stress: row.stress,
    energy: row.energy,
    hunger: row.hunger,
    nutritionCompliance: row.nutrition_compliance,
    nutritionVersionId: row.nutrition_version_id,
    comment: row.comment,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function between(c: PoolClient, clientId: string, from: string, to: string): Promise<CheckIn[]> {
  const { rows } = await c.query(
    `SELECT ${columns} FROM private.check_ins WHERE client_id=$1 AND local_date BETWEEN $2::date AND $3::date ORDER BY local_date DESC`,
    [clientId, from, to],
  );
  return rows.map(map);
}

export async function page(c: PoolClient, clientId: string, offset: number) {
  const { rows } = await c.query(`SELECT ${columns} FROM private.check_ins WHERE client_id=$1 ORDER BY local_date DESC LIMIT 61 OFFSET $2`, [clientId, offset]);
  return { checkIns: rows.slice(0, 60).map(map), nextOffset: rows.length > 60 ? offset + 60 : null };
}

export async function latestWeights(c: PoolClient, clientId: string, limit: number): Promise<CheckIn[]> {
  const { rows } = await c.query(
    `SELECT ${columns} FROM private.check_ins WHERE client_id=$1 AND body_weight_kg IS NOT NULL ORDER BY local_date DESC LIMIT $2`,
    [clientId, limit],
  );
  return rows.map(map);
}

export async function save(c: PoolClient, s: Scope, id: string, date: string, values: CheckInValues, nutritionVersionId: string | null, previous: CheckIn | null, now: Date): Promise<CheckIn> {
  const fields = [values.bodyWeightKg, values.sleepHours, values.stress, values.energy, values.hunger, values.nutritionCompliance, nutritionVersionId, values.comment];
  const { rows: [row] } = previous
    ? await c.query(
        `UPDATE private.check_ins SET body_weight_kg=$2,sleep_hours=$3,stress=$4,energy=$5,hunger=$6,nutrition_compliance=$7,nutrition_version_id=$8,comment=$9,revision=revision+1,updated_at=$10
         WHERE id=$1 AND revision=$11 RETURNING ${columns}`,
        [previous.id, ...fields, now, previous.revision],
      )
    : await c.query(
        `INSERT INTO private.check_ins(id,client_id,local_date,time_zone,body_weight_kg,sleep_hours,stress,energy,hunger,nutrition_compliance,nutrition_version_id,comment,created_at,updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING ${columns}`,
        [id, s.clientId, date, s.timeZone, ...fields, now],
      );
  if (!row) return conflict();
  const saved = map(row);
  // Each revision keeps a full snapshot: corrections never lose what was there before.
  await c.query('INSERT INTO private.check_in_revisions(check_in_id,revision,data,recorded_at) VALUES($1,$2,$3,$4)', [saved.id, saved.revision, JSON.stringify(saved), now]);
  return saved;
}

/** Activation dates ascending; the last one on or before a date is the version in force. */
export async function activations(c: PoolClient, table: 'training_activations' | 'nutrition_activations', clientId: string) {
  const { rows } = await c.query<{ versionId: string; localDate: string }>(
    `SELECT version_id AS "versionId",local_date::text AS "localDate" FROM private.${table} WHERE client_id=$1 ORDER BY local_date,revision`,
    [clientId],
  );
  return rows;
}
export function inForce(rows: { versionId: string; localDate: string }[], date: string): string | null {
  let current: string | null = null;
  for (const row of rows) if (row.localDate <= date) current = row.versionId;
  return current;
}

export async function sessionsBetween(c: PoolClient, clientId: string, from: string, to: string) {
  const { rows } = await c.query<{ localDate: string; status: string; performed: number; recorded: number }>(
    `SELECT s.local_date::text AS "localDate",s.status,count(r.set_id) FILTER (WHERE r.state='performed')::int AS performed,count(r.set_id)::int AS recorded
     FROM private.training_sessions s LEFT JOIN private.training_results r ON r.session_id=s.id
     WHERE s.client_id=$1 AND s.local_date BETWEEN $2::date AND $3::date GROUP BY s.id`,
    [clientId, from, to],
  );
  return rows;
}

export interface RawSessionDetail {
  id: string;
  localDate: string;
  timeZone: string;
  versionId: string;
  dayId: string;
  status: 'draft' | 'finalized';
  results: {
    setId: string;
    state: 'performed' | 'not_performed';
    reps: number;
    loadKg: number | null;
    rpe: number | null;
    rir: number | null;
  }[];
}

export async function sessionDetailsBetween(c: PoolClient, clientId: string, from: string, to: string): Promise<RawSessionDetail[]> {
  const { rows } = await c.query<{
    id: string;
    localDate: string;
    timeZone: string;
    versionId: string;
    dayId: string;
    status: 'draft' | 'finalized';
  }>(
    `SELECT id,local_date::text AS "localDate",time_zone AS "timeZone",version_id AS "versionId",day_id AS "dayId",status
     FROM private.training_sessions
     WHERE client_id=$1 AND local_date BETWEEN $2::date AND $3::date
     ORDER BY local_date DESC`,
    [clientId, from, to],
  );
  if (rows.length === 0) return [];
  const { rows: resultRows } = await c.query<{
    sessionId: string;
    setId: string;
    state: 'performed' | 'not_performed';
    reps: number;
    loadKg: string | null;
    rpe: string | null;
    rir: number | null;
  }>(
    `SELECT session_id AS "sessionId",set_id AS "setId",state,reps,load_kg AS "loadKg",rpe,rir
     FROM private.training_results WHERE session_id = ANY($1::uuid[])`,
    [rows.map((r) => r.id)],
  );
  const bySession = new Map<string, RawSessionDetail['results']>();
  for (const r of resultRows) {
    const list = bySession.get(r.sessionId) ?? [];
    list.push({
      setId: r.setId,
      state: r.state,
      reps: r.reps,
      loadKg: decimal(r.loadKg),
      rpe: decimal(r.rpe),
      rir: r.rir,
    });
    bySession.set(r.sessionId, list);
  }
  return rows.map((row) => ({ ...row, results: bySession.get(row.id) ?? [] }));
}

export async function activePortfolioClients(c: PoolClient, identity: SessionIdentity): Promise<{ clientId: string; timeZone: string }[]> {
  if (identity.role !== 'professional') return missing();
  const { rows: [allowed] } = await c.query('SELECT private.training_professional($1) AS allowed', [identity.id]);
  if (!allowed.allowed) throw new AuthError(403, 'FOLLOW_UP_UNAVAILABLE', 'Se requiere una suscripción vigente para consultar el seguimiento.');
  const { rows } = await c.query<{ clientId: string; timeZone: string }>(
    `SELECT c.id AS "clientId",c.time_zone AS "timeZone"
     FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
     WHERE p.user_id=$1 AND c.status='active'
     ORDER BY c.id`,
    [identity.id],
  );
  return rows;
}

export async function nutritionName(c: PoolClient, versionId: string): Promise<string | null> {
  const { rows: [row] } = await c.query("SELECT document->>'name' AS name FROM private.nutrition_versions WHERE id=$1", [versionId]);
  return row?.name ?? null;
}

export async function visibility(c: PoolClient, clientId: string): Promise<Visibility> {
  const { rows: [row] } = await c.query('SELECT measurements,adherence,revision FROM private.client_visibility WHERE client_id=$1', [clientId]);
  return row ?? { measurements: false, adherence: false, revision: 0 };
}

export async function setVisibility(c: PoolClient, identity: SessionIdentity, clientId: string, next: Omit<Visibility, 'revision'>, revision: number, now: Date): Promise<Visibility> {
  const before = await visibility(c, clientId);
  if (before.revision !== revision) return conflict('La información compartida cambió en otra sesión. Actualiza antes de guardar.');
  const { rows: [row] } = await c.query(
    `INSERT INTO private.client_visibility(client_id,measurements,adherence,updated_at) VALUES($1,$2,$3,$4)
     ON CONFLICT(client_id) DO UPDATE SET measurements=excluded.measurements,adherence=excluded.adherence,revision=client_visibility.revision+1,updated_at=excluded.updated_at
     RETURNING measurements,adherence,revision`,
    [clientId, next.measurements, next.adherence, now],
  );
  await c.query('INSERT INTO private.training_audit(owner_id,client_id,action,data) VALUES($1,$2,$3,$4)', [identity.id, clientId, 'visibility_changed', JSON.stringify({ before, after: row })]);
  return row;
}

const evaluationMethod = (value: unknown): SharedMeasurement['method'] =>
  value === 'circumference'
    ? 'perimetros'
    : value === 'skinfolds'
      ? 'pliegues'
      : value === 'bioimpedance'
        ? 'bioimpedancia'
        : null;

/** Measurements the client may see; RLS also requires the shared flag, not only this service. */
export async function measurements(c: PoolClient, clientId: string): Promise<SharedMeasurement[]> {
  const { rows } = await c.query(
    `SELECT id,
       COALESCE(to_jsonb(client_evaluations)->'assessment'->>'effectiveDate', evaluation_date::text) AS date,
       COALESCE(weight_kg, (to_jsonb(client_evaluations)->'assessment'->'measurements'->>'weightKg')::numeric) AS weight_kg,
       COALESCE(waist_cm, (to_jsonb(client_evaluations)->'assessment'->'measurements'->>'waistCm')::numeric) AS waist_cm,
       COALESCE(hip_cm, (to_jsonb(client_evaluations)->'assessment'->'measurements'->>'hipCm')::numeric) AS hip_cm,
       COALESCE(measured_body_fat_percentage, (to_jsonb(client_evaluations)->'assessment'->'measurements'->>'measuredBodyFatPercentage')::numeric) AS measured_body_fat_percentage,
       to_jsonb(client_evaluations)->'assessment'->>'method' AS method,
       to_jsonb(client_evaluations)->'assessment' AS assessment
     FROM private.client_evaluations
     WHERE client_id=$1
     ORDER BY COALESCE(to_jsonb(client_evaluations)->'assessment'->>'effectiveDate', evaluation_date::text) DESC, created_at DESC, id DESC
     LIMIT 60`,
    [clientId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    date: r.date as string,
    weightKg: decimal(r.weight_kg),
    waistCm: decimal(r.waist_cm),
    hipCm: decimal(r.hip_cm),
    bodyFatPercentage:
      decimal(r.measured_body_fat_percentage) ??
      (r.method === 'skinfolds'
        ? oneDecimal(skinfoldResults(r.assessment ?? {})?.bodyFatPercentage)
        : null),
    source: 'professional_evaluation',
    method: evaluationMethod(r.method),
  }));
}

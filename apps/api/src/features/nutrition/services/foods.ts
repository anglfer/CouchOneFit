import type { Pool, PoolClient } from 'pg';
import { readAsSubject } from '../../auth/repositories/lifecycle.js';
import { AuthError } from '../../auth/types/errors.js';
import type { SessionIdentity } from '../../auth/types/session.js';
import * as foods from '../repositories/foods.js';
import { validateFood, validateFoodUpdate, validateRevision } from '../validators/foods.js';
import { uuid } from '../validators/nutrition.js';

// RLS would only hide rows; an explicit check turns a lapsed subscription into a clear 403.
async function owner(c: PoolClient, identity: SessionIdentity): Promise<string> {
  const {
    rows: [row],
  } = await c.query('SELECT private.nutrition_professional($1) AS allowed', [identity.id]);
  if (!row?.allowed)
    throw new AuthError(
      403,
      'FOOD_LIBRARY_UNAVAILABLE',
      'Necesitas una suscripción vigente para usar tu biblioteca de alimentos.',
    );
  return identity.id;
}

const run = <T>(pool: Pool, identity: SessionIdentity, work: (c: PoolClient, ownerId: string) => Promise<T>) =>
  readAsSubject(pool, identity.id, async (c) => work(c, await owner(c, identity)));

export const listFoods = (pool: Pool, identity: SessionIdentity) =>
  run(pool, identity, async (c, ownerId) => ({ foods: await foods.list(c, ownerId) }));

export function createFood(pool: Pool, identity: SessionIdentity, body: unknown) {
  const food = validateFood(body);
  return run(pool, identity, (c, ownerId) => foods.insert(c, ownerId, food));
}

export function updateFood(pool: Pool, identity: SessionIdentity, foodId: unknown, body: unknown) {
  const id = uuid(foodId);
  const { food, revision } = validateFoodUpdate(body);
  return run(pool, identity, (c, ownerId) => foods.update(c, ownerId, id, revision, food));
}

export function archiveFood(pool: Pool, identity: SessionIdentity, foodId: unknown, body: unknown) {
  const id = uuid(foodId);
  const revision = validateRevision(body);
  return run(pool, identity, async (c, ownerId) => {
    await foods.archive(c, ownerId, id, revision);
    return { archived: true };
  });
}

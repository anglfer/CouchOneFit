import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import request from 'supertest';

if (!process.env.TEST_DATABASE_URL) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
}

process.env.AUTH_JWT_SECRET = 'nutrition-foods-test-secret-at-least-32-bytes';
process.env.CORS_ORIGIN = 'http://localhost:5000';

const { createApp } = await import('../src/app.js');
const { signAccess } = await import('../src/features/auth/services/tokens.js');
const { readAsSubject } = await import('../src/features/auth/repositories/lifecycle.js');

const url = process.env.TEST_DATABASE_URL!;
assert(url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Local test database required');

const owner = new Pool({ connectionString: url });
const dbName = `cof_foods_${randomBytes(5).toString('hex')}`;
let db: Pool;
let runtime: Pool;
let app: ReturnType<typeof createApp>;
let created = false;

interface Actor {
  id: string;
  token: string;
  professionalId?: string;
}
let pro: Actor;
let other: Actor;
let client: Actor;

async function actor(role: 'professional' | 'client', parent?: Actor): Promise<Actor> {
  const id = randomUUID();
  const session = randomUUID();
  await db.query(
    "INSERT INTO private.users(id,username,email,password_hash,role) VALUES($1::uuid,replace(left($1::text,20),'-',''),$2,'$argon2id$fixture',$3)",
    [id, `${id}@example.com`, role],
  );
  await db.query('INSERT INTO private.sessions(id,user_id) VALUES($1,$2)', [session, id]);
  const a: Actor = { id, token: await signAccess(id, session) };
  if (role === 'professional') {
    a.professionalId = (
      await db.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Foods QA') RETURNING id", [id])
    ).rows[0].id;
    await db.query(
      "INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE max_clients=10",
      [a.professionalId],
    );
  } else {
    await db.query("INSERT INTO private.clients(professional_id,user_id,full_name) VALUES($1,$2,'Foods client')", [
      parent!.professionalId,
      id,
    ]);
  }
  return a;
}

before(async () => {
  await owner.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  const target = new URL(url);
  target.pathname = `/${dbName}`;
  db = new Pool({ connectionString: target.toString() });
  await db.query(readFileSync(new URL('../../../docs/database/schemas/identity_access.sql', import.meta.url), 'utf8'));
  runtime = new Pool({
    connectionString: target.toString(),
    options: '-c role=couchone_authentication -c statement_timeout=10000',
    max: 5,
  });
  app = createApp(runtime);
  pro = await actor('professional');
  other = await actor('professional');
  client = await actor('client', pro);
});

after(async () => {
  await runtime?.end();
  await db?.end();
  if (created) await owner.query(`DROP DATABASE "${dbName}"`);
  await owner.end();
});

const cookie = (who: Actor) => `cof_access=${who.token}`;
const list = (who = pro) => request(app).get('/api/nutrition/foods').set('Cookie', [cookie(who)]);

async function send(method: 'post' | 'patch', path: string, body: unknown, who = pro, csrf = true) {
  const token = await request(app).get('/api/auth/csrf');
  const call = request(app)
    [method](path)
    .set('Origin', 'http://localhost:5000')
    .set('Cookie', [cookie(who), ...(token.headers['set-cookie'] as string[]).map((c) => c.split(';')[0])]);
  if (csrf) call.set('X-CSRF-Token', token.body.csrfToken);
  return call.send(body as object);
}

const tortilla = {
  name: 'Tortilla de nopal',
  group: 'Carbohidratos',
  kind: 'food',
  basis: 'per_unit',
  defaultUnit: 'pza',
  defaultQuantity: 2,
  calories: 35,
  proteinG: 1.5,
  carbsG: 6.5,
  fatG: 0.4,
  preparation: 'Calentar en comal sin aceite.',
  substitutes: 'Tortilla de maíz',
  suitableFor: ['vegan', 'gluten_free', 'vegan'],
  mealCategories: ['breakfast', 'dinner'],
};

test('a professional builds a private food and recipe library with server-side recipe macros', async () => {
  const food = await send('post', '/api/nutrition/foods', tortilla);
  assert.equal(food.status, 201, JSON.stringify(food.body));
  assert.equal(food.body.revision, 1);
  assert.deepEqual(food.body.suitableFor, ['vegan', 'gluten_free']);
  assert.equal(food.body.ingredients, null);

  const recipe = await send('post', '/api/nutrition/foods', {
    name: 'Hotcakes de avena',
    group: 'Carbohidratos',
    kind: 'recipe',
    // Client-sent portion macros are ignored: the server derives them from the ingredients.
    basis: 'per_100',
    calories: 1,
    servings: 2,
    ingredients: [
      { name: 'Avena', quantity: 80, unit: 'g', calories: 311, proteinG: 13.5, carbsG: 53, fatG: 5.5 },
      { name: 'Claras de huevo', quantity: 200, unit: 'g', calories: 104, proteinG: 22, carbsG: 1.5, fatG: 0.4 },
    ],
  });
  assert.equal(recipe.status, 201, JSON.stringify(recipe.body));
  assert.deepEqual(
    [recipe.body.basis, recipe.body.defaultUnit, recipe.body.defaultQuantity, recipe.body.calories],
    ['per_unit', 'porción', 1, 207.5],
  );
  assert.deepEqual([recipe.body.proteinG, recipe.body.carbsG, recipe.body.fatG], [17.8, 27.3, 3]);

  const listed = await list();
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listed.body.foods.map((f: { name: string }) => f.name),
    ['Hotcakes de avena', 'Tortilla de nopal'],
  );
  assert.deepEqual((await list(other)).body.foods, []);
});

test('invalid foods, duplicate names, stale revisions and foreign ids are rejected', async () => {
  const bad = (body: object) => send('post', '/api/nutrition/foods', { ...tortilla, name: randomUUID(), ...body });
  assert.equal((await bad({ basis: 'per_100', proteinG: 60, carbsG: 50 })).status, 400);
  assert.equal((await bad({ kind: 'recipe', ingredients: [], servings: 1 })).status, 400);
  assert.equal((await bad({ servings: 2 })).status, 400);
  assert.equal((await bad({ group: 'Postres' })).status, 400);
  assert.equal((await bad({ photo: 'x' })).status, 400);

  const duplicate = await send('post', '/api/nutrition/foods', { ...tortilla, name: 'TORTILLA DE NOPAL' });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'FOOD_NAME_TAKEN');

  const current = (await list()).body.foods.find((f: { name: string }) => f.name === 'Tortilla de nopal');
  const path = `/api/nutrition/foods/${current.id}`;
  const updated = await send('patch', path, { ...tortilla, calories: 40, revision: current.revision });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.deepEqual([updated.body.calories, updated.body.revision], [40, 2]);
  const stale = await send('patch', path, { ...tortilla, revision: current.revision });
  assert.deepEqual([stale.status, stale.body.error.code], [409, 'FOOD_CONFLICT']);

  const foreign = await send('patch', path, { ...tortilla, revision: 2 }, other);
  assert.deepEqual([foreign.status, foreign.body.error.code], [404, 'FOOD_NOT_FOUND']);
  assert.equal((await send('post', `${path}/archive`, { revision: 2 }, other)).status, 404);
  assert.equal((await send('patch', path, { ...tortilla, revision: 2 }, pro, false)).status, 403);
  const asClient = await request(app).get('/api/nutrition/foods').set('Authorization', `Bearer ${client.token}`);
  assert.deepEqual([asClient.status, asClient.body.error.code], [403, 'ROLE_FORBIDDEN']);

  // RLS hides another professional's rows even from a direct query.
  const visible = await readAsSubject(runtime, other.id, (c) => c.query('SELECT id FROM private.professional_foods'));
  assert.equal(visible.rowCount, 0);
});

test('archiving hides the food and frees its name; a lapsed subscription blocks the library', async () => {
  const current = (await list()).body.foods.find((f: { name: string }) => f.name === 'Tortilla de nopal');
  const archived = await send('post', `/api/nutrition/foods/${current.id}/archive`, { revision: current.revision });
  assert.equal(archived.status, 200, JSON.stringify(archived.body));
  assert.equal(
    (await list()).body.foods.some((f: { id: string }) => f.id === current.id),
    false,
  );
  assert.equal((await send('post', '/api/nutrition/foods', tortilla)).status, 201);

  await db.query("UPDATE private.subscriptions SET expires_at=clock_timestamp()-interval '1 day' WHERE professional_id=$1", [
    pro.professionalId,
  ]);
  const lapsed = await list();
  assert.deepEqual([lapsed.status, lapsed.body.error.code], [403, 'FOOD_LIBRARY_UNAVAILABLE']);
});

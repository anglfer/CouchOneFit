import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { Pool } from 'pg';
import request from 'supertest';
import type { NutritionDocument, NutritionSuggestionInput } from '../src/features/nutrition/types/nutrition.js';

if (!process.env.TEST_DATABASE_URL) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
}

process.env.AUTH_JWT_SECRET = 'nutrition-local-test-secret-at-least-32-bytes';
process.env.CORS_ORIGIN = 'http://localhost:5000';

const { createApp } = await import('../src/app.js');
const { signAccess } = await import('../src/features/auth/services/tokens.js');

const url = process.env.TEST_DATABASE_URL!;
assert(url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Local test database required');

const owner = new Pool({ connectionString: url });
const dbName = `cof_nutrition_${randomBytes(5).toString('hex')}`;
let db: Pool;
let runtime: Pool;
let app: ReturnType<typeof createApp>;
let created = false;

interface Actor {
  id: string;
  token: string;
  professionalId?: string;
  clientId?: string;
}

let pro: Actor;
let other: Actor;
let client: Actor;
let clientB: Actor;

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
      await db.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Nutrition QA') RETURNING id", [id])
    ).rows[0].id;
    await db.query(
      "INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE max_clients=10",
      [a.professionalId],
    );
  } else {
    a.clientId = (
      await db.query(
        "INSERT INTO private.clients(professional_id,user_id,full_name,birth_date,height_cm,base_weight_kg) VALUES($1,$2,'Nutrition client','1995-01-01',174,76) RETURNING id",
        [parent!.professionalId, id],
      )
    ).rows[0].id;
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
    max: 10,
  });
  app = createApp(runtime);
  pro = await actor('professional');
  other = await actor('professional');
  client = await actor('client', pro);
  clientB = await actor('client', other);
});

after(async () => {
  await runtime?.end();
  await db?.end();
  if (created) await owner.query(`DROP DATABASE "${dbName}"`);
  await owner.end();
});

async function send(
  method: 'post' | 'patch',
  path: string,
  body: unknown,
  who = pro,
  idempotencyKey?: string,
) {
  let call = request(app)[method](path);
  if (who === client || who === clientB) {
    call = call.set('Authorization', `Bearer ${who.token}`);
  } else {
    const csrf = await request(app).get('/api/auth/csrf');
    call = call
      .set('Origin', 'http://localhost:5000')
      .set('Cookie', [
        `cof_access=${who.token}`,
        ...(csrf.headers['set-cookie'] as string[]).map((c) => c.split(';')[0]),
      ])
      .set('X-CSRF-Token', csrf.body.csrfToken);
  }
  if (idempotencyKey) call = call.set('Idempotency-Key', idempotencyKey);
  return call.send(body as object);
}

const get = (path: string, who = pro) =>
  request(app).get(path).set('Authorization', `Bearer ${who.token}`);

function enrichedDocument(title: string, weightKg = 76): NutritionDocument {
  return {
    name: title,
    caloriesTarget: 2200,
    proteinTargetG: 165,
    carbsTargetG: 230,
    fatTargetG: 69,
    generalInstructions: 'Mantén hidratación constante y prioriza proteína en cada tiempo.',
    fiberTargetG: 31,
    hydrationTargetMl: 2850,
    restDayTargets: {
      caloriesTarget: 1960,
      proteinTargetG: 165,
      carbsTargetG: 170,
      fatTargetG: 69,
    },
    periWorkout: {
      preCarbsG: 45,
      preProteinG: 28,
      preFatG: 8,
      postCarbsG: 60,
      postProteinG: 38,
      postFatG: 10,
      intraCarbsG: 0,
      notes: 'Pre-entreno 75 min antes de entrenar.',
    },
    suggestionMeta: {
      engineVersion: 'hu025-fitnextfy-v1',
      formula: 'mifflin',
      goal: 'fat_loss',
      pace: 'normal',
      bmr: 1730,
      tdee: 2710,
      adjustmentPct: -18.8,
      baselineWeightKg: weightKg,
      baselineBodyFatPct: 16.5,
      generatedAt: '2026-11-19T12:00:00.000Z',
      modifiedByProfessional: true,
    },
    meals: [
      {
        id: randomUUID(),
        name: 'Desayuno energético',
        category: 'breakfast',
        scheduleTime: '08:00',
        targetCalories: 610,
        targetProteinG: 44,
        targetCarbsG: 64,
        targetFatG: 18,
        instructions: 'Preparar avena tibia.',
        items: [
          {
            id: randomUUID(),
            name: 'Claras de huevo',
            quantity: 220,
            unit: 'g',
            foodGroup: 'proteinas',
            substitutes: '40 g de proteína whey o 160 g de pechuga cocida',
            instructions: 'En sartén antiadherente',
            calories: 114,
            proteinG: 24.2,
            carbsG: 1.6,
            fatG: 0.4,
          },
          {
            id: randomUUID(),
            name: 'Avena en hojuelas',
            quantity: 70,
            unit: 'g',
            foodGroup: 'carbohidratos',
            substitutes: '75 g de quinoa cocida o 2 rebanadas de pan integral',
            instructions: null,
            calories: 272,
            proteinG: 9.2,
            carbsG: 46.2,
            fatG: 4.9,
          },
        ],
      },
    ],
  };
}

test('HU-024 a HU-027: sugerencia sin persistencia, versiones enriquecidas, expediente, móvil y aislamiento RLS', async () => {
  const base = `/api/clients/${client.clientId}/nutrition-plans`;

  // a. Estado inicial en expediente y endpoint móvil
  const initialRecord = await get(`/api/clients/${client.clientId}/record`);
  assert.equal(initialRecord.status, 200, JSON.stringify(initialRecord.body));
  assert.equal(initialRecord.body.record.sections.nutritionPlan.status, 'empty');
  const initialMobile = await get('/api/me/nutrition-plan', client);
  assert.equal(initialMobile.status, 200);
  assert.equal(initialMobile.body.plan, null);

  // b. Sugerencia HU-025 (solo propone, nunca crea plan/versión ni permite cartera ajena/cliente)
  const suggestionInput: NutritionSuggestionInput = {
    sex: 'male',
    ageYears: 30,
    weightKg: 76,
    heightCm: 174,
    bodyFatPct: 16.5,
    formula: 'katch_mcardle',
    activityLevel: 'moderate',
    neatLevel: 'medium',
    experience: 'intermediate',
    goal: 'fat_loss',
    pace: 'normal',
    trainingDaysPerWeek: 4,
    sessionDurationMin: 60,
    macroPreference: 'balanced',
    enableCarbCycling: true,
    restrictions: [],
  };
  // Sin evaluación física no se calcula ni se prescribe.
  const noEvalSuggestion = await send('post', `${base}/suggestion`, suggestionInput, pro);
  assert.equal(noEvalSuggestion.status, 409);
  assert.equal(noEvalSuggestion.body.error.code, 'NUTRITION_EVALUATION_REQUIRED');
  assert.equal((await send('post', base, enrichedDocument('Sin evaluación', 76), pro)).status, 409);
  await db.query('INSERT INTO private.client_evaluations(client_id,weight_kg) VALUES($1,76)', [client.clientId]);

  const suggested = await send('post', `${base}/suggestion`, suggestionInput, pro);
  assert.equal(suggested.status, 200, JSON.stringify(suggested.body));
  const sug = suggested.body.suggestion;
  assert.equal(sug.formulaUsed, 'katch_mcardle');
  assert.ok(sug.trainingDayTargets.caloriesTarget > 0);
  assert.ok(sug.restDayTargets !== null);
  assert.ok(sug.periWorkout.preCarbsG >= 0);
  assert.ok(sug.fiberTargetG >= 15);
  assert.ok(sug.hydrationTargetMl >= 1000);
  assert.equal(sug.meta.engineVersion, 'hu025-fitnextfy-v2');
  assert.equal((await db.query('SELECT count(*) FROM private.nutrition_plans')).rows[0].count, '0');
  assert.equal((await db.query('SELECT count(*) FROM private.nutrition_versions')).rows[0].count, '0');

  assert.equal((await send('post', `${base}/suggestion`, suggestionInput, other)).status, 404);
  assert.equal((await send('post', `${base}/suggestion`, suggestionInput, client)).status, 403);

  // c. Crear borrador V1 enriquecido: sigue invisible en móvil hasta activarse
  const v1Doc = enrichedDocument('Plan definición V1', 76);
  const createdV1 = await send('post', base, v1Doc, pro);
  assert.equal(createdV1.status, 201, JSON.stringify(createdV1.body));
  const v1 = createdV1.body;
  assert.equal(v1.published, false);
  assert.equal(v1.number, 1);
  assert.equal(v1.revision, 1);
  assert.equal(v1.fiberTargetG, 31);
  assert.equal(v1.hydrationTargetMl, 2850);
  assert.equal(v1.restDayTargets.caloriesTarget, 1960);
  assert.equal(v1.periWorkout.preCarbsG, 45);
  assert.equal(v1.suggestionMeta.baselineWeightKg, 76);
  assert.equal(v1.meals[0].category, 'breakfast');
  assert.equal(v1.meals[0].scheduleTime, '08:00');
  assert.equal(v1.meals[0].items[0].substitutes, '40 g de proteína whey o 160 g de pechuga cocida');
  assert.equal((await get('/api/me/nutrition-plan', client)).body.plan, null);

  // d. PATCH borrador V1 y rechazo por revisión desactualizada
  const v1UpdatedDoc = { ...enrichedDocument('Plan definición V1 ajustado', 76), revision: 1 };
  const patchedV1 = await send('patch', `${base}/${v1.planId}/versions/${v1.id}`, v1UpdatedDoc, pro);
  assert.equal(patchedV1.status, 201, JSON.stringify(patchedV1.body));
  assert.equal(patchedV1.body.revision, 2);
  assert.equal(patchedV1.body.name, 'Plan definición V1 ajustado');
  assert.equal(
    (await send('patch', `${base}/${v1.planId}/versions/${v1.id}`, v1UpdatedDoc, pro)).status,
    409,
  );

  // e. Activar V1: expediente pasa a available, móvil recibe V1, clientB ve null y V1 publicada bloquea PATCH
  const activatedV1 = await send(
    'post',
    `${base}/${v1.planId}/versions/${v1.id}/activate`,
    { expectedActiveRevision: 0 },
    pro,
  );
  assert.equal(activatedV1.status, 200, JSON.stringify(activatedV1.body));
  assert.equal(activatedV1.body.activeRevision, 1);
  assert.equal(activatedV1.body.version.published, true);

  const recordAfterV1 = await get(`/api/clients/${client.clientId}/record`);
  assert.equal(recordAfterV1.status, 200);
  assert.equal(recordAfterV1.body.record.sections.nutritionPlan.status, 'available');
  assert.equal(recordAfterV1.body.record.sections.nutritionPlan.plan.id, v1.id);
  assert.equal(recordAfterV1.body.record.sections.nutritionPlan.plan.fiberTargetG, 31);
  assert.equal(recordAfterV1.body.record.sections.nutritionPlan.activeRevision, 1);

  const mobileAfterV1 = await get('/api/me/nutrition-plan', client);
  assert.equal(mobileAfterV1.status, 200);
  assert.equal(mobileAfterV1.body.plan.id, v1.id);
  assert.equal(mobileAfterV1.body.plan.restDayTargets.caloriesTarget, 1960);

  assert.equal((await get('/api/me/nutrition-plan', clientB)).body.plan, null);
  assert.equal(
    (
      await send(
        'patch',
        `${base}/${v1.planId}/versions/${v1.id}`,
        { ...enrichedDocument('Intento editar publicada', 76), revision: activatedV1.body.version.revision },
        pro,
      )
    ).status,
    409,
  );

  // f. Crear borrador V2 y activar V2: móvil pasa a V2 y el historial conserva V1 y V2; aislamiento entre carteras
  const v2Doc = enrichedDocument('Plan ajuste V2', 73.2);
  const createdV2 = await send('post', `${base}/${v1.planId}/versions`, v2Doc, pro);
  assert.equal(createdV2.status, 201, JSON.stringify(createdV2.body));
  const v2 = createdV2.body;
  assert.equal(v2.number, 2);
  assert.equal(v2.published, false);

  const staleActivate = await send(
    'post',
    `${base}/${v1.planId}/versions/${v2.id}/activate`,
    { expectedActiveRevision: 99 },
    pro,
  );
  assert.equal(staleActivate.status, 409);

  const activatedV2 = await send(
    'post',
    `${base}/${v1.planId}/versions/${v2.id}/activate`,
    { expectedActiveRevision: 1 },
    pro,
  );
  assert.equal(activatedV2.status, 200, JSON.stringify(activatedV2.body));
  assert.equal(activatedV2.body.activeRevision, 2);

  const mobileAfterV2 = await get('/api/me/nutrition-plan', client);
  assert.equal(mobileAfterV2.body.plan.id, v2.id);
  assert.equal(mobileAfterV2.body.plan.name, 'Plan ajuste V2');

  const listAfterV2 = await get(base, pro);
  assert.equal(listAfterV2.status, 200);
  assert.equal(listAfterV2.body.versions.length, 2);
  assert.equal(listAfterV2.body.activeVersionId, v2.id);
  assert.equal(listAfterV2.body.activeRevision, 2);
  assert.equal(listAfterV2.body.canWrite, true);

  // Aislamiento de cartera ajena y cliente intentando escribir
  assert.equal((await get(base, other)).status, 404);
  assert.equal((await send('post', base, enrichedDocument('Ajeno'), other)).status, 404);
  assert.equal(
    (await send('post', `${base}/${v1.planId}/versions/${v1.id}/activate`, { expectedActiveRevision: 2 }, other)).status,
    404,
  );
  assert.equal((await send('post', base, enrichedDocument('Cliente no escribe'), client)).status, 403);

  // g. Cliente inactivo bloquea escrituras y sugerencia, pero mantiene lectura
  await db.query("UPDATE private.clients SET status = 'inactive' WHERE id = $1", [client.clientId]);
  assert.equal((await send('post', `${base}/suggestion`, suggestionInput, pro)).status, 403);
  assert.equal((await send('post', `${base}/${v1.planId}/versions`, enrichedDocument('Inactivo'), pro)).status, 403);
  const inactiveList = await get(base, pro);
  assert.equal(inactiveList.status, 200);
  assert.equal(inactiveList.body.canWrite, false);

  // h. Verificación RLS directa con el rol restringido y sujeto de otra cartera
  const r = await runtime.connect();
  try {
    await r.query('BEGIN');
    await r.query("SELECT set_config('app.subject_id', $1, true)", [clientB.id]);
    assert.equal((await r.query('SELECT * FROM private.nutrition_plans')).rowCount, 0);
    assert.equal((await r.query('SELECT * FROM private.nutrition_versions')).rowCount, 0);
  } finally {
    await r.query('ROLLBACK');
    r.release();
  }
});

test('HU-040: escrituras nutricionales del profesional soportan Idempotency-Key sin duplicar ni reescribir', async () => {
  const idemClient = await actor('client', pro);
  await db.query('INSERT INTO private.client_evaluations(client_id,weight_kg) VALUES($1,74)', [idemClient.clientId]);
  const base = `/api/clients/${idemClient.clientId}/nutrition-plans`;

  const planId = randomUUID();
  const versionId = randomUUID();
  const createKey = randomUUID();
  const createBody = {
    ...enrichedDocument('Plan offline idempotente', 74),
    id: planId,
    versionId,
  };

  const firstCreate = await send('post', base, createBody, pro, createKey);
  assert.equal(firstCreate.status, 201, JSON.stringify(firstCreate.body));
  assert.equal(firstCreate.body.planId, planId);
  assert.equal(firstCreate.body.id, versionId);

  const replayCreate = await send('post', base, createBody, pro, createKey);
  assert.equal(replayCreate.status, 201);
  assert.equal(replayCreate.headers['idempotent-replayed'], 'true');
  assert.deepEqual(replayCreate.body, firstCreate.body);

  const reusedCreate = await send(
    'post',
    base,
    { ...createBody, name: 'Otro nombre con misma clave' },
    pro,
    createKey,
  );
  assert.equal(reusedCreate.status, 422);
  assert.equal(reusedCreate.body.error.code, 'IDEMPOTENCY_KEY_REUSED');

  const patchKey = randomUUID();
  const patchBody = { ...enrichedDocument('Plan offline editado', 74), revision: 1 };
  const firstPatch = await send('patch', `${base}/${planId}/versions/${versionId}`, patchBody, pro, patchKey);
  assert.equal(firstPatch.status, 201, JSON.stringify(firstPatch.body));
  assert.equal(firstPatch.body.revision, 2);

  const replayPatch = await send('patch', `${base}/${planId}/versions/${versionId}`, patchBody, pro, patchKey);
  assert.equal(replayPatch.status, 201);
  assert.equal(replayPatch.headers['idempotent-replayed'], 'true');
  assert.equal(replayPatch.body.revision, 2);

  const activateKey = randomUUID();
  const firstActivate = await send(
    'post',
    `${base}/${planId}/versions/${versionId}/activate`,
    { expectedActiveRevision: 0 },
    pro,
    activateKey,
  );
  assert.equal(firstActivate.status, 200, JSON.stringify(firstActivate.body));
  assert.equal(firstActivate.body.activeRevision, 1);

  const replayActivate = await send(
    'post',
    `${base}/${planId}/versions/${versionId}/activate`,
    { expectedActiveRevision: 0 },
    pro,
    activateKey,
  );
  assert.equal(replayActivate.status, 200);
  assert.equal(replayActivate.headers['idempotent-replayed'], 'true');
  assert.equal(replayActivate.body.activeRevision, 1);
});

test('HU-024/HU-027: receta prescrita conserva kind, ingredientes y pasos de hasta 2000 caracteres y rechaza ingredientes en alimento simple', async () => {
  const recipeClient = await actor('client', pro);
  await db.query('INSERT INTO private.client_evaluations(client_id,weight_kg) VALUES($1,72)', [recipeClient.clientId]);
  const base = `/api/clients/${recipeClient.clientId}/nutrition-plans`;

  const invalidFood = enrichedDocument('Alimento inválido con ingredientes', 72);
  invalidFood.meals[0].items[0].kind = 'food';
  invalidFood.meals[0].items[0].recipeIngredients = [{ name: 'Avena', quantity: 50, unit: 'g' }];
  const rejected = await send('post', base, invalidFood, pro);
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error.code, 'INVALID_NUTRITION');

  const longSteps = `1. Mezcla la avena con las claras.\n2. ${'Cocina a fuego medio hasta dorar. '.repeat(35)}`.slice(0, 1500).trim();
  const doc = enrichedDocument('Plan con receta e ingredientes', 72);
  doc.meals[0].items = [
    {
      id: randomUUID(),
      name: 'Claras de huevo',
      quantity: 150,
      unit: 'g',
      instructions: null,
      foodGroup: 'Proteínas',
      substitutes: null,
      calories: 78,
      proteinG: 16.5,
      carbsG: 1.1,
      fatG: 0.3,
    },
    {
      id: randomUUID(),
      name: 'Hotcakes de avena',
      quantity: 2,
      unit: 'porción',
      kind: 'recipe',
      instructions: longSteps,
      recipeIngredients: [
        { name: 'Avena en hojuelas', quantity: 80, unit: 'g' },
        { name: 'Claras de huevo', quantity: 200, unit: 'g' },
      ],
      foodGroup: 'Carbohidratos',
      substitutes: 'Pan integral con huevo',
      calories: 415,
      proteinG: 35.6,
      carbsG: 54.6,
      fatG: 6,
    },
  ];

  const created = await send('post', base, doc, pro);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const v = created.body;
  assert.equal(v.meals[0].items[0].kind, 'food');
  assert.equal(v.meals[0].items[0].recipeIngredients, null);
  assert.equal(v.meals[0].items[1].kind, 'recipe');
  assert.equal(v.meals[0].items[1].instructions, longSteps);
  assert.deepEqual(v.meals[0].items[1].recipeIngredients, [
    { name: 'Avena en hojuelas', quantity: 80, unit: 'g' },
    { name: 'Claras de huevo', quantity: 200, unit: 'g' },
  ]);

  const activated = await send(
    'post',
    `${base}/${v.planId}/versions/${v.id}/activate`,
    { expectedActiveRevision: 0 },
    pro,
  );
  assert.equal(activated.status, 200);

  const mobile = await get('/api/me/nutrition-plan', recipeClient);
  assert.equal(mobile.status, 200);
  assert.equal(mobile.body.plan.meals[0].items[0].kind, 'food');
  assert.equal(mobile.body.plan.meals[0].items[1].kind, 'recipe');
  assert.equal(mobile.body.plan.meals[0].items[1].instructions, longSteps);
  assert.equal(mobile.body.plan.meals[0].items[1].recipeIngredients.length, 2);
});

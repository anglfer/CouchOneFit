import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import request from 'supertest';
import { Pool, defaults, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  PENDING_ESTIMATION_REFERENCE,
  ESTIMATION_METHOD_ID,
} from '../src/features/evaluations/types/estimation.js';
import type { SessionIdentity } from '../src/features/auth/types/session.js';
import { evolutionSample } from '../src/features/evaluations/domain/evolution.js';
import type { Evaluation } from '../src/features/evaluations/types/evaluation.js';
import { assessmentInput } from '../src/features/evaluations/validators/assessment.js';
import { candidateResponseVisibility } from '../src/features/evaluations/controllers/candidate-visibility.js';
import {
  localCandidateEnvironment,
  localCandidateTarget,
} from '../src/features/evaluations/domain/candidate-estimation.js';

process.env.AUTH_JWT_SECRET = 'hu023-synthetic-unit-only-key-material-'.repeat(
  2
);
process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/never_used_hu023';
process.env.NODE_ENV = 'test';
mock.method(Pool.prototype, 'connect', async () => {
  throw new Error('Real PostgreSQL forbidden');
});
mock.method(Pool.prototype, 'query', async () => {
  throw new Error('Real PostgreSQL forbidden');
});
const { evaluationControllers } =
  await import('../src/features/evaluations/controllers/evaluation.js');
const { idempotent } =
  await import('../src/features/idempotency/middleware/idempotency.js');
const clientId = '20000000-0000-4000-8000-000000000001';
const owner = '10000000-0000-4000-8000-000000000001';
const pending = () => ({
  methodId: ESTIMATION_METHOD_ID,
  protocolId: PENDING_ESTIMATION_REFERENCE.id,
  protocolVersion: PENDING_ESTIMATION_REFERENCE.version,
});
const body = () => ({
  method: 'pliegues',
  equation: 'male',
  measurements: { pectoralSkinfoldMm: 10.1 },
  estimationRequest: pending(),
});

// Real controller/service/repository/idempotency, in-memory SQL double only.
// Identity is injected for this test: it does NOT certify session middleware or physical RLS.
function fixture() {
  const state = {
    rows: [] as Record<string, unknown>[],
    ready: true,
    active: true,
    target: { host: '127.0.0.1', port: 5433, database: 'cof_hu023_unit' },
    rollbacks: 0,
  };
  const keys = new Map<
    string,
    { hash: unknown; status: number | null; body: unknown }
  >();
  const result = (rows: Record<string, unknown>[] = []) => ({
    rows,
    rowCount: rows.length,
  });
  const pool = {
    connect: async () => {
      let subject = '';
      let saved = structuredClone(state.rows);
      return {
        release() {},
        async query(sql: string, args: unknown[] = []) {
          if (sql === 'BEGIN') {
            saved = structuredClone(state.rows);
            return result();
          }
          if (sql === 'COMMIT') return result();
          if (sql === 'ROLLBACK') {
            state.rows = saved;
            state.rollbacks++;
            return result();
          }
          if (sql.includes('set_config')) {
            subject = String(args[1]);
            return result();
          }
          if (sql.includes('SELECT u.id,u.role'))
            return result([{ id: args[0], role: 'professional' }]);
          if (sql.startsWith('SELECT id FROM private.sessions'))
            return result([{ id: args[0] }]);
          if (sql.includes('private.training_professional'))
            return result([{ allowed: true }]);
          if (sql.includes('SELECT c.id,c.status,c.birth_date'))
            return result(
              subject === owner && args[0] === clientId
                ? [
                    {
                      id: clientId,
                      status: state.active ? 'active' : 'inactive',
                      birth_date: '1990-05-20',
                    },
                  ]
                : []
            );
          if (sql.includes('information_schema.columns'))
            return result([{ ready: true }]);
          if (sql.includes('inet_server_addr')) return result([state.target]);
          if (sql.includes('pg_constraint'))
            return result([{ ready: state.ready }]);
          if (sql.includes("timezone('UTC',clock_timestamp())::date::text"))
            return result([{ date: '2026-11-13' }]);
          if (sql.includes('INSERT INTO private.idempotency_keys')) {
            const key = `${args[0]}:${args[1]}`;
            if (keys.has(key)) return result();
            keys.set(key, { hash: args[2], status: null, body: null });
            return result([{ key: args[1] }]);
          }
          if (sql.includes('SELECT request_hash')) {
            const k = keys.get(`${args[0]}:${args[1]}`);
            return result(k ? [{ ...k, abandoned: false }] : []);
          }
          if (sql.includes('UPDATE private.idempotency_keys')) {
            const k = keys.get(`${args[0]}:${args[1]}`)!;
            k.status = Number(args[2]);
            k.body = JSON.parse(String(args[3]));
            return result();
          }
          if (sql.includes('DELETE FROM private.idempotency_keys')) {
            if (sql.includes('status_code IS NULL'))
              keys.delete(`${args[0]}:${args[1]}`);
            return result();
          }
          if (sql.includes('INSERT INTO private.client_evaluations')) {
            const fields = sql
              .match(/client_evaluations\(client_id,([^)]*)\)/)![1]
              .split(',');
            const row: Record<string, unknown> = {
              id: randomUUID(),
              client_id: args[0],
              evaluation_date: '2026-11-13',
              created_at: '2026-11-13T12:00:00Z',
            };
            fields.forEach((f, i) => {
              row[f] =
                f === 'assessment'
                  ? JSON.parse(String(args[i + 1]))
                  : args[i + 1];
            });
            state.rows.push(row);
            return result([row]);
          }
          if (sql.includes('FROM private.client_evaluations'))
            return result(state.rows.filter((r) => r.client_id === args[0]));
          throw new Error(`Unimplemented SQL in synthetic double: ${sql}`);
        },
      } as unknown as PoolClient;
    },
  } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.identity = {
      id: req.get('X-Test-Owner') ?? owner,
      role: req.get('X-Test-Role') ?? 'professional',
      sessionId: randomUUID(),
    } as SessionIdentity;
    next();
  });
  const controller = evaluationControllers(
    pool,
    () => new Date('2026-11-13T12:00:00Z')
  );
  app.post(
    '/api/clients/:clientId/evaluations',
    candidateResponseVisibility,
    idempotent(pool),
    controller.create
  );
  app.get('/api/clients/:clientId/evaluations', controller.list);
  app.use(
    (
      error: { status?: number; code?: string },
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      res
        .status(error.status ?? 500)
        .json({ code: error.code ?? 'INTERNAL_ERROR' });
    }
  );
  return { app, state };
}

test('HU-023 HTTP pending reference always stores unavailable without formula/protocol approval or numeric results', async () => {
  const { app, state } = fixture();
  for (const equation of ['male', 'female', 'not_applicable']) {
    const response = await request(app)
      .post(`/api/clients/${clientId}/evaluations`)
      .send({
        ...body(),
        equation,
        measurements: {
          pectoralSkinfoldMm: 10.1,
          abdominalSkinfoldMm: 15,
          thighSkinfoldMm: 20,
          tricepsSkinfoldMm: 12,
          suprailiacSkinfoldMm: 13,
        },
      });
    assert.equal(response.status, 201);
    const a = response.body.evaluation.assessment;
    assert.equal(a.version, 'composition-estimation-v1');
    assert.equal(a.estimation.status, 'unavailable');
    assert.equal(a.estimation.result, null);
    assert.equal(a.estimation.formulaVersion, null);
    assert.equal(a.estimation.domainPolicyVersion, null);
    assert.deepEqual(a.results, {});
    assert.deepEqual(a.estimation.reasons, [
      { code: 'scientific_verification_pending', fields: [] },
    ]);
    assert.equal(a.effectiveDate, '2026-11-13');
    assert.equal(a.ageYears, 36);
    assert.equal(a.ownerId, owner);
    assert.equal('estimationRequest' in a, false);
    const sample = evolutionSample(response.body.evaluation as Evaluation);
    assert.deepEqual(sample.measurements, a.measurements);
    assert.equal('estimatedBodyFatPercentage' in sample.measurements, false);
    assert.equal('measuredBodyFatPercentage' in sample.measurements, false);
    assert.equal(sample.method, 'pliegues');
    assert.equal(sample.date, a.effectiveDate);
  }
  assert.equal(state.rows.length, 3);
  const read = await request(app).get(`/api/clients/${clientId}/evaluations`);
  assert.equal(read.body.evaluations.length, 3);
  assert.equal(read.body.evaluations[0].assessment.estimation.result, null);
});

test('HU-023 unknown references, activation flags and result forgery fail before insertion', async () => {
  const { app, state } = fixture();
  for (const patch of [
    { estimationRequest: { ...pending(), protocolId: 'unknown' } },
    { estimationRequest: { ...pending(), protocolVersion: 'approved-v1' } },
    { estimationRequest: { ...pending(), activationAllowed: true } },
    { estimationRequest: null },
    { activationAllowed: true },
    { result: 20 },
    { method: 'perimetros', measurements: { waistCm: 80 } },
  ]) {
    const response = await request(app)
      .post(`/api/clients/${clientId}/evaluations`)
      .send({ ...body(), ...patch });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_EVALUATION');
  }
  assert.equal(state.rows.length, 0);
});

test('HU-023 old/offline payloads keep v1, no estimation and no new migration dependency', async () => {
  const { app, state } = fixture();
  state.ready = false;
  for (const old of [
    { weightKg: 70 },
    {
      method: 'pliegues',
      equation: 'male',
      measurements: { pectoralSkinfoldMm: 10 },
    },
  ]) {
    const r = await request(app)
      .post(`/api/clients/${clientId}/evaluations`)
      .send(old);
    assert.equal(r.status, 201);
    if (r.body.evaluation.assessment) {
      assert.equal(
        r.body.evaluation.assessment.version,
        'composition-arithmetic-v1'
      );
      assert.equal(r.body.evaluation.assessment.estimation, undefined);
    }
  }
  const r = await request(app)
    .post(`/api/clients/${clientId}/evaluations`)
    .send(body());
  assert.equal(r.status, 503);
  assert.equal(r.body.code, 'EVALUATION_UPGRADE_REQUIRED');
  assert.equal(state.rows.length, 2);
});

test('HU-023 real idempotency middleware replays the original response and rejects a changed reference payload', async () => {
  const { app, state } = fixture();
  const key = randomUUID();
  const send = (payload: unknown) =>
    request(app)
      .post(`/api/clients/${clientId}/evaluations`)
      .set('Idempotency-Key', key)
      .send(payload as object);
  const first = await send(body());
  const second = await send(body());
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.headers['idempotent-replayed'], 'true');
  assert.deepEqual(second.body, first.body);
  assert.equal(state.rows.length, 1);
  assert.equal((await send({ ...body(), equation: 'female' })).status, 422);
});

test('HU-023 repository preserves role, owner and inactive-client gates with transaction rollback', async () => {
  const { app, state } = fixture();
  assert.equal(
    (
      await request(app)
        .post(`/api/clients/${clientId}/evaluations`)
        .set('X-Test-Role', 'client')
        .send(body())
    ).status,
    403
  );
  assert.equal(
    (
      await request(app)
        .post(`/api/clients/${clientId}/evaluations`)
        .set('X-Test-Owner', randomUUID())
        .send(body())
    ).status,
    404
  );
  state.active = false;
  assert.equal(
    (
      await request(app)
        .post(`/api/clients/${clientId}/evaluations`)
        .send(body())
    ).status,
    403
  );
  assert.equal(state.rows.length, 0);
  assert(state.rollbacks > 0);
});

test('HU-023 migration is incremental, integrated and does not alter grants, roles, policies or rows', () => {
  const migration = readFileSync(
    new URL(
      '../../../docs/database/migrations/202611130001_evaluation_estimation_snapshots.sql',
      import.meta.url
    ),
    'utf8'
  );
  const schema = readFileSync(
    new URL(
      '../../../docs/database/schemas/identity_access.sql',
      import.meta.url
    ),
    'utf8'
  );
  const constraint = migration.slice(
    migration.indexOf(
      'ALTER TABLE private.client_evaluations\n  ADD CONSTRAINT'
    )
  );
  assert(schema.includes(constraint.trim()));
  assert(
    !/\b(?:GRANT|REVOKE|CREATE ROLE|ALTER ROLE|CREATE POLICY|DROP POLICY|TRUNCATE|INSERT INTO|UPDATE private|DELETE FROM)\b/i.test(
      migration
    )
  );
});

const candidateBody = (variant: 'male' | 'female' = 'male') => ({
  method: 'pliegues',
  equation: variant,
  effectiveDate: '2026-11-13',
  measurements: {
    pectoralSkinfoldMm: 10,
    abdominalSkinfoldMm: 15,
    thighSkinfoldMm: 20,
    tricepsSkinfoldMm: 12,
    suprailiacSkinfoldMm: 13,
  },
  estimationRequest: {
    methodId: 'jackson-pollock-3-siri',
    protocolId: `jp3-${variant}-candidate`,
    protocolVersion: 'technical-candidate-v1',
  },
});
async function withCandidates(work: () => Promise<void>) {
  const keys = [
    'NODE_ENV',
    'DATABASE_URL',
    'HU023_LOCAL_CANDIDATES_ENABLED',
  ] as const;
  const before = keys.map((k) => [k, process.env[k]] as const);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://127.0.0.1:5433/cof_hu023_unit',
    HU023_LOCAL_CANDIDATES_ENABLED: 'true',
  });
  try {
    await work();
  } finally {
    for (const [k, v] of before) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
test('HU-023 candidate gate is default off, server-only, loopback-only and never production', () => {
  const good = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://127.0.0.1:5433/cof_hu023_unit',
    HU023_LOCAL_CANDIDATES_ENABLED: 'true',
  };
  assert.equal(localCandidateEnvironment(good), true);
  for (const patch of [
    { HU023_LOCAL_CANDIDATES_ENABLED: undefined },
    { HU023_LOCAL_CANDIDATES_ENABLED: 'false' },
    { NODE_ENV: 'production' },
    { NODE_ENV: undefined },
    { DATABASE_URL: 'postgresql://remote.invalid:5433/fixture' },
    { DATABASE_URL: 'postgresql://127.0.0.1:0/fixture' },
    { DATABASE_URL: 'postgresql://127.0.0.1/fixture?host=remote.invalid' },
    { DATABASE_URL: 'invalid' },
  ])
    assert.equal(localCandidateEnvironment({ ...good, ...patch }), false);
  assert.equal(
    localCandidateTarget(
      { host: '127.0.0.1', port: 5433, database: 'cof_hu023_unit' },
      good
    ),
    true
  );
  for (const target of [
    { host: '203.0.113.1', port: 5433, database: 'cof_hu023_unit' },
    { host: '127.0.0.1', port: 5432, database: 'cof_hu023_unit' },
    { host: '127.0.0.1', port: 5433, database: 'other' },
  ])
    assert.equal(localCandidateTarget(target, good), false);
});
test('HU-023 local history projects the saved candidate separately from measurements', async () =>
  withCandidates(async () => {
    const { app, state } = fixture();
    for (const variant of ['male', 'female'] as const) {
      const payload = candidateBody(variant);
      const r = await request(app)
        .post(`/api/clients/${clientId}/evaluations`)
        .send(payload);
      assert.equal(r.status, 201);
      const a = r.body.evaluation.assessment,
        e = a.estimation;
      assert.equal(a.version, 'composition-candidate-v1');
      assert.equal(e.status, 'candidate_only');
      assert.equal(e.activationAllowed, false);
      assert.equal(e.scientificStatus, 'not_validated');
      assert.equal(e.formulaVersion, null);
      assert.equal(e.domainPolicyVersion, null);
      assert.equal(
        e.technicalFormulaVersion,
        'jp3-siri-arithmetic-candidate-v1'
      );
      assert.equal(
        e.technicalDomainVersion,
        'jp3-reference-ranges-candidate-v1'
      );
      assert.equal(e.inputs.ageYears, 36);
      assert.equal(Object.keys(e.inputs.skinfolds).length, 3);
      const sum = variant === 'male' ? 45 : 45;
      const density =
        variant === 'male'
          ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * 36
          : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * 36;
      assert.equal(e.result.bodyDensityGPerMl, density);
      assert.equal(e.result.estimatedBodyFatPercentage, 495 / density - 450);
      assert.deepEqual(a.results, {});
      assert.deepEqual(evolutionSample(r.body.evaluation as Evaluation).candidateBodyFat, {
        percentage: e.result.estimatedBodyFatPercentage,
        formulaVersion: e.technicalFormulaVersion,
        domainVersion: e.technicalDomainVersion,
      });
      assert.deepEqual(
        evolutionSample(r.body.evaluation as Evaluation).measurements,
        payload.measurements
      );
      assert.equal(
        'measuredBodyFatPercentage' in
          r.body.evaluation.assessment.measurements,
        false
      );
    }
    assert.equal(state.rows.length, 2);
    const read = await request(app).get(`/api/clients/${clientId}/evaluations`);
    assert.equal(
      read.body.evaluations[0].assessment.estimation.status,
      'candidate_only'
    );
  }));
test('HU-023 missing sites, no equation, outside provisional ages and disabled/remote targets save unavailable, never zero', async () =>
  withCandidates(async () => {
    const { app, state } = fixture();
    for (const patch of [
      { measurements: { bicepsSkinfoldMm: 10 } },
      { equation: 'not_applicable' },
      { effectiveDate: '2000-01-01' },
    ]) {
      const r = await request(app)
        .post(`/api/clients/${clientId}/evaluations`)
        .send({ ...candidateBody(), ...patch });
      assert.equal(r.status, 201);
      assert.equal(
        r.body.evaluation.assessment.estimation.status,
        'unavailable'
      );
      assert.equal(r.body.evaluation.assessment.estimation.result, null);
    }
    state.target.host = '203.0.113.1';
    let r = await request(app)
      .post(`/api/clients/${clientId}/evaluations`)
      .send(candidateBody());
    assert.equal(r.status, 201);
    assert.equal(r.body.evaluation.assessment.estimation.result, null);
    process.env.HU023_LOCAL_CANDIDATES_ENABLED = 'false';
    state.target.host = '127.0.0.1';
    r = await request(app)
      .post(`/api/clients/${clientId}/evaluations`)
      .send(candidateBody());
    assert.equal(r.status, 201);
    assert.equal(r.body.evaluation.assessment.estimation.status, 'unavailable');
    assert.equal(
      state.rows.every(
        (row) =>
          (row.assessment as { estimation: { result: unknown } }).estimation
            .result === null
      ),
      true
    );
  }));
test('HU-023 production blocks creation and redacts old candidates including idempotent replay without rewriting snapshots', async () =>
  withCandidates(async () => {
    const { app, state } = fixture();
    const key = randomUUID(),
      endpoint = `/api/clients/${clientId}/evaluations`;
    const first = await request(app)
      .post(endpoint)
      .set('Idempotency-Key', key)
      .send(candidateBody());
    assert.equal(
      first.body.evaluation.assessment.estimation.status,
      'candidate_only'
    );
    const stored = structuredClone(state.rows[0]);
    process.env.HU023_LOCAL_CANDIDATES_ENABLED = 'false';
    const disabledReplay = await request(app)
      .post(endpoint)
      .set('Idempotency-Key', key)
      .send(candidateBody());
    assert.equal(disabledReplay.status, 201);
    assert.equal(disabledReplay.headers['idempotent-replayed'], 'true');
    assert.equal(
      disabledReplay.body.evaluation.assessment.estimation.result,
      null
    );
    assert.equal(disabledReplay.body.evaluation.id, first.body.evaluation.id);
    const disabledList = await request(app).get(endpoint);
    assert.equal(
      disabledList.body.evaluations[0].assessment.estimation.result,
      null
    );
    assert.deepEqual(state.rows[0], stored);
    assert.equal(state.rows.length, 1);
    process.env.HU023_LOCAL_CANDIDATES_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    const replay = await request(app)
      .post(endpoint)
      .set('Idempotency-Key', key)
      .send(candidateBody());
    assert.equal(replay.status, 201);
    assert.equal(replay.headers['idempotent-replayed'], 'true');
    assert.equal(replay.body.evaluation.assessment.estimation.result, null);
    assert.equal(replay.body.evaluation.id, first.body.evaluation.id);
    assert.equal(state.rows.length, 1);
    const list = await request(app).get(endpoint);
    assert.equal(
      list.body.evaluations[0].assessment.estimation.status,
      'unavailable'
    );
    assert.equal(list.body.evaluations[0].assessment.estimation.result, null);
    assert.equal(evolutionSample(list.body.evaluations[0] as Evaluation).candidateBodyFat, undefined);
    assert.deepEqual(state.rows[0], stored);
    const next = await request(app)
      .post(endpoint)
      .send(candidateBody('female'));
    assert.equal(next.status, 201);
    assert.equal(next.body.evaluation.assessment.estimation.result, null);
  }));
test('HU-023 candidate requests reject mismatched protocols, forged results and invalid inputs; missing migration remains explicit', async () =>
  withCandidates(async () => {
    const { app, state } = fixture(),
      endpoint = `/api/clients/${clientId}/evaluations`;
    for (const payload of [
      { ...candidateBody(), equation: 'female' },
      { ...candidateBody(), activationAllowed: true },
      { ...candidateBody(), measurements: { pectoralSkinfoldMm: -1 } },
      {
        ...candidateBody(),
        estimationRequest: {
          ...candidateBody().estimationRequest,
          protocolVersion: 'approved-v1',
        },
      },
    ])
      assert.equal(
        (await request(app).post(endpoint).send(payload)).status,
        400
      );
    state.ready = false;
    assert.equal(
      (await request(app).post(endpoint).send(candidateBody())).status,
      503
    );
    assert.equal(state.rows.length, 0);
  }));

test('HU-023 candidate target follows configured URI/query/PGPORT/default ports without machine-specific constants', () => {
  const base = {
    NODE_ENV: 'development',
    HU023_LOCAL_CANDIDATES_ENABLED: 'true',
  };
  for (const port of [5432, 5433, 6543, 15432, 65535]) {
    const env = {
      ...base,
      DATABASE_URL: `postgresql://127.0.0.1:${port}/cof_hu023_unit`,
    };
    assert.equal(localCandidateEnvironment(env), true);
    assert.equal(
      localCandidateTarget(
        { host: '127.0.0.1', port, database: 'cof_hu023_unit' },
        env
      ),
      true
    );
    assert.equal(
      localCandidateTarget(
        {
          host: '127.0.0.1',
          port: port === 65535 ? 1 : port + 1,
          database: 'cof_hu023_unit',
        },
        env
      ),
      false
    );
    assert.equal(
      localCandidateEnvironment({ ...env, NODE_ENV: 'production' }),
      false
    );
    assert.equal(
      localCandidateEnvironment({
        ...env,
        HU023_LOCAL_CANDIDATES_ENABLED: undefined,
      }),
      false
    );
    assert.equal(
      localCandidateEnvironment({
        ...env,
        HU023_LOCAL_CANDIDATES_ENABLED: 'false',
      }),
      false
    );
  }
  const withoutPort = {
    ...base,
    DATABASE_URL: 'postgresql://localhost/cof_hu023_unit',
  };
  assert.equal(
    localCandidateTarget(
      { host: '::1', port: Number(defaults.port), database: 'cof_hu023_unit' },
      withoutPort
    ),
    true
  );
  assert.equal(
    localCandidateTarget(
      { host: '127.0.0.1', port: 7654, database: 'cof_hu023_unit' },
      { ...withoutPort, PGPORT: '7654' }
    ),
    true
  );
  assert.equal(
    localCandidateTarget(
      { host: '::1', port: 7655, database: 'cof_hu023_unit' },
      {
        ...base,
        DATABASE_URL: 'postgresql://[::1]:7655/cof_hu023_unit',
        PGPORT: '7654',
      }
    ),
    true
  );
  assert.equal(
    localCandidateTarget(
      { host: '127.0.0.1', port: 7656, database: 'cof_hu023_unit' },
      {
        ...base,
        DATABASE_URL: 'postgresql://127.0.0.1:7655/cof_hu023_unit?port=7656',
        PGPORT: '7654',
      }
    ),
    true
  );
  assert.equal(
    localCandidateEnvironment({ ...withoutPort, PGPORT: 'invalid' }),
    false
  );
  assert.equal(
    localCandidateEnvironment({ ...withoutPort, PGPORT: '65536' }),
    false
  );
  const template = readFileSync(
    new URL('../.env.example', import.meta.url),
    'utf8'
  );
  assert.match(template, /^HU023_LOCAL_CANDIDATES_ENABLED=false$/m);
});

test('HU-023 explicit candidates use the configured connection port and refuse a mismatched SQL target', async () =>
  withCandidates(async () => {
    const { app, state } = fixture();
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://127.0.0.1:7654/cof_hu023_unit';
    state.target.port = 7654;
    const endpoint = `/api/clients/${clientId}/evaluations`;
    const accepted = await request(app).post(endpoint).send(candidateBody());
    assert.equal(accepted.status, 201);
    assert.equal(
      accepted.body.evaluation.assessment.estimation.status,
      'candidate_only'
    );
    const stored = structuredClone(state.rows[0]);
    state.target.port = 7655;
    const denied = await request(app).post(endpoint).send(candidateBody());
    assert.equal(denied.status, 201);
    assert.equal(
      denied.body.evaluation.assessment.estimation.status,
      'unavailable'
    );
    assert.equal(denied.body.evaluation.assessment.estimation.result, null);
    assert.deepEqual(state.rows[0], stored);
  }));

test('HU-023 equation accepts only authorized strings without coercing arrays or other types', () => {
  const capture = {
    method: 'pliegues',
    measurements: { pectoralSkinfoldMm: 10 },
  };
  for (const equation of ['male', 'female', 'not_applicable'] as const) {
    assert.equal(
      assessmentInput({ ...capture, equation }, '2026-11-13').equation,
      equation
    );
  }
  for (const equation of [
    undefined,
    null,
    [],
    ['male'],
    ['female'],
    ['not_applicable'],
    {},
    { toString: () => 'male' },
    0,
    1,
    true,
    false,
    1n,
    Symbol('male'),
    () => 'male',
    '',
    'MALE',
    'unknown',
  ]) {
    assert.throws(
      () => assessmentInput({ ...capture, equation }, '2026-11-13'),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === 'INVALID_EVALUATION'
    );
  }
});

test('HU-023 HTTP rejects malformed equation types before evaluation persistence and preserves valid captures', async () => {
  const { app, state } = fixture();
  const endpoint = `/api/clients/${clientId}/evaluations`;
  for (const equation of [
    null,
    [],
    ['male'],
    ['female'],
    ['not_applicable'],
    {},
    0,
    1,
    true,
    false,
  ]) {
    const response = await request(app)
      .post(endpoint)
      .send({ ...candidateBody(), equation });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_EVALUATION');
  }
  const absent = { ...candidateBody() } as Record<string, unknown>;
  delete absent.equation;
  assert.equal((await request(app).post(endpoint).send(absent)).status, 400);
  assert.equal(state.rows.length, 0);
  assert.equal(state.rollbacks, 0);
  for (const equation of ['male', 'female', 'not_applicable']) {
    const response = await request(app)
      .post(endpoint)
      .send({
        method: 'pliegues',
        equation,
        measurements: { pectoralSkinfoldMm: 10 },
      });
    assert.equal(response.status, 201);
    assert.equal(response.body.evaluation.assessment.equation, equation);
    assert.equal(response.body.evaluation.assessment.estimation, undefined);
  }
  assert.equal(state.rows.length, 3);
});

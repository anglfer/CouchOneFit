import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
import { AuthError } from '../src/features/auth/types/errors.js'
import type { SessionIdentity } from '../src/features/auth/types/session.js'
import { compareEvolutionPositions } from '../src/features/evaluations/domain/evolution.js'

// No local .env, socket or real pool may be used by this suite.
process.env.AUTH_JWT_SECRET = 'hu022-only-synthetic-signing-key-'.repeat(2)
process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/never_used_hu022'
process.env.TEST_DATABASE_URL = process.env.DATABASE_URL
process.env.NODE_ENV = 'test'
mock.method(Pool.prototype, 'connect', async () => {
  throw new Error(
    'Real PostgreSQL connections forbidden in HU-022 double tests',
  )
})
mock.method(Pool.prototype, 'query', async () => {
  throw new Error('Real PostgreSQL queries forbidden in HU-022 double tests')
})
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const { getEvaluationHistory } =
  await import('../src/features/evaluations/services/evolution.js')

const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const pro = id(1),
  other = id(2),
  own = id(11),
  second = id(12),
  foreign = id(13)
const now = new Date('2026-11-12T12:00:00.000Z')
const actors = new Map<string, SessionIdentity>(
  [pro, other, id(3), id(4)].map((n, i) => [
    n,
    {
      id: n,
      sessionId: id(100 + i),
      role: i === 2 ? 'client' : i === 3 ? 'admin' : 'professional',
      username: 'synthetic',
      fullName: 'Synthetic',
      email: 'qa@example.com',
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    },
  ]),
)
const owners = new Map([
  [own, pro],
  [second, pro],
  [foreign, other],
])
const columns = [
  'weight_kg',
  'waist_cm',
  'hip_cm',
  'measured_body_fat_percentage',
  'pectoral_skinfold_mm',
  'abdominal_skinfold_mm',
  'triceps_skinfold_mm',
  'suprailiac_skinfold_mm',
  'thigh_skinfold_mm',
]
type Row = { evaluation: Record<string, unknown>; cursorCreatedAt: string }
function row(
  n: number,
  date: string,
  stamp: string,
  method?: string,
  clientId = own,
): Row {
  const e: Record<string, unknown> = {
    id: id(n),
    client_id: clientId,
    evaluation_date: '2026-11-11',
    created_at: stamp,
    ...Object.fromEntries(columns.map((k) => [k, null])),
    weight_kg: 70.1,
    assessment: null,
  }
  if (method) {
    const m =
      method === 'circumference'
        ? { weightKg: 70.1, waistCm: 80.1 }
        : method === 'skinfolds'
          ? { weightKg: 70.1, bicepsSkinfoldMm: 8.1 }
          : { weightKg: 70.1, measuredBodyFatPercentage: 25 }
    e.waist_cm = method === 'circumference' ? 80.1 : null
    e.measured_body_fat_percentage = method === 'bioimpedance' ? 25 : null
    e.assessment = {
      method,
      effectiveDate: date,
      equation: 'not_applicable',
      protocol: 'persisted-protocol',
      ownerId: owners.get(clientId),
      birthDate: '1990-01-01',
      ageYears: Number(date.slice(0, 4)) - 1990,
      version: 'composition-arithmetic-v1',
      measurements: m,
      provenance:
        method === 'bioimpedance' ? 'device_reported' : 'manual_measurements',
      results: {},
      calculationStatus: 'partial',
    }
  } else e.evaluation_date = date
  return { evaluation: e, cursorCreatedAt: stamp }
}
const fixtures = () => [
  row(25, '2026-11-03', '2026-11-11T00:00:00.000001Z', 'circumference'),
  row(22, '2026-11-02', '2026-11-11T00:00:00.000001Z', 'skinfolds'),
  row(21, '2026-11-02', '2026-11-11T00:00:00.000001Z', 'circumference'),
  row(24, '2026-11-01', '2026-11-11T00:00:00.000009Z'),
  row(23, '2026-11-02', '2026-11-11T00:00:00.000002Z', 'bioimpedance'),
  row(26, '2026-11-03', '2026-11-11T00:00:00.000001Z'),
  row(27, '2026-11-01', '2026-11-11T00:00:00.000001Z', undefined, foreign),
]
function historical(r: Row) {
  return String(
    (r.evaluation.assessment as { effectiveDate: string } | null)
      ?.effectiveDate ?? r.evaluation.evaluation_date,
  )
}
function storedMethod(r: Row) {
  return (r.evaluation.assessment as { method: string } | null)?.method ?? null
}
function profile(clientId: string, status: string, baseWeight: number) {
  return {
    id: clientId,
    fullName: 'Synthetic record',
    goal: null,
    status,
    version: 1,
    birthDate: '1990-01-01',
    heightCm: 180,
    baseWeightKg: baseWeight,
    baseBodyFatPercentage: null,
    waistCm: null,
    hipCm: null,
  }
}

/** Behavioral SQL double, not a PostgreSQL parser or proof of actual RLS execution. */
class DatabaseDouble {
  rows = fixtures()
  status = 'active'
  baseWeight = 80
  eligible = true
  revoked = false
  denyDuringHistory = false
  failHistory = false
  failProfile = false
  historyReads = 0
  releases = 0
  queries: { sql: string; args: unknown[]; subject: string | null }[] = []
  pool = {
    query: async (sql: string, args: unknown[] = []) => {
      // Existing invalid-session cleanup uses pool.query. Simulated, never persisted.
      assert(
        sql.includes('UPDATE private.sessions') && sql.includes('revoked_at'),
      )
      this.queries.push({ sql, args, subject: null })
      return { rows: [], rowCount: 0 }
    },
    connect: async () => {
      let subject: string | null = null
      return {
        release: () => {
          this.releases++
        },
        query: async (sql: string, args: unknown[] = []) => {
          this.queries.push({ sql, args, subject })
          const result = (rows: unknown[] = []) => ({
            rows,
            rowCount: rows.length,
          })
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return result()
          if (sql.includes('set_config')) {
            subject = String(args.length === 2 ? args[1] : args[0])
            return result()
          }
          if (sql.includes('SELECT a.id,a.username')) {
            assert.equal(subject, args[1])
            const a = actors.get(String(args[1]))
            return result(
              a && !this.revoked && a.sessionId === args[0] ? [a] : [],
            )
          }
          // Existing authentication cleanup is simulated only, never sent to a database.
          if (
            sql.includes('UPDATE private.sessions') &&
            sql.includes('revoked_at')
          )
            return result()
          if (sql.includes('SELECT u.id,u.role,u.password_hash')) {
            const a = actors.get(String(args[0]))
            assert.equal(subject, args[0])
            return result(a ? [a] : [])
          }
          if (sql.startsWith('SELECT id FROM private.sessions'))
            return result(!this.revoked ? [{ id: args[0] }] : [])
          if (sql.includes('private.training_professional')) {
            assert.equal(subject, args[0])
            return result([
              {
                allowed:
                  this.eligible &&
                  actors.get(subject!)?.role === 'professional',
              },
            ])
          }
          if (sql.includes('SELECT private.renew_subscription')) return result()
          if (sql.includes('c.full_name AS "fullName"')) {
            if (this.failProfile)
              throw new AuthError(
                503,
                'SERVICE_UNAVAILABLE',
                'Synthetic profile failure',
              )
            return result(
              owners.get(String(args[2])) === subject
                ? [profile(String(args[2]), this.status, this.baseWeight)]
                : [],
            )
          }
          if (sql.includes('SELECT c.id,c.time_zone'))
            return result(
              owners.get(String(args[0])) === subject
                ? [
                    {
                      id: args[0],
                      time_zone: 'America/Mexico_City',
                      version: 1,
                      status: this.status,
                      full_name: 'Synthetic record',
                    },
                  ]
                : [],
            )
          if (sql.includes('SELECT version_id,revision')) return result()
          if (sql.includes('SELECT c.id,c.status,c.birth_date')) {
            assert.equal(subject, args[1])
            return result(
              owners.get(String(args[0])) === subject
                ? [
                    {
                      id: args[0],
                      status: this.status,
                      birth_date: '1990-01-01',
                    },
                  ]
                : [],
            )
          }
          if (sql.includes('FROM private.client_evaluations e')) {
            this.historyReads++
            if (this.denyDuringHistory)
              throw new AuthError(
                403,
                'EVALUATION_FORBIDDEN',
                'Synthetic access denied',
              )
            if (this.failHistory)
              throw new AuthError(
                503,
                'SERVICE_UNAVAILABLE',
                'Synthetic history failure',
              )
            const [
              clientId,
              from,
              to,
              method,
              afterDate,
              afterStamp,
              afterId,
              limit,
            ] = args
            assert.equal(
              owners.get(String(clientId)),
              subject,
              'history must run under owning RLS subject',
            )
            assert(
              !/INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|OFFSET/.test(sql),
            )
            assert(sql.includes("AT TIME ZONE 'UTC'"))
            assert(sql.includes('HH24:MI:SS.US'))
            assert(
              sql.includes(
                'e.created_at,e.id)>($5::date,$6::timestamptz,$7::uuid)',
              ),
            )
            assert(sql.includes('e.created_at ASC,e.id ASC LIMIT $8'))
            const filtered = this.rows.filter(
              (r) =>
                r.evaluation.client_id === clientId &&
                (from === null || historical(r) >= String(from)) &&
                (to === null || historical(r) <= String(to)) &&
                (method === null ||
                  (method === 'legacy'
                    ? storedMethod(r) === null
                    : storedMethod(r) === method)) &&
                (afterDate === null ||
                  compareEvolutionPositions(
                    {
                      date: historical(r),
                      createdAt: r.cursorCreatedAt,
                      id: String(r.evaluation.id),
                    },
                    {
                      date: String(afterDate),
                      createdAt: String(afterStamp),
                      id: String(afterId),
                    },
                  ) > 0),
            )
            return result(
              [...filtered]
                .sort((a, b) =>
                  compareEvolutionPositions(
                    {
                      date: historical(a),
                      createdAt: a.cursorCreatedAt,
                      id: String(a.evaluation.id),
                    },
                    {
                      date: historical(b),
                      createdAt: b.cursorCreatedAt,
                      id: String(b.evaluation.id),
                    },
                  ),
                )
                .slice(0, Number(limit))
                .map((r) => structuredClone(r)),
            )
          }
          if (sql.includes('FROM private.client_evaluations')) {
            assert.equal(owners.get(String(args[0])), subject)
            return result(
              this.rows
                .filter((r) => r.evaluation.client_id === args[0])
                .map((r) => structuredClone(r.evaluation))
                .slice(0, 20),
            )
          }
          throw Error('Unexpected SQL in isolated double')
        },
      }
    },
  } as unknown as Pool
}
const http = (db: DatabaseDouble) => createApp(db.pool, { now: () => now })
async function access(actor = pro) {
  const a = actors.get(actor)!
  return signAccess(a.id, a.sessionId, { now })
}
async function get(
  db: DatabaseDouble,
  path = `/api/clients/${own}/evaluation-history`,
  actor = pro,
) {
  return request(http(db))
    .get(path)
    .set('Authorization', `Bearer ${await access(actor)}`)
}

test('HU-022 registered GET reads an authorized empty or single page, preserving dates, nulls and metadata', async () => {
  const db = new DatabaseDouble()
  db.rows = []
  let r = await get(db)
  assert.equal(r.status, 200)
  assert.equal(r.headers['cache-control'], 'no-store')
  assert.deepEqual(r.body.samples, [])
  assert.equal(r.body.pageInfo.hasMore, false)
  db.rows = [
    row(21, '2020-01-01', '2026-11-11T00:00:00.123456Z', 'circumference'),
  ]
  r = await get(db)
  assert.equal(r.status, 200)
  assert.equal(r.body.samples.length, 1)
  const s = r.body.samples[0]
  assert.equal(s.date, '2020-01-01')
  assert.equal(s.createdAt, '2026-11-11T00:00:00.123456Z')
  assert.equal(s.dateBasis, 'effective_date')
  assert.equal(s.clientId, own)
  assert.equal(s.source, 'professional_evaluation')
  assert.equal(s.method, 'perimetros')
  assert.equal(s.provenance, 'manual_measurements')
  assert.equal(s.measurements.waistCm, 80.1)
  assert(!('hipCm' in s.measurements))
  assert(!('birthDate' in s))
  assert(!('ownerId' in s))
  assert.equal(r.body.metricDefinitions.weightKg.unit, 'kg')
})

test('HU-022 complete keyset traversal preserves repeated dates, UUID ties, microseconds and retroactive evaluations', async () => {
  const db = new DatabaseDouble()
  const before = structuredClone(db.rows)
  const seen: string[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    const r = await get(
      db,
      `/api/clients/${own}/evaluation-history?pageSize=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    )
    assert.equal(r.status, 200)
    seen.push(...r.body.samples.map((s: { id: string }) => s.id))
    cursor = r.body.pageInfo.nextCursor
    assert.equal(r.body.pageInfo.hasMore, cursor !== null)
    assert(++pages < 5)
  } while (cursor)
  assert.deepEqual(seen, [24, 21, 22, 23, 25, 26].map(id))
  assert.equal(new Set(seen).size, 6)
  assert.equal(pages, 3)
  assert.deepEqual(db.rows, before)
  assert(db.queries.filter((q) => q.sql === 'COMMIT').length > 0)
  assert(db.releases > 0)
})

test('HU-022 inclusive filters select persisted method/origin without mixing legacy and snapshots', async () => {
  const db = new DatabaseDouble()
  const r = await get(
    db,
    `/api/clients/${own}/evaluation-history?from=2026-11-02&to=2026-11-02`,
  )
  assert.equal(r.status, 200)
  assert.deepEqual(
    r.body.samples.map((s: { id: string }) => s.id),
    [21, 22, 23].map(id),
  )
  for (const [method, wanted] of [
    ['legacy', [24, 26]],
    ['perimetros', [21, 25]],
    ['pliegues', [22]],
    ['bioimpedancia', [23]],
  ] as const) {
    const page = await get(
      db,
      `/api/clients/${own}/evaluation-history?method=${method}`,
    )
    assert.equal(page.status, 200)
    assert.deepEqual(
      page.body.samples.map((s: { id: string }) => s.id),
      wanted.map(id),
    )
    for (const sample of page.body.samples)
      assert.equal(sample.source, 'professional_evaluation')
    if (method === 'legacy') {
      assert.equal(page.body.samples[0].method, null)
      assert.equal(page.body.samples[0].provenance, null)
      assert.equal(page.body.samples[0].dateBasis, 'legacy_evaluation_date')
    }
    if (method === 'bioimpedancia')
      assert.equal(page.body.samples[0].provenance, 'device_reported')
  }
})

test('HU-022 rejects invalid period/cursor/unknown parameters without executing the history SELECT', async () => {
  for (const query of [
    'from=2026-02-30',
    'from=2026-12-01&to=2026-01-01',
    'pageSize=101',
    'cursor=broken',
    'method=unknown',
    'from[]=2026-01-01',
    'ownerId=forged',
  ]) {
    const db = new DatabaseDouble()
    const r = await get(db, `/api/clients/${own}/evaluation-history?${query}`)
    assert.equal(r.status, 400)
    assert.equal(r.body.error.code, 'INVALID_INPUT')
    assert.equal(db.historyReads, 0)
  }
})

test('HU-022 HMAC cursor cannot be altered, cross-filtered or replayed by a different actor/client', async () => {
  const db = new DatabaseDouble()
  const first = await get(
    db,
    `/api/clients/${own}/evaluation-history?pageSize=1`,
  )
  const c = first.body.pageInfo.nextCursor
  assert.equal(first.status, 200)
  for (const path of [
    `${own}/evaluation-history?pageSize=1&cursor=${encodeURIComponent(c + 'x')}`,
    `${own}/evaluation-history?pageSize=1&method=legacy&cursor=${encodeURIComponent(c)}`,
    `${second}/evaluation-history?pageSize=1&cursor=${encodeURIComponent(c)}`,
  ])
    assert.equal((await get(db, `/api/clients/${path}`)).status, 400)
  assert.equal(
    (
      await get(
        db,
        `/api/clients/${own}/evaluation-history?pageSize=1&cursor=${encodeURIComponent(c)}`,
        other,
      )
    ).status,
    400,
  )
})

test('HU-022 session/role/portfolio gates deny clients, admins, unrelated professionals and disabled actors', async () => {
  const db = new DatabaseDouble()
  assert.equal(
    (await request(http(db)).get(`/api/clients/${own}/evaluation-history`))
      .status,
    401,
  )
  assert.equal(
    (
      await request(http(db))
        .get(`/api/clients/${own}/evaluation-history`)
        .set('Authorization', 'Bearer invalid')
    ).status,
    401,
  )
  for (const actor of [id(3), id(4)])
    assert.equal((await get(db, undefined, actor)).status, 403)
  const denied = await get(db, undefined, other),
    missing = await get(db, `/api/clients/${id(999)}/evaluation-history`, other)
  assert.equal(denied.status, 404)
  assert.deepEqual(denied.body, missing.body)
  assert.equal(db.historyReads, 0)
  const authorizedOther = await get(
    db,
    `/api/clients/${foreign}/evaluation-history`,
    other,
  )
  assert.equal(authorizedOther.status, 200)
  assert.deepEqual(
    authorizedOther.body.samples.map((s: { id: string }) => s.id),
    [id(27)],
  )
  const cookie = await request(http(db))
    .get(`/api/clients/${own}/evaluation-history`)
    .set('Cookie', `cof_access=${await access()}`)
  assert.equal(cookie.status, 200)
  db.eligible = false
  assert.equal((await get(db)).status, 403)
  db.eligible = true
  db.revoked = true
  assert.equal((await get(db)).status, 401)
  await assert.rejects(
    getEvaluationHistory(db.pool, actors.get(id(3))!, own, {}, now),
    (e: unknown) => e instanceof AuthError && e.status === 403,
  )
})

test('HU-022 existing record composes available/empty/error without exposing denied history or duplicating bodyWeightHistory', async () => {
  const db = new DatabaseDouble()
  const path = `/api/clients/${own}/record`
  let r = await get(db, path)
  assert.equal(r.status, 200)
  assert.equal(r.body.record.sections.progress.status, 'available')
  assert.equal(r.body.record.sections.progress.history.samples.length, 6)
  assert.equal(r.body.record.sections.evaluations.status, 'available')
  assert.equal(r.body.record.sections.trainingPlan.status, 'empty')
  assert.equal(
    r.body.record.sections.bodyWeightHistory.status,
    'not_integrated',
  )
  db.rows = []
  r = await get(db, path)
  assert.equal(r.status, 200)
  assert.equal(r.body.record.sections.progress.status, 'empty')
  assert.deepEqual(r.body.record.sections.progress.history.samples, [])
  db.failHistory = true
  r = await get(db, path)
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.record.sections.progress, {
    status: 'error',
    code: 'QUERY_FAILED',
  })
  assert(!('history' in r.body.record.sections.progress))
  db.failHistory = false
  db.denyDuringHistory = true
  r = await get(db, path)
  assert.equal(r.status, 403)
  assert(!('record' in r.body))
  db.denyDuringHistory = false
  db.failProfile = true
  r = await get(db, path)
  assert.equal(r.status, 503)
})

test('HU-022 read preserves history across synthetic base edits and inactivation/reactivation; HU-021 list still works', async () => {
  const db = new DatabaseDouble()
  const original = structuredClone(db.rows)
  const initial = await get(db)
  for (const status of ['inactive', 'active']) {
    db.status = status
    db.baseWeight = 99.9
    const r = await get(db)
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.samples, initial.body.samples)
    const record = await get(db, `/api/clients/${own}/record`)
    assert.equal(record.body.record.profile.baseWeightKg, 99.9)
    assert.deepEqual(
      record.body.record.sections.progress.history.samples,
      initial.body.samples,
    )
  }
  const list = await get(db, `/api/clients/${own}/evaluations`)
  assert.equal(list.status, 200)
  assert.equal(list.body.evaluations.length, 6)
  assert.equal(typeof list.body.evaluations[0].createdAt, 'string')
  assert(Number.isFinite(Date.parse(list.body.evaluations[0].createdAt)))
  assert.deepEqual(db.rows, original)
})

test('HU-022 read failure rolls back/releases, returns 503 and does not invent empty success', async () => {
  const db = new DatabaseDouble()
  db.failHistory = true
  const r = await get(db)
  assert.equal(r.status, 503)
  assert(!('samples' in r.body))
  assert(db.queries.some((q) => q.sql === 'ROLLBACK'))
  assert(db.releases > 0)
})

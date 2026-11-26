import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { argon2id, hash } from 'argon2'
import { Pool } from 'pg'
import request from 'supertest'

process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
process.env.CORS_ORIGIN = 'http://localhost:5000'
process.env.OBSERVABILITY_INGEST_SECRET = 'obs-ingest-secret-at-least-24-chars'
process.env.OBSERVABILITY_ENV = 'production'

const { createApp, closeObservabilityLogSink } = await import('../src/app.js')

const value = process.env.TEST_DATABASE_URL
if (
  !value ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)
) {
  throw new Error('Se requiere base local exclusiva de pruebas')
}

const pool = new Pool({ connectionString: value })
const restrictedPool = new Pool({
  connectionString: value,
  options: '-c role=couchone_authentication',
})
const run = randomBytes(6).toString('hex')
const password = randomBytes(24).toString('base64url')
const origin = 'http://localhost:5000'
const base = '/api/admin/observability/sla-v3'
const token = process.env.OBSERVABILITY_INGEST_SECRET

const cookie = (r: request.Response, name: string) =>
  ((r.headers['set-cookie'] as unknown as string[]) ?? [])
    .find((v) => v.startsWith(`${name}=`))
    ?.split(';')[0] ?? ''

type App = ReturnType<typeof createApp>

async function login(app: App, identifier: string) {
  const csrf = await request(app).get('/api/auth/csrf')
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', origin)
    .set('Cookie', cookie(csrf, 'cof_csrf'))
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ identifier, password })
  assert.equal(res.status, 200)
  return `${cookie(res, 'cof_access')}; ${cookie(res, 'cof_refresh')}`
}

/** Sends a write with the CSRF double-submit pair, optionally omitting the header. */
async function write(
  app: App,
  method: 'post' | 'delete',
  path: string,
  session: string,
  body: object,
  withCsrf = true,
) {
  const csrf = await request(app).get('/api/auth/csrf')
  const req = request(app)
    [method](path)
    .set('Origin', origin)
    .set('Cookie', `${cookie(csrf, 'cof_csrf')}; ${session}`)
  if (withCsrf) req.set('X-CSRF-Token', csrf.body.csrfToken)
  return req.send(body)
}

before(async () => {
  const digest = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallellism: 1,
  } as Parameters<typeof hash>[1])
  for (const role of ['admin', 'professional']) {
    const {
      rows: [row],
    } = await pool.query(
      'INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
      [`sla.${role}.${run}`, `sla.${role}.${run}@example.com`, digest, role],
    )
    if (role === 'professional') {
      await pool.query(
        'INSERT INTO private.professionals (user_id,full_name) VALUES ($1,$2)',
        [row.id, 'Pro SLA'],
      )
    }
  }
})

after(async () => {
  await closeObservabilityLogSink()
  await restrictedPool.end()
  await pool.end()
})

test('SLA v3 admin endpoints are admin-only and writes require CSRF', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: false })
  const proSession = await login(app, `sla.professional.${run}`)
  const adminSession = await login(app, `sla.admin.${run}`)

  for (const path of [
    `${base}/report`,
    `${base}/records`,
    `${base}/export/requests.csv`,
    `${base}/export/probes.csv`,
    `${base}/export/incidents.csv`,
    `${base}/export/operations.csv`,
  ]) {
    assert.equal((await request(app).get(path)).status, 401, path)
    assert.equal((await request(app).get(path).set('Cookie', proSession)).status, 403, path)
  }
  const body = {
    kind: 'backup',
    occurredAt: new Date().toISOString(),
    details: { ok: true },
  }
  assert.equal((await write(app, 'post', `${base}/records`, proSession, body)).status, 403)
  const noCsrf = await write(app, 'post', `${base}/records`, adminSession, body, false)
  assert.ok([401, 403].includes(noCsrf.status))
})

test('SLA v3 records can be created, listed, validated and deleted; report has 67 SLIs', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: false })
  const admin = await login(app, `sla.admin.${run}`)
  const now = new Date()

  const created = await write(app, 'post', `${base}/records`, admin, {
    kind: 'support_incident',
    occurredAt: now.toISOString(),
    endedAt: null,
    details: {
      severity: 'media',
      acknowledgedAt: null,
      cause: 'Falla de prueba',
      attributable: false,
      requiresRestore: false,
    },
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const id: string = created.body.record.id
  assert.equal(created.body.record.kind, 'support_incident')
  assert.equal(created.body.record.source, 'admin')

  const backup = await write(app, 'post', `${base}/records`, admin, {
    kind: 'backup',
    occurredAt: now.toISOString(),
    details: { ok: true },
  })
  assert.equal(backup.status, 201)

  for (const invalid of [
    { kind: 'nope', occurredAt: now.toISOString(), details: {} },
    { kind: 'backup', occurredAt: 'ayer', details: { ok: true } },
    { kind: 'backup', occurredAt: now.toISOString(), details: {} },
    { kind: 'backup', environment: 'moon', occurredAt: now.toISOString(), details: { ok: true } },
    { kind: 'monthly_report', occurredAt: now.toISOString(), details: { period: '2026-13' } },
    { kind: 'storage_measurement', occurredAt: now.toISOString(), details: { bytes: 1, limitBytes: 0 } },
  ]) {
    const res = await write(app, 'post', `${base}/records`, admin, invalid)
    assert.equal(res.status, 400, JSON.stringify(invalid))
    assert.equal(res.body.error.code, 'VALIDATION_ERROR')
  }

  const listed = await request(app).get(`${base}/records`).set('Cookie', admin).expect(200)
  assert.ok(listed.body.records.some((r: { id: string }) => r.id === id))
  assert.equal(
    (await request(app).get(`${base}/records?month=2026-1`).set('Cookie', admin)).status,
    400,
  )

  const reportRes = await request(app).get(`${base}/report`).set('Cookie', admin).expect(200)
  assert.equal(reportRes.body.report.version, '3.0')
  assert.equal(reportRes.body.report.slis.length, 67)
  assert.ok(reportRes.body.report.incidents.some((i: { id: string }) => i.id === id))
  assert.equal(
    (await request(app).get(`${base}/report?environment=moon`).set('Cookie', admin)).status,
    400,
  )

  const storage = await write(app, 'post', `${base}/storage`, admin, { limitBytes: 524288000 })
  assert.equal(storage.status, 201)
  assert.ok(storage.body.record.details.bytes > 0)
  assert.equal(storage.body.record.details.limitBytes, 524288000)

  // The web client sends DELETE with a JSON body `{}`.
  assert.equal((await write(app, 'delete', `${base}/records/${id}`, admin, {})).status, 204)
  assert.equal((await write(app, 'delete', `${base}/records/${id}`, admin, {})).status, 404)
  assert.equal((await write(app, 'delete', `${base}/records/not-a-uuid`, admin, {})).status, 400)

  const audit = await pool.query(
    "SELECT action FROM private.observability_audit_log WHERE entity_type = 'sla_record' AND entity_id = $1 ORDER BY created_at",
    [id],
  )
  assert.deepEqual(audit.rows.map((r) => r.action), ['created', 'deleted'])
})

test('requests.csv exports logged requests with uptime and SLA route notation', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: true })
  const admin = await login(app, `sla.admin.${run}`)
  await request(app).get('/api/plans').expect(200)
  await pool.query(
    `INSERT INTO private.observability_logs
       (correlation_id, environment, service, module, source, event_type, severity, operation,
        normalized_path, http_method, status_code, duration_ms, outcome, metadata)
     VALUES ($1, 'production', 'api', 'clients', 'operational', 'http.request', 'info',
             'GET /api/clients/:id', '/api/clients/:id', 'GET', 200, 12.5, 'success',
             '{"uptimeS": 4321}'::jsonb)`,
    [randomUUID()],
  )
  await closeObservabilityLogSink()

  const res = await request(app).get(`${base}/export/requests.csv`).set('Cookie', admin).expect(200)
  assert.match(res.headers['content-type'], /text\/csv; charset=utf-8/)
  const month = new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 7)
  assert.equal(
    res.headers['content-disposition'],
    `attachment; filename="requests-${month}.csv"`,
  )
  const lines = res.text.trim().split('\n')
  assert.equal(lines[0], 'ts,method,route,status,duration_ms,uptime_s,in_maintenance')
  assert.ok(
    lines.some((l) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z,GET,\/api\/clients\/:clientId,200,12.5,4321,no$/.test(l)),
    'SLA route notation row',
  )
  const plans = lines.filter((l) => l.includes(',GET,/api/plans,200,')).at(-1)
  assert.ok(plans, 'logged /api/plans request')
  const uptime = plans.split(',')[5]
  assert.ok(Number(uptime) >= 0 && uptime !== '', 'uptime recorded in the log')

  for (const [name, header] of [
    ['probes', 'ts,target,status,duration_ms,content_ok,cold_start'],
    ['incidents', 'id,severidad,recibido,acuse,resuelto,causa,atribuible'],
    ['operations', 'fecha,tipo,resultado,responsable,detalle'],
  ]) {
    const csv = await request(app).get(`${base}/export/${name}.csv`).set('Cookie', admin).expect(200)
    assert.equal(csv.text.split('\n')[0], header)
    assert.match(csv.headers['content-disposition'], new RegExp(`${name}-${month}\\.csv`))
  }
})

test('operations endpoint needs the ingest token and is idempotent by externalId', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: false })
  const externalId = `backup-${run}`
  const payload = {
    environment: 'production',
    kind: 'backup',
    occurredAt: new Date().toISOString(),
    details: { ok: true, responsible: 'cron', sizeBytes: 1024 },
    externalId,
  }
  assert.equal((await request(app).post('/api/observability/operations').send(payload)).status, 401)
  assert.equal(
    (await request(app).post('/api/observability/operations').set('X-Observability-Token', 'wrong').send(payload)).status,
    401,
  )
  const first = await request(app).post('/api/observability/operations').set('X-Observability-Token', token).send(payload)
  assert.equal(first.status, 201, JSON.stringify(first.body))
  assert.equal(first.body.duplicate, false)
  assert.equal(first.body.record.kind, 'backup')
  assert.equal(first.body.record.source, 'automation')
  const second = await request(app).post('/api/observability/operations').set('X-Observability-Token', token).send(payload)
  assert.equal(second.status, 200)
  assert.equal(second.body.duplicate, true)
  assert.equal(second.body.record.id, first.body.record.id)
  assert.equal(
    (await pool.query('SELECT 1 FROM private.observability_sla_records WHERE external_id = $1', [externalId])).rowCount,
    1,
  )
  for (const bad of [
    { ...payload, kind: 'support_incident', externalId: `${externalId}-k` },
    { ...payload, externalId: undefined },
    { ...payload, externalId: 'has space' },
    { ...payload, details: { ok: 'yes' }, externalId: `${externalId}-d` },
  ]) {
    const res = await request(app).post('/api/observability/operations').set('X-Observability-Token', token).send(bad)
    assert.equal(res.status, 400, JSON.stringify(bad))
  }
})

test('/api/ready, /api/health/ready and /api/health report uptimeS', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: false })
  for (const path of ['/api/ready', '/api/health/ready']) {
    const res = await request(app).get(path).expect(200)
    assert.equal(res.body.status, 'ok')
    assert.equal(res.body.database, 'ok')
    assert.ok(Number.isInteger(res.body.uptimeS) && res.body.uptimeS >= 0)
  }
  const health = await request(app).get('/api/health').expect(200)
  assert.ok(Number.isInteger(health.body.uptimeS))
})

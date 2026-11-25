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
const { signAccess } = await import('../src/features/auth/services/tokens.js')

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
const ids = new Map<string, string>()

const cookie = (r: request.Response, name: string) =>
  ((r.headers['set-cookie'] as unknown as string[]) ?? [])
    .find((v) => v.startsWith(`${name}=`))
    ?.split(';')[0] ?? ''

async function postWithSession(
  app: ReturnType<typeof createApp>,
  method: 'post' | 'put' | 'patch',
  path: string,
  body: object,
  session?: request.Response,
) {
  const csrf = await request(app).get('/api/auth/csrf')
  const req = request(app)[method](path)
  return req
    .set('Origin', origin)
    .set(
      'Cookie',
      [
        cookie(csrf, 'cof_csrf'),
        session && cookie(session, 'cof_access'),
        session && cookie(session, 'cof_refresh'),
      ]
        .filter(Boolean)
        .join('; '),
    )
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send(body)
}

before(async () => {
  const digest = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallellism: 1,
  } as Parameters<typeof hash>[1])
  for (const role of ['admin', 'professional', 'client']) {
    const {
      rows: [row],
    } = await pool.query(
      'INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
      [`obs.${role}.${run}`, `obs.${role}.${run}@example.com`, digest, role],
    )
    ids.set(role, row.id)
    if (role === 'professional') {
      await pool.query(
        'INSERT INTO private.professionals (user_id,full_name) VALUES ($1,$2)',
        [row.id, 'Pro Observabilidad'],
      )
    }
  }
})

after(async () => {
  await closeObservabilityLogSink()
  await restrictedPool.end()
  await pool.end()
})

test('observability endpoints enforce admin role, RLS isolation, and ingest token', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: false })

  assert.equal(
    (await request(app).get('/api/admin/observability/dashboard')).status,
    401,
  )
  assert.equal(
    (await request(app).post('/api/observability/ingest').send({})).status,
    401,
  )
  assert.equal(
    (
      await request(app)
        .get('/api/observability/monitor-config')
        .set('X-Observability-Token', 'wrong-token')
    ).status,
    401,
  )

  const proSession = await postWithSession(app, 'post', '/api/auth/login', {
    identifier: `obs.professional.${run}`,
    password,
  })
  assert.equal(proSession.status, 200)
  const proAccess = cookie(proSession, 'cof_access')

  for (const endpoint of [
    '/api/admin/observability/dashboard',
    '/api/admin/observability/logs',
    '/api/admin/observability/slis',
    '/api/admin/observability/slos',
    '/api/admin/observability/slas',
    '/api/admin/observability/checks',
    '/api/admin/observability/incidents',
    '/api/admin/observability/reports',
  ]) {
    assert.equal(
      (await request(app).get(endpoint).set('Cookie', proAccess)).status,
      403,
    )
  }

  // Client token also rejected with 403
  const {
    rows: [clientRow],
  } = await pool.query(
    'INSERT INTO private.clients (professional_id, user_id, full_name) SELECT p.id, $1, $2 FROM private.professionals p WHERE p.user_id = $3 RETURNING id',
    [ids.get('client'), 'Cliente Obs', ids.get('professional')],
  )
  assert.ok(clientRow.id)
  const {
    rows: [clientSess],
  } = await pool.query(
    'INSERT INTO private.sessions (user_id) VALUES ($1) RETURNING id',
    [ids.get('client')],
  )
  const clientToken = await signAccess(ids.get('client')!, clientSess.id)
  assert.equal(
    (
      await request(app)
        .get('/api/admin/observability/dashboard')
        .set('Authorization', `Bearer ${clientToken}`)
    ).status,
    403,
  )

  // RLS blocks direct table reads and admin_access_events_page for non-admin subjects
  const clientDb = await restrictedPool.connect()
  try {
    await clientDb.query('BEGIN')
    await clientDb.query("SELECT set_config('app.subject_id', $1, true)", [
      ids.get('professional'),
    ])
    const directLogs = await clientDb.query(
      'SELECT * FROM private.observability_logs',
    )
    assert.equal(directLogs.rowCount, 0)
    await assert.rejects(
      clientDb.query(
        'SELECT * FROM private.admin_access_events_page(NULL, NULL, NULL, 10, 0)',
      ),
      /OBSERVABILITY_FORBIDDEN/,
    )
    await clientDb.query('ROLLBACK')
  } finally {
    clientDb.release()
  }
})

test('persistent logging, correlation, CSV/JSON export, dynamic SLI/SLO/SLA, ingest idempotency, and incidents work end-to-end', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: true })

  const adminSession = await postWithSession(app, 'post', '/api/auth/login', {
    identifier: `obs.admin.${run}`,
    password,
  })
  assert.equal(adminSession.status, 200)
  const adminAccess = cookie(adminSession, 'cof_access')

  // 1. Real operational request with correlation id & sanitized failure
  const corrId = randomUUID()
  const plansRes = await request(app)
    .get('/api/plans')
    .set('X-Request-Id', corrId)
    .expect(200)
  assert.equal(plansRes.headers['x-request-id'], corrId)

  const ceRes = await postWithSession(
    app,
    'post',
    '/api/observability/client-events',
    {
      environment: 'production',
      client: 'web',
      eventType: 'client.sync_failed',
      module: 'offline_sync',
      operation: 'training.save',
      errorCode: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    },
    adminSession,
  )
  assert.equal(ceRes.status, 202)

  // Flush sink before querying logs
  await closeObservabilityLogSink()

  const logsRes = await request(app)
    .get(`/api/admin/observability/logs?environment=production&correlationId=${corrId}`)
    .set('Cookie', adminAccess)
    .expect(200)
  assert.ok(logsRes.body.items.length >= 1)
  const firstLog = logsRes.body.items[0]
  assert.equal(firstLog.correlationId, corrId)
  assert.equal(firstLog.module, 'plans')

  const detailRes = await request(app)
    .get(`/api/admin/observability/logs/${firstLog.id}`)
    .set('Cookie', adminAccess)
    .expect(200)
  assert.equal(detailRes.body.item.id, firstLog.id)
  assert.ok(detailRes.body.related.length >= 1)

  const csvRes = await request(app)
    .get('/api/admin/observability/logs/export?environment=production&format=csv')
    .set('Cookie', adminAccess)
    .expect(200)
  assert.match(csvRes.headers['content-type'], /text\/csv/)
  assert.match(csvRes.text, /correlationId/)

  // 2. Dynamic SLI & SLO (including training < 1000 ms threshold example) + versioning
  const sliCreate = await postWithSession(
    app,
    'post',
    '/api/admin/observability/slis',
    {
      code: `training_under_1s_${run}`,
      name: 'Consultas de entrenamiento bajo 1000 ms',
      description: 'Porcentaje de consultas en training respondidas en menos de 1000 ms.',
      service: 'api',
      characteristic: 'Latencia de entrenamiento',
      dataSource: 'operational_http',
      indicatorType: 'latency_threshold_pct',
      unit: '%',
      calculationMethod: { thresholdMs: 1000, module: 'training' },
      inclusionCriteria: 'Consultas del módulo training.',
      exclusionCriteria: 'Endpoints /api/health.',
      evaluationPeriod: '7d',
    },
    adminSession,
  )
  assert.equal(sliCreate.status, 201)
  const sliId = sliCreate.body.sli.id as string

  const sloCreate = await postWithSession(
    app,
    'post',
    '/api/admin/observability/slos',
    {
      code: `slo_training_1s_${run}`,
      sliId,
      name: '95% de consultas de entrenamiento < 1000 ms (7d)',
      description: 'Objetivo interno para consultas válidas de entrenamiento.',
      targetValue: 95,
      comparisonOperator: '>=',
      unit: '%',
      evaluationPeriod: '7d',
      minSamples: 2,
      status: 'active',
    },
    adminSession,
  )
  assert.equal(sloCreate.status, 201)
  const sloId = sloCreate.body.slo.id as string

  // Without training logs, SLO must report insufficient_data (never 100%)
  const slosBefore = await request(app)
    .get('/api/admin/observability/slos?environment=production&period=7d')
    .set('Cookie', adminAccess)
    .expect(200)
  const createdSloBefore = slosBefore.body.items.find(
    (s: { id: string }) => s.id === sloId,
  )
  assert.equal(createdSloBefore.complianceStatus, 'insufficient_data')

  // Insert real training HTTP logs in production (2 fast < 1000 ms)
  await pool.query(
    'SELECT private.insert_observability_logs($1::jsonb)',
    [
      JSON.stringify([
        {
          correlationId: `tr-1-${run}`,
          occurredAt: new Date().toISOString(),
          environment: 'production',
          service: 'api',
          module: 'training',
          source: 'operational',
          eventType: 'http.request',
          severity: 'info',
          operation: 'GET /api/training/exercises',
          normalizedPath: '/api/training/exercises',
          httpMethod: 'GET',
          statusCode: 200,
          durationMs: 42.5,
          outcome: 'success',
        },
        {
          correlationId: `tr-2-${run}`,
          occurredAt: new Date().toISOString(),
          environment: 'production',
          service: 'api',
          module: 'training',
          source: 'operational',
          eventType: 'http.request',
          severity: 'info',
          operation: 'GET /api/training/clients',
          normalizedPath: '/api/training/clients',
          httpMethod: 'GET',
          statusCode: 200,
          durationMs: 115.2,
          outcome: 'success',
        },
      ]),
    ],
  )

  const evalRes = await postWithSession(
    app,
    'post',
    '/api/admin/observability/slos/evaluate',
    { environment: 'production', period: '7d' },
    adminSession,
  )
  assert.equal(evalRes.status, 200)
  const evaluatedSlo = evalRes.body.items.find(
    (s: { id: string }) => s.id === sloId,
  )
  assert.equal(evaluatedSlo.observedValue, 100)
  assert.equal(evaluatedSlo.complianceStatus, 'met')

  // Environment isolation: 'local' has no training logs so it remains insufficient_data
  const slosLocal = await request(app)
    .get('/api/admin/observability/slos?environment=local&period=7d')
    .set('Cookie', adminAccess)
    .expect(200)
  const localSlo = slosLocal.body.items.find(
    (s: { id: string }) => s.id === sloId,
  )
  assert.equal(localSlo.complianceStatus, 'insufficient_data')

  // Updating SLO creates v2 while preserving v1 history
  const sloUpdate = await postWithSession(
    app,
    'put',
    `/api/admin/observability/slos/${sloId}`,
    {
      sliId,
      name: '98% de consultas de entrenamiento < 1000 ms (7d)',
      description: 'Ajuste estricto para validar versionado.',
      targetValue: 98,
      comparisonOperator: '>=',
      unit: '%',
      evaluationPeriod: '7d',
      minSamples: 2,
      status: 'active',
      changeReason: 'Ajuste de prueba',
    },
    adminSession,
  )
  assert.equal(sloUpdate.status, 200)
  assert.equal(sloUpdate.body.slo.currentVersion, 2)

  const sloHistory = await request(app)
    .get(`/api/admin/observability/slos/${sloId}/history?environment=production`)
    .set('Cookie', adminAccess)
    .expect(200)
  assert.equal(sloHistory.body.versions.length, 2)
  assert.ok(sloHistory.body.evaluations.length >= 1)

  // 3. SLA registration linked to SLO
  const slaCreate = await postWithSession(
    app,
    'post',
    '/api/admin/observability/slas',
    {
      name: `Acuerdo de prueba ${run}`,
      coveredService: 'API de Entrenamiento',
      commitments: '98% de consultas por debajo de 1 segundo.',
      approvalStatus: 'internal_reference',
      effectiveFrom: new Date(Date.now() - 86_400_000).toISOString(),
      responsibilities: 'Equipo de plataforma.',
      exclusions: 'Ventanas programadas.',
      sloIds: [sloId],
    },
    adminSession,
  )
  assert.equal(slaCreate.status, 201)

  const slasRes = await request(app)
    .get('/api/admin/observability/slas?environment=production&period=7d')
    .set('Cookie', adminAccess)
    .expect(200)
  const createdSla = slasRes.body.items.find(
    (a: { id: string }) => a.id === slaCreate.body.id,
  )
  // Version 2 applies from the edit. Earlier measurements stay in version 1.
  assert.equal(createdSla.observedCompliance, 'insufficient_data')
  assert.equal(createdSla.slos[0].currentVersion, 2)

  // 4. Manual checks + settings + idempotent external ingest + incident deduplication & recovery
  const manualRun = await postWithSession(
    app,
    'post',
    '/api/admin/observability/checks/run',
    {
      environment: 'production',
      checkKeys: ['api_liveness', 'api_db_readiness', 'func_plans_catalog'],
    },
    adminSession,
  )
  assert.equal(manualRun.status, 200)
  assert.equal(manualRun.body.checks.length, 3)
  const wrongEnvironment = await postWithSession(
    app, 'post', '/api/admin/observability/checks/run',
    { environment: 'local', checkKeys: ['api_liveness'] }, adminSession,
  )
  assert.equal(wrongEnvironment.status, 400)
  const checks = await request(app)
    .get(`/api/admin/observability/checks?environment=production&period=1h&pageSize=1&runId=${manualRun.body.runId}`)
    .set('Cookie', adminAccess)
    .expect(200)
  assert.equal(checks.body.runtimeEnvironment, 'production')
  assert.equal(checks.body.pageSize, 1)
  assert.ok(checks.body.totalRuns >= 1)
  assert.equal(checks.body.latestChecks.length, 3)

  // Use fresh timestamps in a test environment so recovery samples from the
  // previous run cannot land between these two consecutive failures.
  const incidentEnvironment = 'local'
  let lastObservation = 0
  const observation = (passed: boolean, checkKey = 'web_availability') => {
    lastObservation = Math.max(Date.now(), lastObservation + 1)
    const at = new Date(lastObservation).toISOString()
    const externalRunId = randomUUID()
    return {
      run: {
        externalRunId,
        category: 'synthetic_periodic',
        environment: incidentEnvironment,
        triggerSource: 'external_cli',
        status: passed ? 'passed' : 'failed',
        startedAt: new Date(lastObservation - 420).toISOString(),
        finishedAt: at,
        durationMs: 420,
      },
      checks: [{
        externalEventId: randomUUID(),
        correlationId: externalRunId,
        checkKey,
        checkName: 'Disponibilidad Web',
        checkKind: 'synthetic_availability',
        service: 'web',
        module: 'web',
        environment: incidentEnvironment,
        target: '/',
        executedAt: at,
        expectedResult: 'HTTP 200',
        actualResult: passed ? 'HTTP 200' : 'HTTP 503',
        status: passed ? 'passed' : 'failed',
        durationMs: 420,
        httpStatus: passed ? 200 : 503,
        errorCode: passed ? null : 'HTTP_503',
        errorMessage: passed ? null : 'Servicio Web caído',
      }],
    }
  }
  const ingest = (payload: ReturnType<typeof observation>) => request(app)
    .post('/api/observability/ingest')
    .set('X-Observability-Token', process.env.OBSERVABILITY_INGEST_SECRET!)
    .send(payload)
  const listOutages = async (status: 'open' | 'resolved') => {
    const response = await request(app)
      .get(`/api/admin/observability/incidents?environment=${incidentEnvironment}&status=${status}`)
      .set('Cookie', adminAccess)
      .expect(200)
    return response.body.items.filter(
      (incident: { service: string; incidentType: string }) =>
        incident.service === 'web' && incident.incidentType === 'service_outage',
    )
  }

  await ingest(observation(true)).expect(201)
  assert.equal((await listOutages('open')).length, 0)

  const firstFailure = observation(false)
  const inserted = await ingest(firstFailure).expect(201)
  assert.equal(inserted.body.insertedChecks, 1)
  const firstOutages = await listOutages('open')
  assert.equal(firstOutages.length, 1)
  const [firstOutage] = firstOutages
  assert.equal(firstOutage.occurrenceCount, 1)

  const historySize = async () => (
    await pool.query('SELECT count(*)::integer AS size FROM private.observability_slo_evaluations WHERE environment = $1 AND evaluated_at = $2', [
      incidentEnvironment, firstFailure.run.finishedAt,
    ])
  ).rows[0].size
  const initialHistorySize = await historySize()
  const replay = await ingest(firstFailure).expect(201)
  assert.equal(replay.body.insertedChecks, 0)
  assert.equal(replay.body.duplicateChecks, 1)
  assert.equal(await historySize(), initialHistorySize)
  assert.deepEqual(await listOutages('open'), firstOutages)

  await ingest({
    run: firstFailure.run,
    checks: [{ ...firstFailure.checks[0], environment: 'production' }],
  }).expect(400)

  const secondFailure = observation(false)
  await ingest(secondFailure).expect(201)
  const outages = await listOutages('open')
  assert.equal(outages.length, 1)
  const [outage] = outages
  assert.equal(outage.id, firstOutage.id)
  assert.equal(outage.occurrenceCount, 2)
  assert.equal(outage.lastSeenAt, secondFailure.run.finishedAt)

  // A more recent proxy check does not recover Web liveness.
  await ingest(observation(true, 'web_proxy_readiness')).expect(201)
  assert.deepEqual(await listOutages('open'), outages)
  const failingDashboard = await request(app)
    .get(`/api/admin/observability/dashboard?environment=${incidentEnvironment}&service=web`)
    .set('Cookie', adminAccess)
    .expect(200)
  assert.equal(failingDashboard.body.services[0].state, 'unavailable')

  const recovery = observation(true)
  await ingest(recovery).expect(201)
  assert.equal((await listOutages('open')).length, 0)
  const resolved = (await listOutages('resolved')).find(
    (incident: { id: string }) => incident.id === outage.id,
  )
  assert.equal(resolved?.resolvedAt, recovery.run.finishedAt)
  assert.ok(typeof resolved.recoveryDurationS === 'number')
  assert.equal(resolved.occurrenceCount, 2)

  // Replaying the outage after recovery also leaves it closed.
  assert.equal((await ingest(secondFailure).expect(201)).body.insertedChecks, 0)
  assert.equal((await listOutages('open')).length, 0)

  // 5. Report & maintenance & audit log
  const reportRes = await request(app)
    .get('/api/admin/observability/reports?environment=production&period=7d')
    .set('Cookie', adminAccess)
    .expect(200)
  assert.match(reportRes.body.markdown, /# Reporte de Observabilidad/)

  const auditRes = await request(app)
    .get('/api/admin/observability/audit')
    .set('Cookie', adminAccess)
    .expect(200)
  assert.ok(auditRes.body.items.length >= 3)

  const pruneRes = await postWithSession(
    app,
    'post',
    '/api/admin/observability/maintenance/prune',
    {},
    adminSession,
  )
  assert.equal(pruneRes.status, 200)
  assert.equal(typeof pruneRes.body.deletedLogs, 'number')
})

test('configured measurement windows exclude late and synthetic rows and gaps remain unknown', async () => {
  const app = createApp(restrictedPool, { enableDbLogging: false })
  const adminSession = await postWithSession(app, 'post', '/api/auth/login', {
    identifier: `obs.admin.${run}`, password,
  })
  assert.equal(adminSession.status, 200)
  const adminAccess = cookie(adminSession, 'cof_access')
  const now = Date.now()
  const module = `window_${run}`
  const validSince = new Date(now - 3 * 3_600_000).toISOString()
  const sli = await postWithSession(app, 'post', '/api/admin/observability/slis', {
    code: `sli_window_${run}`, name: 'Medición de consultas elegibles',
    description: 'Porcentaje de consultas al catálogo bajo el umbral',
    service: 'api', characteristic: 'Latencia', dataSource: 'operational_http',
    indicatorType: 'latency_threshold_pct', unit: '%', evaluationPeriod: '24h',
    calculationMethod: { thresholdMs: 100, module, methods: ['GET'], pathPrefix: '/api/plans', statusCodes: [200] },
    inclusionCriteria: 'Consultas GET válidas de catálogo.',
    exclusionCriteria: 'Respuestas sin un resultado válido.',
  }, adminSession)
  assert.equal(sli.status, 201)
  const slo = await postWithSession(app, 'post', '/api/admin/observability/slos', {
    code: `slo_window_${run}`, sliId: sli.body.sli.id, name: 'Objetivo de ventana corta',
    description: 'Tiempo de respuesta de consultas válidas',
    targetValue: 95, comparisonOperator: '>=', unit: '%',
    evaluationPeriod: '1h', minSamples: 2, effectiveFrom: validSince,
  }, adminSession)
  assert.equal(slo.status, 201)
  // Recreate definitions already in force at the historical sample timestamps.
  await pool.query('UPDATE private.observability_sli_versions SET effective_from = $1 WHERE sli_id = $2', [validSince, sli.body.sli.id])
  await pool.query('UPDATE private.observability_slo_versions SET created_at = $1 WHERE slo_id = $2', [validSince, slo.body.slo.id])

  const samples: Array<[number, number, string, number, boolean]> = [
    [-120, 800, 'GET', 200, false],
    [-56, 20, 'GET', 200, false],
    [-25, 40, 'GET', 200, false],
    [-20, 800, 'POST', 200, false],
    [-15, 800, 'GET', 400, false],
    [-10, 800, 'GET', 200, true],
    [10, 800, 'GET', 200, false],
  ]
  await pool.query('SELECT private.insert_observability_logs($1::jsonb)', [JSON.stringify(
    samples.map(([minutes, durationMs, httpMethod, statusCode, synthetic]) => ({
      correlationId: randomUUID(), occurredAt: new Date(now + minutes * 60_000).toISOString(),
      environment: 'staging', service: 'api', module, source: 'operational',
      eventType: 'http.request', severity: 'info', operation: `${httpMethod} /api/plans`,
      normalizedPath: '/api/plans', httpMethod, statusCode, durationMs, outcome: 'success',
      metadata: synthetic ? { synthetic: true } : {},
    })),
  )])
  const slis = await request(app).get('/api/admin/observability/slis?environment=staging&period=7d').set('Cookie', adminAccess).expect(200)
  const observedSli = slis.body.items.find((item: { id: string }) => item.id === sli.body.sli.id)
  assert.equal(observedSli.samples, 3)
  assert.equal(observedSli.observedValue, 66.67)
  const slos = await request(app).get('/api/admin/observability/slos?environment=staging&period=7d').set('Cookie', adminAccess).expect(200)
  const observedSlo = slos.body.items.find((item: { id: string }) => item.id === slo.body.slo.id)
  assert.equal(observedSlo.samples, 2)
  assert.equal(observedSlo.complianceStatus, 'met')
  assert.equal(Date.parse(observedSlo.periodEnd) - Date.parse(observedSlo.periodStart), 3_600_000)

  const syntheticSli = await postWithSession(app, 'post', '/api/admin/observability/slis', {
    code: `sli_gap_${run}`, name: 'Disponibilidad Web con brechas',
    description: 'Disponibilidad observada sobre comprobaciones elegibles',
    service: 'web', characteristic: 'Disponibilidad', dataSource: 'synthetic_availability',
    indicatorType: 'availability', unit: '%', evaluationPeriod: '1h',
    calculationMethod: { module },
    inclusionCriteria: 'Comprobaciones del monitor externo.', exclusionCriteria: 'Recuperación simulada.',
  }, adminSession)
  assert.equal(syntheticSli.status, 201)
  const syntheticSlo = await postWithSession(app, 'post', '/api/admin/observability/slos', {
    code: `slo_gap_${run}`, sliId: syntheticSli.body.sli.id, name: 'Objetivo de disponibilidad Web',
    description: 'Cumplimiento basado en evidencia suficiente', targetValue: 99,
    comparisonOperator: '>=', unit: '%', evaluationPeriod: '1h', minSamples: 1,
  }, adminSession)
  assert.equal(syntheticSlo.status, 201)
  const stamp = new Date().toISOString()
  const externalRunId = `ext-gap-${run}`
  await request(app).post('/api/observability/ingest')
    .set('X-Observability-Token', process.env.OBSERVABILITY_INGEST_SECRET!)
    .send({
      run: { externalRunId, environment: 'staging', startedAt: stamp, finishedAt: stamp, status: 'partial' },
      checks: ['passed', 'not_executed'].map((status, index) => ({
        externalEventId: `${externalRunId}-${index}`, checkKey: 'web_availability',
        checkName: 'Disponibilidad Web', checkKind: 'synthetic_availability', service: 'web',
        module, environment: 'staging', executedAt: stamp, expectedResult: 'HTTP 200',
        actualResult: status === 'passed' ? 'HTTP 200' : 'El cron no se ejecutó.',
        status, errorCode: status === 'not_executed' ? 'SCHEDULE_SLOT_MISSED' : null,
      })),
    }).expect(201)
  const withGap = await request(app).get('/api/admin/observability/slos?environment=staging&period=1h')
    .set('Cookie', adminAccess).expect(200)
  const gapSlo = withGap.body.items.find((item: { id: string }) => item.id === syntheticSlo.body.slo.id)
  assert.equal(gapSlo.notExecutedCount, 1)
  assert.equal(gapSlo.samples, 1)
  assert.equal(gapSlo.complianceStatus, 'insufficient_data')
})

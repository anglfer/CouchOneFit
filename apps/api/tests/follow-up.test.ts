import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
import { checkIn } from '../src/features/follow-up/validators/follow-up.js'
import { summarize, sessionState } from '../src/features/follow-up/domain/adherence.js'
import { localDate, shiftDate } from '../src/features/training/services/calendar.js'

process.env.AUTH_JWT_SECRET = 'follow-up-local-test-secret-at-least-32-bytes'
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const url = process.env.TEST_DATABASE_URL!
assert(url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Local test database required')
const owner = new Pool({ connectionString: url }), name = `cof_follow_${randomBytes(5).toString('hex')}`
let db: Pool, runtime: Pool, app: ReturnType<typeof createApp>, created = false
type Actor = { id: string; token: string; professionalId?: string; clientId?: string }
let pro: Actor, other: Actor, client: Actor, clientB: Actor
async function actor(role: 'professional' | 'client', parent?: Actor): Promise<Actor> {
  const id = randomUUID(), session = randomUUID()
  await db.query("INSERT INTO private.users(id,username,email,password_hash,role) VALUES($1::uuid,replace(left($1::text,20),'-',''),$2,'$argon2id$fixture',$3)", [id, `${id}@example.com`, role])
  await db.query('INSERT INTO private.sessions(id,user_id) VALUES($1,$2)', [session, id])
  const a: Actor = { id, token: await signAccess(id, session) }
  if (role === 'professional') {
    a.professionalId = (await db.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Follow QA') RETURNING id", [id])).rows[0].id
    await db.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE max_clients=10", [a.professionalId])
  } else a.clientId = (await db.query("INSERT INTO private.clients(professional_id,user_id,full_name,birth_date,height_cm,base_weight_kg) VALUES($1,$2,'Follow client','1995-01-01',170,70) RETURNING id", [parent!.professionalId, id])).rows[0].id
  return a
}
before(async () => {
  await owner.query(`CREATE DATABASE "${name}"`); created = true
  const target = new URL(url); target.pathname = '/' + name
  db = new Pool({ connectionString: target.toString() })
  await db.query(readFileSync(new URL('../../../docs/database/schemas/identity_access.sql', import.meta.url), 'utf8'))
  runtime = new Pool({ connectionString: target.toString(), options: '-c role=couchone_authentication -c statement_timeout=10000', max: 10 })
  app = createApp(runtime); pro = await actor('professional'); other = await actor('professional'); client = await actor('client', pro); clientB = await actor('client', other)
})
after(async () => { await runtime?.end(); await db?.end(); if (created) await owner.query(`DROP DATABASE "${name}"`); await owner.end() })

const mobile = (path: string, who: Actor) => request(app).get(path).set('Authorization', `Bearer ${who.token}`)
const save = (body: unknown, who = client, key = randomUUID()) => request(app).post('/api/me/check-ins').set('Authorization', `Bearer ${who.token}`).set('Idempotency-Key', key).send(body as object)
async function web(method: 'get' | 'patch', path: string, body?: unknown, who = pro, key = randomUUID()) {
  if (method === 'get') return request(app).get(path).set('Authorization', `Bearer ${who.token}`)
  const csrf = await request(app).get('/api/auth/csrf')
  return request(app).patch(path).set('Idempotency-Key', key).set('Origin', 'http://localhost:5000')
    .set('Cookie', [`cof_access=${who.token}`, ...(csrf.headers['set-cookie'] as unknown as string[]).map(x => x.split(';')[0])]).set('X-CSRF-Token', csrf.body.csrfToken).send(body as object)
}
const today = () => localDate(new Date(), 'America/Mexico_City')

test('validation: real values only, DEC-006 bounds and precision, no coercion', () => {
  const base = { id: randomUUID(), localDate: '2026-11-20', revision: 0 }
  assert.throws(() => checkIn(base), /al menos un dato real/)
  assert.throws(() => checkIn({ ...base, comment: '   ' }), /al menos un dato real/)
  for (const bodyWeightKg of [29.9, 300.1, 70.05, '70']) assert.throws(() => checkIn({ ...base, bodyWeightKg }))
  assert.throws(() => checkIn({ ...base, sleepHours: 7.25 }))
  assert.throws(() => checkIn({ ...base, stress: 0 }))
  assert.throws(() => checkIn({ ...base, energy: 2.5 }))
  assert.throws(() => checkIn({ ...base, nutritionCompliance: true }))
  assert.throws(() => checkIn({ ...base, nutritionCompliance: 'not_applicable' }), /al menos un dato real/)
  assert.throws(() => checkIn({ ...base, comment: 'x'.repeat(501) }))
  assert.throws(() => checkIn({ ...base, bodyWeightKg: 70, extra: 1 }))
  assert.deepEqual(checkIn({ ...base, bodyWeightKg: 30, sleepHours: 0, comment: ' Bien ' }).values, { bodyWeightKg: 30, sleepHours: 0, stress: null, energy: null, hunger: null, nutritionCompliance: null, comment: 'Bien' })
})

test('adherence: DEC-008 examples, no data is not a failure, no global score', () => {
  const training = summarize(['completed', 'completed', 'completed', 'completed', null])
  assert.deepEqual([training.observedPercent, training.coveragePercent], [100, 80])
  const nutrition = summarize(['completed', 'completed', 'completed', 'completed', 'completed', 'not_completed', null])
  assert.deepEqual([nutrition.observedPercent, nutrition.coveragePercent], [83, 86])
  assert.deepEqual([summarize([]).observedPercent, summarize([]).coveragePercent], [null, null])
  assert.deepEqual([summarize([null, null]).observedPercent, summarize([null, null]).coveragePercent], [null, 0])
  assert.equal(summarize(['partial', 'not_completed']).observedPercent, 25)
  assert.deepEqual([sessionState('draft', 3, 3), sessionState('finalized', 3, 3), sessionState('finalized', 1, 3), sessionState('finalized', 0, 3)], [null, 'completed', 'partial', 'not_completed'])
})

test('check-in: window, single row per date, idempotency, versioned corrections and ownership', async () => {
  const now = today()
  const context = await mobile('/api/me/check-ins/context', client)
  assert.equal(context.status, 200, JSON.stringify(context.body))
  assert.deepEqual([context.body.localDate, context.body.canWrite, context.body.checkIn, context.body.nutrition.applicable, context.body.training], [now, true, null, false, null])
  assert.deepEqual(context.body.dates.map((d: { localDate: string }) => d.localDate), [now, shiftDate(now, -1), shiftDate(now, -2)])
  for (const date of [shiftDate(now, 1), shiftDate(now, -3)]) {
    assert.equal((await mobile(`/api/me/check-ins/context?date=${date}`, client)).status, 400)
    assert.equal((await save({ id: randomUUID(), localDate: date, revision: 0, bodyWeightKg: 70 })).status, 400)
  }
  await assert.rejects(
    db.query("INSERT INTO private.check_ins(id,client_id,local_date,time_zone,nutrition_compliance,created_at,updated_at) VALUES($1,$2,$3,'America/Mexico_City','not_applicable',clock_timestamp(),clock_timestamp())", [randomUUID(), client.clientId, shiftDate(now, -2)]),
  )
  // Without plans the check-in is still allowed (DEC-004 enabled account).
  const id = randomUUID(), key = randomUUID(), body = { id, localDate: now, revision: 0, bodyWeightKg: 71.4, sleepHours: 7.5, stress: 2, energy: 4, hunger: 3, comment: 'Dormí bien' }
  const first = await save(body, client, key)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.deepEqual([first.body.checkIn.bodyWeightKg, first.body.checkIn.revision, first.body.checkIn.nutritionCompliance], [71.4, 1, null])
  assert.deepEqual((await save(body, client, key)).body, first.body)
  assert.equal((await save({ ...body, bodyWeightKg: 72 }, client, key)).status, 409)
  assert.equal((await save({ ...body, id: randomUUID() })).status, 409, 'a second check-in for the same date is a conflict')
  assert.equal((await save({ ...body, revision: 1, nutritionCompliance: 'completed' })).status, 400, 'no nutrition plan in force')
  const corrected = await save({ ...body, revision: 1, bodyWeightKg: null, nutritionCompliance: 'not_applicable' })
  assert.equal(corrected.status, 200, JSON.stringify(corrected.body))
  assert.deepEqual([corrected.body.checkIn.revision, corrected.body.checkIn.bodyWeightKg], [2, null])
  assert.equal((await save({ ...body, revision: 1 })).status, 409, 'stale revision')
  const revisions = (await db.query('SELECT revision,data FROM private.check_in_revisions WHERE check_in_id=$1 ORDER BY revision', [id])).rows
  assert.deepEqual(revisions.map(r => [r.revision, r.data.bodyWeightKg]), [[1, 71.4], [2, null]])
  // Weight never rewrites the base profile.
  assert.equal(Number((await db.query('SELECT base_weight_kg FROM private.clients WHERE id=$1', [client.clientId])).rows[0].base_weight_kg), 70)
  const weighed = await save({ id, localDate: now, revision: 2, bodyWeightKg: 71.2 })
  assert.equal(weighed.status, 200)
  const yesterday = await save({ id: randomUUID(), localDate: shiftDate(now, -1), revision: 0, energy: 2 })
  assert.equal(yesterday.status, 200)
  // Own history; another client sees nothing of it.
  assert.deepEqual((await mobile('/api/me/check-ins', client)).body.checkIns.map((c: { localDate: string }) => c.localDate), [now, shiftDate(now, -1)])
  assert.deepEqual((await mobile('/api/me/check-ins', clientB)).body.checkIns, [])
  assert.equal((await mobile('/api/me/check-ins', pro)).status, 403)
  assert.equal((await mobile('/api/me/check-ins?offset=-1', client)).status, 400)
  const followUp = await web('get', `/api/clients/${client.clientId}/follow-up`)
  assert.equal(followUp.status, 200, JSON.stringify(followUp.body))
  assert.equal(followUp.body.checkIns.length, 2)
  assert.deepEqual(followUp.body.bodyWeight.map((w: { weightKg: number; unit: string; source: string; timeZone: string }) => [w.weightKg, w.unit, w.source, w.timeZone]), [[71.2, 'kg', 'check_in', 'America/Mexico_City']])
  assert.equal(followUp.body.adherence.training.observedPercent, null)
  assert.equal(followUp.body.adherence.nutrition.applicableDays, 0)
  assert.equal((await web('get', `/api/clients/${client.clientId}/follow-up?days=7`)).status, 200)
  assert.equal((await web('get', `/api/clients/${client.clientId}/follow-up?days=7&from=${now}`)).status, 400)
  assert.equal((await web('get', `/api/clients/${client.clientId}/follow-up?days=0`)).status, 400)
  assert.equal((await web('get', `/api/clients/${client.clientId}/follow-up`, undefined, other)).status, 404)
  assert.equal((await web('get', `/api/clients/${client.clientId}/follow-up?from=2026-01-01&to=2025-01-01`)).status, 400)
  const record = (await web('get', `/api/clients/${client.clientId}/record`)).body.record.sections.bodyWeightHistory
  assert.deepEqual([record.status, record.entries[0].weightKg, record.entries[0].timeZone], ['available', 71.2, 'America/Mexico_City'])
  assert.equal((await web('get', `/api/clients/${clientB.clientId}/record`, undefined, other)).body.record.sections.bodyWeightHistory.status, 'empty')
  const hub = (await web('get', '/api/training/clients')).body.clients[0]
  assert.deepEqual([hub.lastCheckIn, hub.checkInToday, hub.checkInRecent], [now, true, true])
  assert.ok(typeof hub.lastCheckInAt === 'string' && Number.isFinite(Date.parse(hub.lastCheckInAt)))
  // RLS: another subject reads no check-in rows even with direct SQL.
  const r = await runtime.connect()
  try { await r.query('BEGIN'); await r.query("SELECT set_config('app.subject_id',$1,true)", [clientB.id]); assert.equal((await r.query('SELECT * FROM private.check_ins')).rowCount, 0) } finally { await r.query('ROLLBACK'); r.release() }
  // Inactive record: read stays, writes stop.
  await db.query("UPDATE private.clients SET status='inactive' WHERE id=$1", [client.clientId])
  assert.equal((await mobile('/api/me/check-ins/context', client)).body.canWrite, false)
  assert.equal((await save({ id, localDate: now, revision: 3, stress: 3 })).status, 403)
  await db.query("UPDATE private.clients SET status='active' WHERE id=$1", [client.clientId])
})

test('nutrition compliance needs the plan in force and adherence uses explicit states', async () => {
  const now = today(), plan = randomUUID(), version = randomUUID()
  await db.query('INSERT INTO private.nutrition_plans(id,owner_id,client_id) VALUES($1,$2,$3)', [plan, pro.id, client.clientId])
  await db.query("INSERT INTO private.nutrition_versions(id,plan_id,number,published,document) VALUES($1,$2,1,true,'{\"name\":\"Plan QA\",\"meals\":[]}')", [version, plan])
  await db.query('INSERT INTO private.nutrition_activations(client_id,plan_id,version_id,local_date,time_zone,revision) VALUES($1,$2,$3,$4,$5,1)', [client.clientId, plan, version, shiftDate(now, -2), 'America/Mexico_City'])
  await db.query('INSERT INTO private.nutrition_active(client_id,plan_id,version_id,revision) VALUES($1,$2,$3,1)', [client.clientId, plan, version])
  const context = await mobile(`/api/me/check-ins/context?date=${shiftDate(now, -2)}`, client)
  assert.deepEqual([context.body.nutrition.applicable, context.body.nutrition.planName], [true, 'Plan QA'])
  assert.equal((await save({ id: randomUUID(), localDate: shiftDate(now, -2), revision: 0, nutritionCompliance: 'not_applicable' })).status, 400)
  const partial = await save({ id: randomUUID(), localDate: shiftDate(now, -2), revision: 0, nutritionCompliance: 'partial' })
  assert.equal(partial.status, 200, JSON.stringify(partial.body))
  assert.equal(partial.body.checkIn.nutritionVersionId, version)
  const adherence = (await web('get', `/api/clients/${client.clientId}/follow-up?from=${shiftDate(now, -2)}&to=${now}`)).body.adherence.nutrition
  // Three applicable days: one partial, two without explicit state (today's is not_applicable from before the plan rule).
  assert.deepEqual([adherence.applicableDays, adherence.recordedDays, adherence.observedPercent, adherence.coveragePercent], [3, 1, 50, 33])
})

test('visibility: default off, aggregate omits, dedicated 403, revocation on next request', async () => {
  await db.query('INSERT INTO private.client_evaluations(client_id,weight_kg,waist_cm) VALUES($1,70.5,80)', [client.clientId])
  const hidden = await mobile('/api/me/progress', client)
  assert.equal(hidden.status, 200)
  assert.deepEqual(hidden.body.visibility, { measurements: false, adherence: false })
  assert.equal('measurements' in hidden.body || 'adherence' in hidden.body, false)
  const dedicated = await mobile('/api/me/progress/measurements', client)
  assert.deepEqual([dedicated.status, dedicated.body.error.code, 'measurements' in dedicated.body], [403, 'VISIBILITY_DENIED', false])
  const dedicatedAdh = await mobile('/api/me/progress/adherence', client)
  assert.deepEqual([dedicatedAdh.status, dedicatedAdh.body.error.code, 'training' in dedicatedAdh.body], [403, 'VISIBILITY_DENIED', false])
  const r = await runtime.connect()
  try { await r.query('BEGIN'); await r.query("SELECT set_config('app.subject_id',$1,true)", [client.id]); assert.equal((await r.query('SELECT * FROM private.client_evaluations')).rowCount, 0) } finally { await r.query('ROLLBACK'); r.release() }
  assert.equal((await web('patch', `/api/clients/${client.clientId}/visibility`, { measurements: true, adherence: true, revision: 0 }, other)).status, 404)
  const shared = await web('patch', `/api/clients/${client.clientId}/visibility`, { measurements: true, adherence: true, revision: 0 })
  assert.equal(shared.status, 200, JSON.stringify(shared.body))
  assert.equal((await web('patch', `/api/clients/${client.clientId}/visibility`, { measurements: false, adherence: false, revision: 0 })).status, 409)
  const visibleAdh = await mobile('/api/me/progress/adherence?days=7', client)
  assert.equal(visibleAdh.status, 200, JSON.stringify(visibleAdh.body))
  assert.equal(visibleAdh.body.nutrition.applicableDays, 3)
  const visible = (await mobile('/api/me/progress', client)).body
  assert.deepEqual([visible.measurements[0].weightKg, visible.measurements[0].waistCm, visible.measurements[0].source, visible.adherence.nutrition.applicableDays], [70.5, 80, 'professional_evaluation', 3])
  // Multimethod evaluation preserves effectiveDate distinct from evaluation_date.
  const csrfEval = await request(app).get('/api/auth/csrf')
  const multi = await request(app).post(`/api/clients/${client.clientId}/evaluations`).set('Idempotency-Key', randomUUID()).set('Origin', 'http://localhost:5000')
    .set('Cookie', [`cof_access=${pro.token}`, ...(csrfEval.headers['set-cookie'] as unknown as string[]).map(x => x.split(';')[0])]).set('X-CSRF-Token', csrfEval.body.csrfToken)
    .send({ method: 'perimetros', equation: 'not_applicable', effectiveDate: '2026-09-01', measurements: { weightKg: 71.1, waistCm: 79.5 } })
  assert.equal(multi.status, 201, JSON.stringify(multi.body))
  const withMulti = await mobile('/api/me/progress/measurements', client)
  assert.equal(withMulti.status, 200)
  const foundMulti = withMulti.body.measurements.find((m: { date: string }) => m.date === '2026-09-01')
  assert.deepEqual([foundMulti?.weightKg, foundMulti?.waistCm, foundMulti?.source, foundMulti?.method], [71.1, 79.5, 'professional_evaluation', 'perimetros'])
  assert.equal((await mobile('/api/me/progress', clientB)).body.visibility.measurements, false)
  assert.equal((await web('patch', `/api/clients/${client.clientId}/visibility`, { measurements: false, adherence: false, revision: 1 })).status, 200)
  const revoked = await mobile('/api/me/progress', client)
  assert.equal('measurements' in revoked.body || 'adherence' in revoked.body, false)
  assert.equal((await mobile('/api/me/progress/measurements', client)).status, 403)
  assert.equal((await mobile('/api/me/progress/adherence', client)).status, 403)
  assert.equal((await web('patch', `/api/clients/${client.clientId}/visibility`, { measurements: false, adherence: true, revision: 2 })).status, 200)
  assert.equal((await web('get', `/api/clients/${client.clientId}/follow-up`)).body.visibility.revision, 3)
  assert.equal(Number((await db.query("SELECT count(*) FROM private.training_audit WHERE action='visibility_changed'")).rows[0].count), 3)
})

test('training adherence: only finalized sessions on applicable days count, drafts are no data', async () => {
  const now = today(), id = randomUUID(), versionId = randomUUID(), base = `/api/clients/${client.clientId}/training-plans`
  const csrf = async (path: string, body: unknown) => {
    const c = await request(app).get('/api/auth/csrf')
    return request(app).post(path).set('Idempotency-Key', randomUUID()).set('Origin', 'http://localhost:5000')
      .set('Cookie', [`cof_access=${pro.token}`, ...(c.headers['set-cookie'] as unknown as string[]).map(x => x.split(';')[0])]).set('X-CSRF-Token', c.body.csrfToken).send(body as object)
  }
  const days = Array.from({ length: 7 }, (_, i) => ({ id: randomUUID(), name: `Día ${i + 1}`, kind: 'training', date: null, exercises: [{ id: randomUUID(), catalogId: null, name: 'Sentadilla', instructions: '', guidance: [], images: [], loadMode: 'bodyweight', sets: [{ id: randomUUID(), reps: 10, rpe: null, targetLoadKg: null }, { id: randomUUID(), reps: 10, rpe: null, targetLoadKg: null }] }] }))
  assert.equal((await csrf(base, { id, versionId, prescription: { name: 'Rutina QA', schedule: 'weekly', startDate: '2020-01-01', days } })).status, 200)
  assert.equal((await csrf(`${base}/${id}/versions/${versionId}/activate`, { revision: 1, activeRevision: 0 })).status, 200)
  const context = (await mobile('/api/me/training-sessions/context', client)).body
  const sets = context.plan.days.find((d: { id: string }) => d.id === context.dayId).exercises[0].sets
  const finalized = await request(app).post('/api/me/training-sessions').set('Authorization', `Bearer ${client.token}`).set('Idempotency-Key', randomUUID())
    .send({ id: randomUUID(), localDate: now, versionId, revision: 0, status: 'finalized', results: [{ setId: sets[0].id, state: 'performed', reps: 10, loadKg: 0 }, { setId: sets[1].id, state: 'not_performed', reps: 0, loadKg: null }] })
  assert.equal(finalized.status, 200, JSON.stringify(finalized.body))
  const followUpRes = (await web('get', `/api/clients/${client.clientId}/follow-up?from=${now}&to=${now}`)).body
  const training = followUpRes.adherence.training
  assert.deepEqual([training.applicableDays, training.partial, training.observedPercent, training.coveragePercent], [1, 1, 50, 100])
  assert.equal(followUpRes.sessions.length, 1)
  const ses = followUpRes.sessions[0]
  assert.deepEqual([ses.versionNumber, ses.routineName, ses.performedSets, ses.totalSets], [1, 'Rutina QA', 1, 2])
  assert.deepEqual([ses.exercises[0].name, ses.exercises[0].sets[0].prescribedReps, ses.exercises[0].sets[0].state, ses.exercises[0].sets[0].reps, ses.exercises[0].sets[0].loadKg, ses.exercises[0].sets[0].unit, ses.exercises[0].sets[1].state], ['Sentadilla', 10, 'performed', 10, 0, 'bodyweight', 'not_performed'])
  const own = (await mobile('/api/me/check-ins/context', client)).body.training
  assert.deepEqual([own.kind, own.sessionStatus], ['training', 'finalized'])
  // Shared adherence lets the client read the routine that applied, nothing more.
  assert.equal((await mobile('/api/me/progress', client)).body.adherence.training.partial, 1)
  // Portfolio summary reuses DEC-008 calculations, excludes inactive clients and isolates portfolios.
  const inactiveClient = await actor('client', pro)
  await db.query("UPDATE private.clients SET status='inactive' WHERE id=$1", [inactiveClient.clientId])
  const summary = await web('get', '/api/follow-up/summary')
  assert.equal(summary.status, 200, JSON.stringify(summary.body))
  assert.deepEqual([summary.body.days, summary.body.activeClients, summary.body.adherence.training.observedPercent, summary.body.adherence.training.coveragePercent], [7, 1, 50, 100])
  const otherSummary = await web('get', '/api/follow-up/summary', undefined, other)
  assert.equal(otherSummary.status, 200)
  assert.deepEqual([otherSummary.body.activeClients, otherSummary.body.adherence.training.observedPercent, otherSummary.body.adherence.nutrition.observedPercent], [1, null, null])
  assert.equal((await mobile('/api/follow-up/summary', client)).status, 403)
})

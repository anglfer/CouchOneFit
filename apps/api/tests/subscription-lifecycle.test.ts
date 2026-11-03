import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
// DEC-017: simulated renewal, 7-day grace, cancel at period end and downgrade.
process.env.AUTH_JWT_SECRET = 'lifecycle-local-only-secret-at-least-32-bytes'
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const url = process.env.TEST_DATABASE_URL!
if (
  !url ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
)
  throw new Error('Local database required')
const owner = new Pool({ connectionString: url }),
  dbName = `cof_life_${randomBytes(5).toString('hex')}`
let db: Pool, runtime: Pool, app: ReturnType<typeof createApp>
let basic: string, mini: string, elite: string
let seq = 0
const DAY = 86400000
before(async () => {
  await owner.query(`CREATE DATABASE "${dbName}"`)
  const target = new URL(url)
  target.pathname = `/${dbName}`
  db = new Pool({ connectionString: target.toString() })
  await db.query(
    readFileSync(
      new URL('../../../docs/database/schemas/identity_access.sql', import.meta.url),
      'utf8'
    )
  )
  runtime = new Pool({
    connectionString: target.toString(),
    options: '-c role=couchone_authentication -c statement_timeout=10000',
    max: 8,
  })
  app = createApp(runtime)
  await db.query(
    "INSERT INTO private.saas_plans(name,max_clients,is_unlimited,price_mxn) VALUES('Mini 2',2,false,99)"
  )
  const plans = (await db.query('SELECT id,name,max_clients FROM private.saas_plans')).rows
  basic = plans.find((p) => p.max_clients === 10).id
  mini = plans.find((p) => p.max_clients === 2).id
  elite = plans.find((p) => p.max_clients === null).id
})
after(async () => {
  await runtime?.end()
  await db?.end()
  await owner.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  await owner.end()
})
async function professional(opts: {
  planId?: string
  expiresAt: Date
  method?: string
  cancel?: boolean
}) {
  const name = `life.${++seq}`
  const {
    rows: [u],
  } = await db.query(
    "INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,'$argon2id$fixture','professional') RETURNING id",
    [name, `${name}@example.com`]
  )
  const {
    rows: [s],
  } = await db.query('INSERT INTO private.sessions (user_id) VALUES ($1) RETURNING id', [u.id])
  const {
    rows: [p],
  } = await db.query(
    "INSERT INTO private.professionals (user_id,full_name) VALUES ($1,'Profesional Ciclo') RETURNING id",
    [u.id]
  )
  await db.query(
    `INSERT INTO private.subscriptions(professional_id,plan_id,status,expires_at,renewal_method,cancel_at_period_end)
     VALUES($1,$2,'active',$3,$4,$5)`,
    [p.id, opts.planId ?? basic, opts.expiresAt, opts.method ?? 'test_approved', opts.cancel ?? false]
  )
  return { id: u.id, professionalId: p.id, token: await signAccess(u.id, s.id) }
}
const get = (path: string, token: string) =>
  request(app).get(path).set('Cookie', `cof_access=${token}`)
async function send(method: 'post' | 'patch', path: string, body: unknown, token: string) {
  const csrf = await request(app).get('/api/auth/csrf')
  return request(app)
    [method](path)
    .set('Origin', 'http://localhost:5000')
    .set('Cookie', [
      `cof_access=${token}`,
      ...(csrf.headers['set-cookie'] as string[]).map((c) => c.split(';')[0]),
    ])
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send(body)
}
const clientInput = {
  fullName: 'Cliente ciclo',
  goal: null,
  birthDate: '1990-05-20',
  heightCm: 170.5,
  baseWeightKg: 70.2,
  baseBodyFatPercentage: null,
  waistCm: null,
  hipCm: null,
}
const subscription = async (token: string) =>
  (await get('/api/me/subscription', token)).body.subscription

test('an expired approved subscription renews itself once per elapsed month, with a payment record', async () => {
  const expired = new Date(Date.now() - DAY)
  const pro = await professional({ expiresAt: expired })
  const sub = await subscription(pro.token)
  assert.equal(sub.status, 'active')
  const expectedEnd = new Date(expired)
  expectedEnd.setUTCMonth(expectedEnd.getUTCMonth() + 1)
  assert.ok(Math.abs(new Date(sub.expiresAt).getTime() - expectedEnd.getTime()) < DAY * 3)
  // A second read does not charge again.
  await subscription(pro.token)
  const { rows } = await db.query(
    "SELECT status,kind,amount_cents FROM private.simulated_payments WHERE professional_id=$1",
    [pro.professionalId]
  )
  assert.deepEqual(rows.map((r) => [r.status, r.kind, r.amount_cents]), [
    ['succeeded', 'renewal', '29900'],
  ])
  const history = await get('/api/me/payments', pro.token)
  assert.equal(history.body.payments[0].kind, 'renewal')
})

test('a declined renewal keeps full access for 7 days, then the plan lapses and clients only read', async () => {
  const pro = await professional({
    expiresAt: new Date(Date.now() - 2 * DAY),
    method: 'test_declined',
  })
  const grace = await subscription(pro.token)
  assert.equal(grace.status, 'grace')
  assert.equal(grace.remaining, 10)
  assert.ok(
    Math.abs(new Date(grace.graceUntil).getTime() - (Date.now() + 5 * DAY)) < DAY
  )
  // Full business access during grace.
  const created = await send('post', '/api/clients', clientInput, pro.token)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  // Retries during grace do not duplicate the failure record.
  await subscription(pro.token)
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM private.simulated_payments WHERE professional_id=$1 AND status='failed'", [pro.professionalId])).rows[0].n,
    1
  )
  // Fixing the method recovers the subscription on the next access.
  assert.equal((await send('patch', '/api/me/subscription', { renewalMethod: 'test_approved' }, pro.token)).status, 200)
  assert.equal((await subscription(pro.token)).status, 'active')

  const late = await professional({
    expiresAt: new Date(Date.now() - 8 * DAY),
    method: 'test_error',
  })
  assert.equal((await subscription(late.token)).status, 'expired')
  const blocked = await send('post', '/api/clients', clientInput, late.token)
  assert.equal(blocked.status, 403)
  assert.equal(blocked.body.error.code, 'SUBSCRIPTION_SUSPENDED')
  assert.equal(
    (await db.query("SELECT failure_code FROM private.simulated_payments WHERE professional_id=$1", [late.professionalId])).rows[0].failure_code,
    'PROCESSOR_ERROR'
  )
})

test('cancelling keeps access until the paid period ends, does not renew and can be undone before then', async () => {
  const pro = await professional({ expiresAt: new Date(Date.now() + 10 * DAY) })
  assert.equal((await send('patch', '/api/me/subscription', {}, pro.token)).status, 400)
  assert.equal((await send('patch', '/api/me/subscription', { cancelAtPeriodEnd: 'yes' }, pro.token)).status, 400)
  assert.equal((await send('patch', '/api/me/subscription', { renewalMethod: 'visa' }, pro.token)).status, 400)
  const cancelled = await send('patch', '/api/me/subscription', { cancelAtPeriodEnd: true }, pro.token)
  assert.equal(cancelled.status, 200)
  assert.equal(cancelled.body.subscription.cancelAtPeriodEnd, true)
  assert.equal(cancelled.body.subscription.status, 'active')
  assert.equal((await send('post', '/api/clients', clientInput, pro.token)).status, 201)
  const undone = await send('patch', '/api/me/subscription', { cancelAtPeriodEnd: false }, pro.token)
  assert.equal(undone.body.subscription.cancelAtPeriodEnd, false)

  const ended = await professional({ expiresAt: new Date(Date.now() - DAY), cancel: true })
  const sub = await subscription(ended.token)
  assert.equal(sub.status, 'expired')
  assert.equal((await db.query('SELECT count(*)::int AS n FROM private.simulated_payments WHERE professional_id=$1', [ended.professionalId])).rows[0].n, 0)
  // Without a valid plan the preference cannot change.
  const refused = await send('patch', '/api/me/subscription', { cancelAtPeriodEnd: false }, ended.token)
  assert.equal(refused.status, 403)
})

test('downgrade needs the chosen clients inactivated, is atomic and keeps the paid period', async () => {
  const pro = await professional({ expiresAt: new Date(Date.now() + 10 * DAY) })
  const other = await professional({ expiresAt: new Date(Date.now() + 10 * DAY) })
  const ids: string[] = []
  for (let i = 0; i < 3; i++)
    ids.push((await send('post', '/api/clients', clientInput, pro.token)).body.client.id)
  const foreign = (await send('post', '/api/clients', clientInput, other.token)).body.client.id
  const before = await subscription(pro.token)

  const excess = await send('post', '/api/me/subscription/downgrade', { planId: mini }, pro.token)
  assert.equal(excess.status, 409)
  assert.equal(excess.body.error.code, 'DOWNGRADE_EXCESS')
  const notLower = await send('post', '/api/me/subscription/downgrade', { planId: elite }, pro.token)
  assert.equal(notLower.body.error.code, 'DOWNGRADE_NOT_LOWER')
  // A foreign or duplicated record fails the whole operation: nothing is inactivated.
  const foreignTry = await send('post', '/api/me/subscription/downgrade', { planId: mini, inactivateClientIds: [ids[0], foreign] }, pro.token)
  assert.equal(foreignTry.status, 409)
  assert.equal(foreignTry.body.error.code, 'CLIENT_NOT_ACTIVE')
  assert.equal((await send('post', '/api/me/subscription/downgrade', { planId: mini, inactivateClientIds: [ids[0], ids[0]] }, pro.token)).status, 400)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1 AND status='active'", [pro.professionalId])).rows[0].n, 3)
  assert.equal((await subscription(pro.token)).planName, before.planName)

  const ok = await send('post', '/api/me/subscription/downgrade', { planId: mini, inactivateClientIds: [ids[0], ids[1]] }, pro.token)
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.subscription.limit, 2)
  assert.equal(ok.body.subscription.used, 1)
  assert.equal(ok.body.subscription.expiresAt, before.expiresAt)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM private.access_events WHERE action='client_record_inactivated' AND client_id=ANY($1::uuid[])", [[ids[0], ids[1]]])).rows[0].n, 2)
  assert.equal((await db.query("SELECT count(*)::int AS n FROM private.clients WHERE id=$1 AND status='active'", [foreign])).rows[0].n, 1)
})

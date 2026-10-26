import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID, randomBytes } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
process.env.AUTH_JWT_SECRET = 'checkout-local-only-secret-at-least-32-bytes'
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const url = process.env.TEST_DATABASE_URL!
if (
  !url ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
)
  throw new Error('Local DB required')
const owner = new Pool({ connectionString: url }),
  name = `cof_checkout_${randomBytes(5).toString('hex')}`
let db: Pool,
  runtime: Pool,
  app: ReturnType<typeof createApp>,
  basic: string,
  pro: string,
  admin: string
let seq = 0
before(async () => {
  await owner.query(`CREATE DATABASE "${name}"`)
  const target = new URL(url)
  target.pathname = `/${name}`
  db = new Pool({ connectionString: target.toString() })
  await db.query(
    readFileSync(
      new URL(
        '../../../docs/database/schemas/identity_access.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  runtime = new Pool({
    connectionString: target.toString(),
    options: '-c role=couchone_authentication -c statement_timeout=10000',
    max: 8,
  })
  app = createApp(runtime)
  admin = (await account('admin')).token
  const plans = (
    await db.query('SELECT id,max_clients FROM private.saas_plans')
  ).rows
  basic = plans.find((p) => p.max_clients === 10).id
  pro = plans.find((p) => p.max_clients === 30).id
})
after(async () => {
  await runtime?.end()
  await db?.end()
  await owner.query(`DROP DATABASE IF EXISTS "${name}"`)
  await owner.end()
})
async function account(role = 'professional') {
  const n = `checkout.${++seq}`
  const {
    rows: [u],
  } = await db.query(
    'INSERT INTO private.users (username,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id',
    [n, `${n}@example.com`, '$argon2id$fixture', role]
  )
  let id = ''
  if (role === 'professional')
    id = (
      await db.query(
        "INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Checkout QA') RETURNING id",
        [u.id]
      )
    ).rows[0].id
  const s = (
    await db.query(
      'INSERT INTO private.sessions(user_id) VALUES($1) RETURNING id',
      [u.id]
    )
  ).rows[0]
  return { id, userId: u.id, token: await signAccess(u.id, s.id) }
}
const get = (path: string, token: string) =>
  request(app).get(path).set('Cookie', `cof_access=${token}`)
async function post(path: string, body: unknown, token: string) {
  const csrf = await request(app).get('/api/auth/csrf')
  return request(app)
    .post(path)
    .set('Origin', 'http://localhost:5000')
    .set('Cookie', [
      `cof_access=${token}`,
      ...(csrf.headers['set-cookie'] as string[]).map((c) => c.split(';')[0]),
    ])
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send(body)
}
async function quote(token: string, planId = basic, key = randomUUID()) {
  const r = await post(
    '/api/me/payments',
    { planId, idempotencyKey: key },
    token
  )
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return r.body.payment
}
async function ready(id: string) {
  await db.query(
    "UPDATE private.simulated_payments SET processing_after=clock_timestamp()-interval '1 second' WHERE id=$1",
    [id]
  )
}
async function pay(
  token: string,
  planId = basic,
  instrument = 'test_approved'
) {
  const q = await quote(token, planId)
  const start = await post(
    `/api/me/payments/${q.id}/confirm`,
    { instrument },
    token
  )
  assert.equal(start.status, 200, JSON.stringify(start.body))
  assert.equal(start.body.payment.status, 'processing')
  await ready(q.id)
  return get(`/api/me/payments/${q.id}`, token)
}
test('professionals see available plans and admin is read only for subscriptions', async () => {
  const a = await account()
  assert.equal((await get('/api/me/plans', a.token)).status, 200)
  assert.equal((await get('/api/me/plans', admin)).status, 403)
  const csrf = await request(app).get('/api/auth/csrf')
  const r = await request(app)
    .patch(`/api/admin/professionals/${a.id}/subscription`)
    .set('Origin', 'http://localhost:5000')
    .set('Cookie', [
      `cof_access=${admin}`,
      ...(csrf.headers['set-cookie'] as string[]).map((c) => c.split(';')[0]),
    ])
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({
      planId: basic,
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    })
  assert.equal(r.status, 403)
})
test('approval activates once, charges full new price and starts a new calendar month', async () => {
  const a = await account(),
    first = await pay(a.token)
  assert.equal(first.status, 200)
  assert.equal(first.body.payment.status, 'succeeded')
  assert.equal(first.body.payment.amountCents, 29900)
  const old = (
    await db.query(
      'SELECT * FROM private.subscriptions WHERE professional_id=$1',
      [a.id]
    )
  ).rows[0]
  await db.query(
    "UPDATE private.subscriptions SET expires_at=clock_timestamp()+interval '2 days' WHERE professional_id=$1",
    [a.id]
  )
  const upgraded = await pay(a.token, pro)
  assert.equal(upgraded.body.payment.amountCents, 59900)
  assert.equal(upgraded.body.payment.status, 'succeeded')
  const current = (
    await db.query(
      'SELECT * FROM private.subscriptions WHERE professional_id=$1',
      [a.id]
    )
  ).rows[0]
  assert.equal(current.plan_id, pro)
  assert.ok(
    current.expires_at > old.expires_at ||
      Math.abs(current.expires_at - old.expires_at) < 10000
  )
  const receipt = await get(
    `/api/me/payments/${upgraded.body.payment.id}`,
    a.token
  )
  assert.equal(receipt.body.payment.status, 'succeeded')
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.subscription_history WHERE professional_id=$1',
        [a.id]
      )
    ).rows[0].n,
    2
  )
  assert.equal(
    (await get('/api/me/subscription', a.token)).body.subscription.limit,
    30
  )
})
test('decline, processor error and cancellation preserve the prior subscription', async () => {
  const a = await account()
  for (const instrument of ['test_declined', 'test_error']) {
    const r = await pay(a.token, basic, instrument)
    assert.equal(r.body.payment.status, 'failed')
    assert.equal(
      (await get('/api/me/subscription', a.token)).body.subscription.status,
      'none'
    )
  }
  const q = await quote(a.token)
  const canceled = await post(`/api/me/payments/${q.id}/cancel`, {}, a.token)
  assert.equal(canceled.body.payment.status, 'cancelled')
  assert.equal(
    (
      await post(
        `/api/me/payments/${q.id}/confirm`,
        { instrument: 'test_approved' },
        a.token
      )
    ).status,
    409
  )
})
test('idempotency, owner isolation, forged inputs and simultaneous finalization', async () => {
  const a = await account(),
    b = await account(),
    key = randomUUID()
  const q = await quote(a.token, basic, key),
    same = await quote(a.token, basic, key)
  assert.equal(q.id, same.id)
  assert.equal((await get(`/api/me/payments/${q.id}`, b.token)).status, 404)
  assert.equal(
    (
      await post(
        `/api/me/payments/${q.id}/confirm`,
        { instrument: 'test_approved', amountCents: 1 },
        a.token
      )
    ).status,
    400
  )
  assert.equal(
    (
      await post(
        `/api/me/payments/${q.id}/confirm`,
        { instrument: '4242424242424242' },
        a.token
      )
    ).status,
    400
  )
  const started = await Promise.all([
    post(
      `/api/me/payments/${q.id}/confirm`,
      { instrument: 'test_approved' },
      a.token
    ),
    post(
      `/api/me/payments/${q.id}/confirm`,
      { instrument: 'test_approved' },
      a.token
    ),
  ])
  assert.ok(started.every((r) => r.status === 200))
  await ready(q.id)
  const settled = await Promise.all([
    get(`/api/me/payments/${q.id}`, a.token),
    get(`/api/me/payments/${q.id}`, a.token),
  ])
  assert.ok(settled.every((r) => r.body.payment.status === 'succeeded'))
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.subscription_history WHERE professional_id=$1',
        [a.id]
      )
    ).rows[0].n,
    1
  )
  assert.equal((await get('/api/me/payments', a.token)).body.payments.length, 1)
})
test('expired or obsolete quotes never activate and audit failure rolls back the payment', async () => {
  const a = await account(),
    q = await quote(a.token)
  await db.query(
    "UPDATE private.simulated_payments SET quote_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [q.id]
  )
  assert.equal(
    (
      await post(
        `/api/me/payments/${q.id}/confirm`,
        { instrument: 'test_approved' },
        a.token
      )
    ).status,
    409
  )
  const b = await account(),
    changed = await quote(b.token)
  await db.query(
    'UPDATE private.saas_plans SET updated_at=clock_timestamp() WHERE id=$1',
    [basic]
  )
  assert.equal(
    (
      await post(
        `/api/me/payments/${changed.id}/confirm`,
        { instrument: 'test_approved' },
        b.token
      )
    ).status,
    409
  )
  const c = await account(),
    fail = await quote(c.token)
  await post(
    `/api/me/payments/${fail.id}/confirm`,
    { instrument: 'test_approved' },
    c.token
  )
  await ready(fail.id)
  await db.query(
    "CREATE FUNCTION private.fail_checkout_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$; CREATE TRIGGER fail_checkout BEFORE INSERT ON private.subscription_history FOR EACH ROW EXECUTE FUNCTION private.fail_checkout_audit()"
  )
  try {
    assert.equal(
      (await get(`/api/me/payments/${fail.id}`, c.token)).status,
      503
    )
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM private.subscriptions WHERE professional_id=$1',
          [c.id]
        )
      ).rows[0].n,
      0
    )
    assert.equal(
      (
        await db.query(
          'SELECT status FROM private.simulated_payments WHERE id=$1',
          [fail.id]
        )
      ).rows[0].status,
      'processing'
    )
  } finally {
    await db.query(
      'DROP TRIGGER fail_checkout ON private.subscription_history; DROP FUNCTION private.fail_checkout_audit()'
    )
  }
})

test('catalog edits propagate to public, professional, registration interest and checkout without fixed prices', async () => {
  const a = await account()
  const plan = (
    await db.query(
      "INSERT INTO private.saas_plans(name,max_clients,is_unlimited,price_mxn) VALUES('Plan sincronizado',42,false,749) RETURNING id"
    )
  ).rows[0]
  const publicBefore = await request(app).get('/api/plans')
  assert.equal(publicBefore.status, 200)
  assert.equal(publicBefore.headers['cache-control'], 'no-store')
  assert.deepEqual(
    Object.keys(publicBefore.body.plans[0]).sort(),
    ['id', 'isUnlimited', 'maxClients', 'name', 'priceMxn'].sort()
  )
  await db.query(
    "UPDATE private.saas_plans SET name='Plan actualizado',max_clients=55,price_mxn=849,updated_at=clock_timestamp() WHERE id=$1",
    [plan.id]
  )
  for (const result of [
    await request(app).get('/api/plans'),
    await get('/api/me/plans', a.token),
    await get('/api/admin/plans', admin),
  ]) {
    const current = result.body.plans.find(
      (item: { id: string }) => item.id === plan.id
    )
    assert.equal(current.name, 'Plan actualizado')
    assert.equal(current.maxClients, 55)
    assert.equal(Number(current.priceMxn), 849)
  }
  const q = await quote(a.token, plan.id)
  assert.equal(q.amountCents, 84900)
  assert.equal(q.planName, 'Plan actualizado')
  assert.equal(q.limit, 55)
  const username = `catalog.${++seq}`
  const registration = {
    fullName: 'Interés catálogo',
    username,
    email: `${username}@example.com`,
    emailConfirmation: `${username}@example.com`,
    password: 'ClaveLocalDePrueba2026',
    passwordConfirmation: 'ClaveLocalDePrueba2026',
    planInterestId: plan.id,
    noticeVersion: '2026-10-15.1',
    acceptsNotice: true,
  }
  const registered = await request(app)
    .post('/api/auth/professionals')
    .send(registration)
  assert.equal(registered.status, 201, JSON.stringify(registered.body))
  assert.equal(
    (
      await db.query(
        'SELECT plan_interest_id FROM private.professionals WHERE user_id=$1',
        [registered.body.account.id]
      )
    ).rows[0].plan_interest_id,
    plan.id
  )
  await db.query('UPDATE private.saas_plans SET is_active=false WHERE id=$1', [
    plan.id,
  ])
  assert.ok(
    !(await request(app).get('/api/plans')).body.plans.some(
      (item: { id: string }) => item.id === plan.id
    )
  )
  assert.equal(
    (
      await post(
        `/api/me/payments/${q.id}/confirm`,
        { instrument: 'test_approved' },
        a.token
      )
    ).status,
    409
  )
  const unavailable = await request(app)
    .post('/api/auth/professionals')
    .send({
      ...registration,
      username: `catalog.${++seq}`,
      email: `catalog.${seq}@example.com`,
      emailConfirmation: `catalog.${seq}@example.com`,
    })
  assert.equal(unavailable.status, 409)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
process.env.AUTH_JWT_SECRET = 'saas-local-only-secret-at-least-32-bytes'
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const { setAccountStatus } =
  await import('../src/features/auth/services/session.js')
const url = process.env.TEST_DATABASE_URL!
if (
  !url ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
)
  throw new Error('Local database required')
const owner = new Pool({ connectionString: url }),
  dbName = `cof_saas_${randomBytes(5).toString('hex')}`
let db: Pool,
  runtime: Pool,
  app: ReturnType<typeof createApp>,
  admin: string,
  basic: string,
  elite: string
let seq = 0
before(async () => {
  await owner.query(`CREATE DATABASE "${dbName}"`)
  const target = new URL(url)
  target.pathname = `/${dbName}`
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
    max: 12,
  })
  app = createApp(runtime)
  admin = (await account('admin')).token
  const plans = (
    await db.query('SELECT id,max_clients FROM private.saas_plans')
  ).rows
  basic = plans.find((p) => p.max_clients === 10).id
  elite = plans.find((p) => p.max_clients === null).id
})
after(async () => {
  await runtime?.end()
  await db?.end()
  await owner.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  await owner.end()
})
async function account(role = 'professional') {
  const name = `saas.${++seq}`
  const {
    rows: [u],
  } = await db.query(
    'INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, `${name}@example.com`, '$argon2id$fixture', role]
  )
  const {
    rows: [s],
  } = await db.query(
    'INSERT INTO private.sessions (user_id) VALUES ($1) RETURNING id',
    [u.id]
  )
  const professionalId =
    role === 'professional'
      ? (
          await db.query(
            "INSERT INTO private.professionals (user_id,full_name) VALUES ($1,'Profesional SaaS') RETURNING id",
            [u.id]
          )
        ).rows[0].id
      : ''
  return { id: u.id, professionalId, token: await signAccess(u.id, s.id) }
}
async function mutation(
  method: 'post' | 'put' | 'patch',
  path: string,
  body: unknown,
  token = admin
) {
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
const get = (path: string, token = admin) =>
  request(app).get(path).set('Cookie', `cof_access=${token}`)
const future = () => new Date(Date.now() + 30 * 86400000).toISOString()
async function fixtureSubscription(
  professionalId: string,
  data: { planId?: string; status?: string; expiresAt?: string }
) {
  await db.query(
    `INSERT INTO private.subscriptions(professional_id,plan_id,status,expires_at) VALUES($1,$2,$3,$4)
    ON CONFLICT(professional_id) DO UPDATE SET plan_id=COALESCE($5,private.subscriptions.plan_id),status=COALESCE($6,private.subscriptions.status),expires_at=COALESCE($7,private.subscriptions.expires_at)`,
    [
      professionalId,
      data.planId ?? basic,
      data.status ?? 'active',
      data.expiresAt ?? future(),
      data.planId ?? null,
      data.status ?? null,
      data.expiresAt ?? null,
    ]
  )
  return { status: 200 }
}
async function subscribed(planId = basic) {
  const pro = await account()
  await fixtureSubscription(pro.professionalId, { planId })
  return pro
}
const clientInput = {
  fullName: 'Cliente prueba',
  goal: null,
  birthDate: '1990-05-20',
  heightCm: 170.5,
  weightKg: 70.2,
  bodyFatPercentage: null,
  waistCm: null,
  hipCm: null,
}
const create = (token: string, input: Record<string, unknown> = {}) =>
  mutation('post', '/api/clients', { ...clientInput, ...input }, token)
test('catalog rejects unauthorized writes, requires CSRF, audits edits, rejects duplicate names', async () => {
  const pro = await account(),
    body = {
      name: 'Plan prueba',
      maxClients: 2,
      isUnlimited: false,
      priceMxn: 100,
    }
  assert.equal((await get('/api/admin/plans', pro.token)).status, 403)
  assert.equal(
    (
      await request(app)
        .post('/api/admin/plans')
        .set('Cookie', `cof_access=${admin}`)
        .send(body)
    ).status,
    403
  )
  const r = await mutation('post', '/api/admin/plans', body)
  assert.equal(r.status, 201, JSON.stringify(r.body))
  assert.equal(
    (
      await mutation('post', '/api/admin/plans', {
        ...body,
        name: ' PLAN PRUEBA ',
      })
    ).status,
    409
  )
  assert.equal(
    (
      await mutation('put', `/api/admin/plans/${r.body.plan.id}`, {
        ...body,
        isActive: false,
        maxClients: 1,
      })
    ).status,
    200
  )
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.plan_history WHERE plan_id=$1',
        [r.body.plan.id]
      )
    ).rows[0].n,
    2
  )
  assert.equal(
    (
      await mutation(
        'patch',
        `/api/admin/professionals/${pro.professionalId}/subscription`,
        { planId: r.body.plan.id, expiresAt: future() }
      )
    ).status,
    403
  )
  assert.equal(
    (await mutation('put', '/api/admin/plans/bad', body)).status,
    400
  )
})
test('no subscription grants zero capacity and ownership cannot be overridden', async () => {
  const pro = await account(),
    r = await get('/api/me/subscription?userId=another', pro.token)
  assert.equal(r.status, 200)
  assert.equal(r.body.subscription.status, 'none')
  assert.equal(r.body.subscription.limit, 0)
  assert.equal(r.body.subscription.remaining, 0)
  const fail = await create(pro.token)
  assert.equal(fail.status, 403)
  assert.equal(fail.body.error.code, 'PLAN_REQUIRED')
  assert.equal((await create(admin)).status, 403)
  assert.equal(
    (
      await mutation(
        'patch',
        `/api/admin/professionals/${pro.professionalId}/subscription`,
        { planId: basic },
        pro.token
      )
    ).status,
    403
  )
})
test('creates a complete initial record and reports field validation errors', async () => {
  const pro = await subscribed()
  const created = await create(pro.token, {
    fullName: '  Laura Méndez  ',
    goal: 'Mejorar fuerza',
    bodyFatPercentage: 24.6,
    waistCm: 71.3,
    hipCm: 98.4,
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.deepEqual(created.body.client, {
    id: created.body.client.id,
    fullName: 'Laura Méndez',
    goal: 'Mejorar fuerza',
    birthDate: '1990-05-20',
    heightCm: 170.5,
    weightKg: 70.2,
    bodyFatPercentage: 24.6,
    waistCm: 71.3,
    hipCm: 98.4,
    status: 'active',
  })
  const incomplete = await mutation(
    'post',
    '/api/clients',
    { fullName: 'Cliente incompleto', goal: null },
    pro.token
  )
  assert.equal(incomplete.status, 400)
  assert.deepEqual(incomplete.body.error.fields, {
    birthDate: 'Ingresa una fecha de nacimiento válida.',
    heightCm: 'Este dato es obligatorio.',
    weightKg: 'Este dato es obligatorio.',
  })
  const invalid = await create(pro.token, {
    birthDate: '2020-01-01',
    heightCm: 100.05,
    weightKg: 29.9,
    bodyFatPercentage: 60.1,
    waistCm: 39.9,
    hipCm: 250.1,
  })
  assert.equal(invalid.status, 400)
  assert.deepEqual(Object.keys(invalid.body.error.fields).sort(), [
    'birthDate',
    'bodyFatPercentage',
    'heightCm',
    'hipCm',
    'waistCm',
    'weightKg',
  ])
})
test('rejects a manipulated owner and isolates professionals through API and runtime RLS', async () => {
  const owner = await subscribed()
  const other = await subscribed()
  const created = await create(owner.token)
  assert.equal(created.status, 201)
  const manipulated = await mutation(
    'post',
    '/api/clients',
    { ...clientInput, professionalId: owner.professionalId },
    other.token
  )
  assert.equal(manipulated.status, 400)
  assert.equal(manipulated.body.error.code, 'INVALID_INPUT')
  assert.equal(
    (
      await mutation(
        'patch',
        `/api/clients/${created.body.client.id}/status`,
        { status: 'inactive' },
        other.token
      )
    ).status,
    404
  )
  await assert.rejects(
    runtime.query(
      `INSERT INTO private.clients(
        professional_id,full_name,birth_date,height_cm,weight_kg
      ) VALUES($1,$2,$3,$4,$5)`,
      [owner.professionalId, 'Sin contexto', '1990-05-20', 170, 70]
    ),
    { code: '42501' }
  )
  const connection = await runtime.connect()
  try {
    await connection.query('BEGIN')
    await connection.query("SELECT set_config('app.subject_id',$1,true)", [
      other.id,
    ])
    await assert.rejects(
      connection.query(
        `INSERT INTO private.clients(
          professional_id,full_name,birth_date,height_cm,weight_kg
        ) VALUES($1,$2,$3,$4,$5)`,
        [owner.professionalId, 'Propietario manipulado', '1990-05-20', 170, 70]
      ),
      { code: '42501' }
    )
  } finally {
    await connection.query('ROLLBACK')
    connection.release()
  }
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1',
        [owner.professionalId]
      )
    ).rows[0].n,
    1
  )
})
test('a persistence failure rolls back the complete record and keeps capacity', async () => {
  const plan = await mutation('post', '/api/admin/plans', {
    name: 'Atomic client record',
    maxClients: 1,
    isUnlimited: false,
    priceMxn: 299,
  })
  assert.equal(plan.status, 201)
  const pro = await subscribed(plan.body.plan.id)
  await db.query(`CREATE FUNCTION private.fail_client_record_insert() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END; $$`)
  await db.query(`CREATE TRIGGER fail_client_record_insert
    AFTER INSERT ON private.clients FOR EACH ROW
    EXECUTE FUNCTION private.fail_client_record_insert()`)
  try {
    const failed = await create(pro.token)
    assert.equal(failed.status, 503)
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1',
          [pro.professionalId]
        )
      ).rows[0].n,
      0
    )
  } finally {
    await db.query('DROP TRIGGER fail_client_record_insert ON private.clients')
    await db.query('DROP FUNCTION private.fail_client_record_insert()')
  }
  assert.equal((await create(pro.token)).status, 201)
})
test('concurrent creation and reactivation reserve exactly one last place and deactivation frees it', async () => {
  const pro = await subscribed()
  await db.query(
    "INSERT INTO private.clients (professional_id,full_name) SELECT $1,'Cliente '||n FROM generate_series(1,9) n",
    [pro.professionalId]
  )
  const {
    rows: [inactive],
  } = await db.query(
    "INSERT INTO private.clients (professional_id,full_name,status) VALUES ($1,'Inactivo','inactive') RETURNING id",
    [pro.professionalId]
  )
  const results = await Promise.all([
    create(pro.token),
    mutation(
      'patch',
      `/api/clients/${inactive.id}/status`,
      { status: 'active' },
      pro.token
    ),
  ])
  assert.equal(
    results.filter((r) => [200, 201].includes(r.status)).length,
    1,
    JSON.stringify(results.map((r) => r.body))
  )
  assert.equal(
    results.filter(
      (r) => r.status === 409 && r.body.error.code === 'CUPO_AGOTADO'
    ).length,
    1
  )
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1 AND status='active'",
        [pro.professionalId]
      )
    ).rows[0].n,
    10
  )
  const {
    rows: [active],
  } = await db.query(
    "SELECT id FROM private.clients WHERE professional_id=$1 AND status='active' LIMIT 1",
    [pro.professionalId]
  )
  assert.equal(
    (
      await mutation(
        'patch',
        `/api/clients/${active.id}/status`,
        { status: 'inactive' },
        pro.token
      )
    ).status,
    200
  )
  assert.equal((await create(pro.token)).status, 201)
  const other = await subscribed()
  assert.equal(
    (
      await mutation(
        'patch',
        `/api/clients/${active.id}/status`,
        { status: 'active' },
        other.token
      )
    ).status,
    404
  )
})
test('downgrade preserves clients, permits reserved invitations and atomically redeems without extra quota', async () => {
  const pro = await subscribed(elite)
  await db.query(
    "INSERT INTO private.clients (professional_id,full_name) SELECT $1,'Cliente '||n FROM generate_series(1,11) n",
    [pro.professionalId]
  )
  assert.equal(
    (await fixtureSubscription(pro.professionalId, { planId: basic })).status,
    200
  )
  const sub = (await get('/api/me/subscription', pro.token)).body.subscription
  assert.equal(sub.used, 11)
  assert.equal(sub.remaining, 0)
  assert.equal(sub.excess, 1)
  assert.equal((await create(pro.token)).status, 409)
  const {
    rows: [record],
  } = await db.query(
    'SELECT id FROM private.clients WHERE professional_id=$1 LIMIT 1',
    [pro.professionalId]
  )
  const invite = await mutation(
    'post',
    `/api/clients/${record.id}/invitations`,
    {},
    pro.token
  )
  assert.equal(invite.status, 201, JSON.stringify(invite.body))
  assert.equal(invite.body.code.length, 43)
  const name = `redeemed.${++seq}`,
    password = 'Una contraseña segura 123'
  const redeemed = await request(app)
    .post('/api/auth/activation')
    .send({
      code: invite.body.code,
      username: name,
      email: `${name}@example.com`,
      emailConfirmation: `${name}@example.com`,
      password,
      passwordConfirmation: password,
      noticeVersion: '2026-10-15.1',
      acceptsNotice: true,
    })
  assert.equal(redeemed.status, 201, JSON.stringify(redeemed.body))
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1',
        [pro.professionalId]
      )
    ).rows[0].n,
    11
  )
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.invitations WHERE client_id=$1',
        [record.id]
      )
    ).rows[0].n,
    0
  )
  await assert.rejects(
    db.query('DELETE FROM private.saas_plans WHERE id=$1', [basic]),
    { code: '23503' }
  )
})
test('legacy suspension preserves sessions and client reads while business is blocked', async () => {
  const pro = await subscribed(),
    created = await create(pro.token),
    client = await account('client')
  await db.query('UPDATE private.clients SET user_id=$2 WHERE id=$1', [
    created.body.client.id,
    client.id,
  ])
  assert.equal(
    (await fixtureSubscription(pro.professionalId, { status: 'suspended' }))
      .status,
    200
  )
  assert.equal((await get('/api/auth/session', pro.token)).status, 200)
  assert.equal((await get('/api/professional/profile', pro.token)).status, 200)
  assert.equal(
    (await db.query('SELECT status FROM private.users WHERE id=$1', [pro.id]))
      .rows[0].status,
    'active'
  )
  const read = await request(app)
    .get('/api/client/profile')
    .set('Authorization', `Bearer ${client.token}`)
  assert.equal(read.status, 200, JSON.stringify(read.body))
  assert.equal((await create(pro.token)).status, 403)
  assert.equal((await get('/api/clients', pro.token)).body.clients.length, 0)
  assert.equal(
    (await fixtureSubscription(pro.professionalId, { status: 'active' }))
      .status,
    200
  )
  assert.equal(
    (await get('/api/me/subscription', pro.token)).body.subscription.used,
    1
  )
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS n FROM private.subscription_history WHERE professional_id=$1',
        [pro.professionalId]
      )
    ).rows[0].n,
    0
  )
})
test('expiry, unlimited capacity, immediate catalog edits and minimal paginated directory', async () => {
  const pro = await subscribed(elite)
  const sub = (await get('/api/me/subscription', pro.token)).body.subscription
  assert.equal(sub.isUnlimited, true)
  assert.equal(sub.remaining, null)
  await db.query(
    "UPDATE private.subscriptions SET expires_at=clock_timestamp()-interval '1 second' WHERE professional_id=$1",
    [pro.professionalId]
  )
  assert.equal(
    (await get('/api/me/subscription', pro.token)).body.subscription.status,
    'expired'
  )
  assert.equal((await create(pro.token)).status, 403)
  const first = await get('/api/admin/professionals?pageSize=2'),
    second = await get('/api/admin/professionals?pageSize=2&page=2')
  assert.equal(first.status, 200)
  assert.equal(first.body.professionals.length, 2)
  assert.equal(
    new Set(
      [...first.body.professionals, ...second.body.professionals].map(
        (p) => p.id
      )
    ).size,
    4
  )
  assert.ok(
    first.body.professionals.every(
      (p) => !('goal' in p) && !('password_hash' in p)
    )
  )
  assert.equal((await get('/api/admin/professionals?page=0')).status, 400)
  assert.equal(
    (await get('/api/admin/professionals?page=999')).body.professionals.length,
    0
  )
  assert.ok(
    (
      await get('/api/admin/professionals?status=expired')
    ).body.professionals.every((p) => p.subscriptionStatus === 'expired')
  )
  const small = await subscribed()
  const plan = (await get('/api/admin/plans')).body.plans.find(
    (p) => p.id === basic
  )
  assert.equal(
    (
      await mutation('put', `/api/admin/plans/${basic}`, {
        name: plan.name,
        maxClients: 1,
        isUnlimited: false,
        priceMxn: Number(plan.priceMxn),
        isActive: true,
      })
    ).status,
    200
  )
  assert.equal((await create(small.token)).status, 201)
  assert.equal((await create(small.token)).status, 409)
})
test('two creations race for one remaining place and concurrent suspension preserves a valid serial outcome', async () => {
  const plan = await mutation('post', '/api/admin/plans', {
    name: 'Concurrent single place',
    maxClients: 1,
    isUnlimited: false,
    priceMxn: 299,
  })
  assert.equal(plan.status, 201)
  const pro = await subscribed(plan.body.plan.id)
  const results = await Promise.all([create(pro.token), create(pro.token)])
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409])
  const other = await subscribed(elite)
  const race = await Promise.all([
    create(other.token),
    fixtureSubscription(other.professionalId, { status: 'suspended' }),
  ])
  assert.equal(race[1].status, 200)
  assert.ok([201, 403].includes(race[0].status))
  const count = (
    await db.query(
      'SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1',
      [other.professionalId]
    )
  ).rows[0].n
  assert.equal(count, race[0].status === 201 ? 1 : 0)
  assert.equal((await create(other.token)).status, 403)
})
test('reactivating an account cannot reactivate its record or bypass subscription quota', async () => {
  const pro = await subscribed()
  const client = await account('client')
  const created = await create(pro.token)
  assert.equal(created.status, 201)
  await db.query(
    "UPDATE private.clients SET user_id=$2,status='inactive' WHERE id=$1",
    [created.body.client.id, client.id]
  )
  await setAccountStatus(db, client.id, 'inactive')
  await setAccountStatus(db, client.id, 'active')
  assert.equal(
    (
      await db.query('SELECT status FROM private.clients WHERE id=$1', [
        created.body.client.id,
      ])
    ).rows[0].status,
    'inactive'
  )
})

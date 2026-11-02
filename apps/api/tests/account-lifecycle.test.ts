import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { after, before, beforeEach, test } from 'node:test'
import { argon2id, hash, verify } from 'argon2'
import { Pool } from 'pg'
import request from 'supertest'
import type { Express } from 'express'

const run = randomBytes(4).toString('hex')
const password = ' contraseña 🔐 de prueba '
const nextPassword = ' nueva contraseña 🔐 segura '
let owner: Pool,
  database: Pool,
  runtime: Pool,
  app: Express,
  dbName: string,
  runtimeRole: string,
  digest: string
let clock = new Date(),
  sequence = 0
let pro: string,
  proRecord: string,
  otherPro: string,
  admin: string,
  clientId: string,
  clientUser: string,
  recordId: string
let proAccess: { cookies: string[]; csrf: string },
  otherAccess: typeof proAccess,
  adminAccess: typeof proAccess
let clientSession: { accessToken: string; refreshToken: string }
let createApp: typeof import('../src/app.js').createApp

before(async () => {
  const url = process.env.TEST_DATABASE_URL
  if (
    !url ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  )
    throw new Error('TEST_DATABASE_URL local exclusiva requerida')
  owner = new Pool({ connectionString: url })
  dbName = `cof_lifecycle_${run}`
  runtimeRole = `cof_lifecycle_${run}`
  await owner.query(`CREATE DATABASE "${dbName}"`)
  const target = new URL(url)
  target.pathname = `/${dbName}`
  database = new Pool({ connectionString: target.toString() })
  await database.query(
    readFileSync(
      new URL(
        '../../../docs/database/schemas/identity_access.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  // Hex-only random password keeps SCRAM authentication enabled on local servers.
  // This credential lives only for this test role and is never printed or saved.
  const runtimePassword = randomBytes(32).toString('hex')
  await owner.query(`CREATE ROLE ${runtimeRole} LOGIN PASSWORD '${runtimePassword}'`)
  await owner.query(`GRANT couchone_authentication TO ${runtimeRole}`)
  target.username = runtimeRole
  target.password = runtimePassword
  runtime = new Pool({
    connectionString: target.toString(),
    max: 8,
    options: '-c statement_timeout=10000',
  })
  process.env.DATABASE_URL = target.toString()
  process.env.AUTH_JWT_SECRET = 'lifecycle-local-only-secret-at-least-32-bytes'
  process.env.CORS_ORIGIN = 'http://localhost:5173'
  createApp = (await import('../src/app.js')).createApp
  digest = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
})
after(async () => {
  await runtime?.end()
  await database?.end()
  if (dbName) await owner?.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  if (runtimeRole) await owner?.query(`DROP ROLE IF EXISTS ${runtimeRole}`)
  await owner?.end()
})
async function user(role: string) {
  const name = `${role}.${run}.${++sequence}`
  const {
    rows: [row],
  } = await database.query(
    'INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, `${name}@example.com`, digest, role]
  )
  if (role === 'professional') {
    const {
      rows: [profile],
    } = await database.query(
      "INSERT INTO private.professionals (user_id,full_name) VALUES ($1,'Profesional de prueba') RETURNING id",
      [row.id]
    )
    await database.query(
      "INSERT INTO private.subscriptions (professional_id,plan_id,expires_at) VALUES ($1,(SELECT id FROM private.saas_plans WHERE name='Básico 10'),clock_timestamp()+interval '365 days')",
      [profile.id]
    )
    return { ...row, name, profileId: profile.id }
  }
  return { ...row, name }
}
async function webLogin(identifier: string) {
  const csrf = await request(app).get('/api/auth/csrf')
  const csrfCookie = (csrf.headers['set-cookie'] as string[]).map(
    (item) => item.split(';')[0]
  )
  const response = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', csrfCookie)
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ identifier, password })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return {
    cookies: [
      ...csrfCookie,
      ...(response.headers['set-cookie'] as string[]).map(
        (item) => item.split(';')[0]
      ),
    ],
    csrf: csrf.body.csrfToken,
  }
}
function authorized(
  method: 'post' | 'delete',
  path: string,
  access = proAccess
) {
  return request(app)
    [method](path)
    .set('Origin', 'http://localhost:5173')
    .set('Cookie', access.cookies)
    .set('X-CSRF-Token', access.csrf)
}
function activation(code: string, extra: Record<string, unknown> = {}) {
  const name = `activated.${run}.${++sequence}`
  return {
    code,
    username: name,
    email: `${name}@example.com`,
    emailConfirmation: `${name}@example.com`,
    password,
    passwordConfirmation: password,
    noticeVersion: '2026-10-15.1',
    acceptsNotice: true,
    ...extra,
  }
}
async function invitation(id = recordId) {
  const response = await authorized(
    'post',
    `/api/clients/${id}/invitations`
  ).send({})
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.code as string
}
beforeEach(async () => {
  clock = new Date()
  app = createApp(runtime, { now: () => clock })
  const first = await user('professional'),
    second = await user('professional'),
    root = await user('admin'),
    athlete = await user('client')
  pro = first.id
  proRecord = first.profileId
  otherPro = second.id
  admin = root.id
  clientUser = athlete.id
  const { rows } = await database.query(
    "INSERT INTO private.clients (professional_id,user_id,full_name,goal) VALUES ($1,$2,'Cliente vinculado','Fuerza'),($1,NULL,'Cliente preparado','Resistencia') RETURNING id",
    [proRecord, clientUser]
  )
  clientId = rows[0].id
  recordId = rows[1].id
  proAccess = await webLogin(first.name)
  otherAccess = await webLogin(second.name)
  adminAccess = await webLogin(root.name)
  const login = await request(app)
    .post('/api/auth/client/login')
    .send({ identifier: athlete.name, password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  clientSession = login.body.session
})

test('credentials require current password, reject identity manipulation and duplicates, revoke all sessions and preserve record', async () => {
  const before = (
    await database.query('SELECT * FROM private.clients WHERE id=$1', [
      clientId,
    ])
  ).rows[0]
  const data = {
    username: `changed.${run}.${++sequence}`,
    currentPassword: password,
    password: nextPassword,
    passwordConfirmation: nextPassword,
  }
  const change = (body: unknown) =>
    request(app)
      .patch('/api/me/credentials')
      .set('Authorization', `Bearer ${clientSession.accessToken}`)
      .send(body)
  for (const body of [
    { ...data, userId: otherPro },
    { ...data, passwordConfirmation: 'otra' },
    { ...data, password: 'corta' },
    { ...data, role: 'admin' },
  ])
    assert.equal((await change(body)).status, 400)
  assert.equal(
    (await change({ ...data, currentPassword: 'clave equivocada' })).status,
    403
  )
  const occupied = (
    await database.query('SELECT username FROM private.users WHERE id=$1', [
      otherPro,
    ])
  ).rows[0].username
  assert.equal((await change({ ...data, username: occupied })).status, 409)
  const old = (
    await database.query(
      'SELECT username,password_hash FROM private.users WHERE id=$1',
      [clientUser]
    )
  ).rows[0]
  const secondSession = await request(app)
    .post('/api/auth/client/login')
    .send({ identifier: old.username, password })
  assert.equal(secondSession.status, 200)
  assert.equal(await verify(old.password_hash, password), true)
  const result = await change(data)
  assert.equal(result.status, 204)
  assert.equal(result.text, '')
  assert.equal(
    (
      await request(app)
        .get('/api/client/profile')
        .set(
          'Authorization',
          `Bearer ${secondSession.body.session.accessToken}`
        )
    ).status,
    401
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/client/refresh')
        .send({ refreshToken: secondSession.body.session.refreshToken })
    ).status,
    401
  )
  assert.deepEqual(
    (
      await database.query('SELECT * FROM private.clients WHERE id=$1', [
        clientId,
      ])
    ).rows[0],
    before
  )
  for (const credentials of [
    { identifier: old.username, password },
    { identifier: data.username, password },
  ])
    assert.equal(
      (await request(app).post('/api/auth/client/login').send(credentials))
        .status,
      401
    )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/client/login')
        .send({ identifier: data.username, password: nextPassword })
    ).status,
    200
  )
  assert.equal(
    (
      await request(app)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${clientSession.accessToken}`)
    ).status,
    401
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/client/refresh')
        .send({ refreshToken: clientSession.refreshToken })
    ).status,
    401
  )
})

test('invitation ownership, active state, CSRF, replacement, revoke and minimal prevalidation', async () => {
  assert.equal(
    (
      await authorized(
        'post',
        `/api/clients/${recordId.toUpperCase()}/invitations`
      ).send({})
    ).status,
    201
  )
  assert.equal(
    (
      await authorized(
        'post',
        `/api/clients/${recordId}/invitations`,
        otherAccess
      ).send({})
    ).status,
    400
  )
  assert.equal(
    (await authorized('post', `/api/clients/${clientId}/invitations`).send({}))
      .status,
    400
  )
  assert.equal(
    (
      await request(app)
        .post(`/api/clients/${recordId}/invitations`)
        .set('Cookie', proAccess.cookies)
        .send({})
    ).status,
    403
  )
  const old = await invitation(),
    current = await invitation()
  assert.match(current, /^[\w-]{43}$/)
  assert.notEqual(current, old)
  assert.equal(
    (
      await database.query(
        'SELECT extract(epoch FROM expires_at-created_at)::int AS ttl FROM private.invitations WHERE client_id=$1',
        [recordId]
      )
    ).rows[0].ttl,
    604800
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/activation/prevalidate')
        .send({ code: old })
    ).status,
    400
  )
  for (let i = 0; i < 2; i++) {
    const pre = await request(app)
      .post('/api/auth/activation/prevalidate')
      .send({ code: current })
    assert.equal(pre.status, 200)
    assert.deepEqual(pre.body, { valid: true })
  }
  const listing = await request(app)
    .get('/api/clients')
    .set('Cookie', proAccess.cookies)
  assert.equal(listing.status, 200)
  assert.equal(JSON.stringify(listing.body).includes(current), false)
  assert.equal(JSON.stringify(listing.body).includes('token_hash'), false)
  assert.equal(
    (
      await authorized('delete', `/api/clients/${recordId}/invitations`).send(
        {}
      )
    ).status,
    204
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/activation/prevalidate')
        .send({ code: current })
    ).status,
    400
  )
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.invitations WHERE client_id=$1',
        [recordId]
      )
    ).rows[0].count,
    '0'
  )
})

test('invitation and activation enforce server expiration and current professional, subscription and record states', async () => {
  const code = await invitation()
  const expires = (
    await database.query(
      'SELECT expires_at FROM private.invitations WHERE client_id=$1',
      [recordId]
    )
  ).rows[0].expires_at
  clock = expires
  assert.equal(
    (await request(app).post('/api/auth/activation').send(activation(code)))
      .status,
    400
  )
  clock = new Date()
  for (const table of ['subscriptions', 'clients', 'users']) {
    const id =
      table === 'subscriptions'
        ? proRecord
        : table === 'clients'
          ? recordId
          : pro
    const column = table === 'subscriptions' ? 'professional_id' : 'id'
    const status = table === 'subscriptions' ? 'suspended' : 'inactive'
    await database.query(
      `UPDATE private.${table} SET status=$2 WHERE ${column}=$1`,
      [id, status]
    )
    assert.equal(
      (await request(app).post('/api/auth/activation').send(activation(code)))
        .status,
      400
    )
    await database.query(
      `UPDATE private.${table} SET status='active' WHERE ${column}=$1`,
      [id]
    )
  }
})

test('anonymous activation at the reserved last place is atomic, authenticated, notice-versioned and deletes the hash; replay fails', async () => {
  await database.query(
    "INSERT INTO private.clients (professional_id,full_name) SELECT $1,'Reserva '||g FROM generate_series(1,8) g",
    [proRecord]
  )
  const code = await invitation(),
    body = activation(code)
  const result = await request(app).post('/api/auth/activation').send(body)
  assert.equal(result.status, 201, JSON.stringify(result.body))
  assert.equal(result.body.account.clientId, recordId)
  assert.equal(result.headers['cache-control'], 'no-store')
  assert.equal(JSON.stringify(result.body).includes('password'), false)
  const own = await request(app)
    .get('/api/client/profile')
    .set('Authorization', `Bearer ${result.body.session.accessToken}`)
  assert.equal(own.status, 200)
  assert.equal(own.body.profile.id, recordId)
  assert.equal(own.body.profile.fullName, 'Cliente preparado')
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.clients WHERE professional_id=$1',
        [proRecord]
      )
    ).rows[0].count,
    '10'
  )
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.invitations WHERE client_id=$1',
        [recordId]
      )
    ).rows[0].count,
    '0'
  )
  assert.equal(
    (
      await database.query(
        'SELECT version FROM private.notice_acceptances WHERE user_id=$1',
        [result.body.account.id]
      )
    ).rows[0].version,
    body.noticeVersion
  )
  assert.equal(
    (await request(app).post('/api/auth/activation').send(body)).status,
    400
  )
  const events = (
    await database.query(
      "SELECT * FROM private.access_events WHERE client_id=$1 AND action='account_activated'",
      [recordId]
    )
  ).rows
  assert.equal(events.length, 1)
  assert.equal(JSON.stringify(events).includes(code), false)
})

test('invalid activation, occupied username/email and forged fields preserve the original invitation', async () => {
  const code = await invitation(),
    data = activation(code)
  const occupied = (
    await database.query(
      'SELECT username,email FROM private.users WHERE id=$1',
      [clientUser]
    )
  ).rows[0]
  for (const body of [
    { ...data, username: occupied.username },
    { ...data, email: occupied.email, emailConfirmation: occupied.email },
  ])
    assert.equal(
      (await request(app).post('/api/auth/activation').send(body)).status,
      409
    )
  for (const extra of [
    { acceptsNotice: false },
    { noticeVersion: 'old' },
    { fullName: 'No recapturar' },
    { userId: clientUser },
    { emailConfirmation: 'otro@example.com' },
    { passwordConfirmation: 'no coincide' },
  ])
    assert.equal(
      (
        await request(app)
          .post('/api/auth/activation')
          .send({ ...data, ...extra })
      ).status,
      400
    )
  assert.equal(
    (
      await database.query('SELECT user_id FROM private.clients WHERE id=$1', [
        recordId,
      ])
    ).rows[0].user_id,
    null
  )
  assert.equal(
    (await request(app).post('/api/auth/activation/prevalidate').send({ code }))
      .status,
    200
  )
})

test('two simultaneous redemptions produce exactly one account and one link', async () => {
  const code = await invitation()
  const bodies = [activation(code), activation(code)]
  const results = await Promise.all(
    bodies.map((body) => request(app).post('/api/auth/activation').send(body))
  )
  assert.deepEqual(results.map((item) => item.status).sort(), [201, 400])
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.users WHERE username=ANY($1)',
        [bodies.map((body) => body.username)]
      )
    ).rows[0].count,
    '1'
  )
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.invitations WHERE client_id=$1',
        [recordId]
      )
    ).rows[0].count,
    '0'
  )
})

test('reserved clients remain invitable after downgrade over capacity and concurrent issue does not deadlock across records', async () => {
  const {
    rows: [second],
  } = await database.query(
    "INSERT INTO private.clients (professional_id,full_name) VALUES ($1,'Otra reserva') RETURNING id",
    [proRecord]
  )
  await database.query(
    "INSERT INTO private.clients (professional_id,full_name) SELECT $1,'Reserva excedente '||g FROM generate_series(1,10) g",
    [proRecord]
  )
  const results = await Promise.all(
    [recordId, second.id].map((id) =>
      authorized('post', `/api/clients/${id}/invitations`).send({})
    )
  )
  for (const result of results)
    assert.equal(result.status, 201, JSON.stringify(result.body))
  assert.equal(
    (
      await request(app)
        .post('/api/auth/activation')
        .send(activation(results[0].body.code))
    ).status,
    201
  )
})

test('missing/expired subscription blocks invitation issuance and hides the professional portfolio', async () => {
  await database.query(
    'UPDATE private.subscriptions SET expires_at=$2 WHERE professional_id=$1',
    [proRecord, clock]
  )
  assert.equal(
    (await authorized('post', `/api/clients/${recordId}/invitations`).send({}))
      .status,
    400
  )
  const listing = await request(app)
    .get('/api/clients')
    .set('Cookie', proAccess.cookies)
  assert.equal(listing.status, 200)
  assert.deepEqual(listing.body, { clients: [], hasClients: false, pageInfo: { pageSize: 20, hasMore: false, nextCursor: null } })
  await database.query(
    'DELETE FROM private.subscriptions WHERE professional_id=$1',
    [proRecord]
  )
  assert.equal(
    (await authorized('post', `/api/clients/${recordId}/invitations`).send({}))
      .status,
    400
  )
})

test('invitation replacement racing redemption yields only committed valid outcomes', async () => {
  const old = await invitation(),
    body = activation(old)
  const [redeem, replace] = await Promise.all([
    request(app).post('/api/auth/activation').send(body),
    authorized('post', `/api/clients/${recordId}/invitations`).send({}),
  ])
  assert.deepEqual([redeem.status, replace.status].sort(), [201, 400])
  if (redeem.status === 201) {
    assert.equal(
      (
        await database.query(
          'SELECT count(*) FROM private.invitations WHERE client_id=$1',
          [recordId]
        )
      ).rows[0].count,
      '0'
    )
  } else {
    assert.equal(
      (
        await database.query(
          'SELECT user_id FROM private.clients WHERE id=$1',
          [recordId]
        )
      ).rows[0].user_id,
      null
    )
    assert.equal(
      (
        await request(app)
          .post('/api/auth/activation/prevalidate')
          .send({ code: replace.body.code })
      ).status,
      200
    )
  }
})

test('failure at each activation stage rolls account, linkage, notice, deletion and audit back together', async () => {
  const code = await invitation()
  for (const [table, operation] of [
    ['users', 'INSERT'],
    ['clients', 'UPDATE'],
    ['notice_acceptances', 'INSERT'],
    ['invitations', 'DELETE'],
    ['access_events', 'INSERT'],
  ]) {
    const body = activation(code)
    await database.query(`CREATE FUNCTION private.fail_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$;
      CREATE TRIGGER fail_lifecycle BEFORE ${operation} ON private.${table} FOR EACH ROW EXECUTE FUNCTION private.fail_lifecycle()`)
    try {
      const result = await request(app).post('/api/auth/activation').send(body)
      assert.equal(
        result.status,
        503,
        `${table}: ${JSON.stringify(result.body)}`
      )
      assert.equal(
        (
          await database.query(
            'SELECT count(*) FROM private.users WHERE username=$1',
            [body.username]
          )
        ).rows[0].count,
        '0'
      )
      assert.equal(
        (
          await database.query(
            'SELECT user_id FROM private.clients WHERE id=$1',
            [recordId]
          )
        ).rows[0].user_id,
        null
      )
      assert.equal(
        (
          await database.query(
            'SELECT count(*) FROM private.invitations WHERE client_id=$1',
            [recordId]
          )
        ).rows[0].count,
        '1'
      )
    } finally {
      await database.query(
        `DROP TRIGGER fail_lifecycle ON private.${table}; DROP FUNCTION private.fail_lifecycle()`
      )
    }
  }
})

test('session failure after activation commit preserves account and offers ordinary login', async () => {
  const code = await invitation(),
    body = activation(code)
  await database.query(`CREATE FUNCTION private.fail_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$;
    CREATE TRIGGER fail_session BEFORE INSERT ON private.sessions FOR EACH ROW EXECUTE FUNCTION private.fail_session()`)
  try {
    const result = await request(app).post('/api/auth/activation').send(body)
    assert.equal(result.status, 201)
    assert.equal(result.body.requiresLogin, true)
    assert.equal(result.body.session, undefined)
    assert.equal(
      (
        await database.query(
          'SELECT count(*) FROM private.invitations WHERE client_id=$1',
          [recordId]
        )
      ).rows[0].count,
      '0'
    )
  } finally {
    await database.query(
      'DROP TRIGGER fail_session ON private.sessions; DROP FUNCTION private.fail_session()'
    )
  }
  assert.equal(
    (
      await request(app)
        .post('/api/auth/client/login')
        .send({ identifier: body.username, password })
    ).status,
    200
  )
})

async function recovery(
  userId = clientUser,
  access = proAccess,
  extra: Record<string, unknown> = {}
) {
  return authorized('post', `/api/accounts/${userId}/recovery`, access).send({
    identityVerified: true,
    verificationMethod: 'known_relationship',
    currentPassword: password,
    ...extra,
  })
}
function reset(code: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/auth/recovery/reset')
    .send({
      code,
      password: nextPassword,
      passwordConfirmation: nextPassword,
      ...extra,
    })
}

test('assisted recovery requires ownership, corroboration and operator reauthentication; replaces and consumes reset and revokes every old session', async () => {
  assert.equal((await recovery(clientUser, otherAccess)).status, 403)
  assert.equal(
    (await recovery(clientUser, proAccess, { identityVerified: false })).status,
    400
  )
  assert.equal(
    (await recovery(clientUser, proAccess, { verificationMethod: 'email' }))
      .status,
    400
  )
  assert.equal(
    (await recovery(clientUser, proAccess, { currentPassword: 'incorrecta' }))
      .status,
    403
  )
  assert.equal((await recovery(clientUser, adminAccess)).status, 403)
  const old = await recovery()
  assert.equal(old.status, 201, JSON.stringify(old.body))
  const fresh = await recovery()
  assert.equal(fresh.status, 201)
  assert.equal(
    (
      await database.query(
        'SELECT extract(epoch FROM expires_at-created_at)::int AS ttl FROM private.password_resets WHERE user_id=$1',
        [clientUser]
      )
    ).rows[0].ttl,
    1800
  )
  assert.equal((await reset(old.body.code)).status, 400)
  assert.equal(
    (await reset(fresh.body.code, { passwordConfirmation: 'incorrecta' }))
      .status,
    400
  )
  const before = (
    await database.query('SELECT * FROM private.clients WHERE id=$1', [
      clientId,
    ])
  ).rows[0]
  const result = await reset(fresh.body.code)
  assert.equal(result.status, 204, JSON.stringify(result.body))
  assert.deepEqual(
    (
      await database.query('SELECT * FROM private.clients WHERE id=$1', [
        clientId,
      ])
    ).rows[0],
    before
  )
  assert.equal((await reset(fresh.body.code)).status, 400)
  assert.equal(
    (
      await request(app)
        .get('/api/client/profile')
        .set('Authorization', `Bearer ${clientSession.accessToken}`)
    ).status,
    401
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/client/refresh')
        .send({ refreshToken: clientSession.refreshToken })
    ).status,
    401
  )
  const {
    rows: [account],
  } = await database.query('SELECT username FROM private.users WHERE id=$1', [
    clientUser,
  ])
  assert.equal(
    (
      await request(app)
        .post('/api/auth/client/login')
        .send({ identifier: account.username, password })
    ).status,
    401
  )
  const login = await request(app)
    .post('/api/auth/client/login')
    .send({ identifier: account.username, password: nextPassword })
  assert.equal(login.status, 200)
  assert.equal(login.body.account.id, clientUser)
  assert.equal(login.body.account.clientId, clientId)
})

test('reset expiry at server boundary, replay, concurrent consumption and invitation separation', async () => {
  const invite = await invitation()
  assert.equal((await reset(invite)).status, 400)
  const expired = await recovery()
  assert.equal(expired.status, 201)
  clock = new Date(expired.body.expiresAt)
  assert.equal((await reset(expired.body.code)).status, 400)
  clock = new Date()
  const fresh = await recovery()
  assert.equal(fresh.status, 201)
  const results = await Promise.all([
    reset(fresh.body.code),
    reset(fresh.body.code),
  ])
  assert.deepEqual(results.map((item) => item.status).sort(), [204, 400])
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.password_resets WHERE user_id=$1',
        [clientUser]
      )
    ).rows[0].count,
    '0'
  )
})

test('reset failure rolls back consumption, password and revocation', async () => {
  const fresh = await recovery()
  assert.equal(fresh.status, 201)
  await database.query(`CREATE FUNCTION private.fail_reset() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$;
    CREATE TRIGGER fail_reset BEFORE INSERT ON private.access_events FOR EACH ROW EXECUTE FUNCTION private.fail_reset()`)
  try {
    assert.equal((await reset(fresh.body.code)).status, 503)
    assert.equal(
      (
        await database.query(
          'SELECT count(*) FROM private.password_resets WHERE user_id=$1',
          [clientUser]
        )
      ).rows[0].count,
      '1'
    )
    assert.equal(
      (
        await request(app)
          .get('/api/client/profile')
          .set('Authorization', `Bearer ${clientSession.accessToken}`)
      ).status,
      200
    )
    assert.equal(
      await verify(
        (
          await database.query(
            'SELECT password_hash FROM private.users WHERE id=$1',
            [clientUser]
          )
        ).rows[0].password_hash,
        password
      ),
      true
    )
  } finally {
    await database.query(
      'DROP TRIGGER fail_reset ON private.access_events; DROP FUNCTION private.fail_reset()'
    )
  }
})

test('admin may authorize professional and other admin recovery, never self; public reset does not enumerate accounts', async () => {
  assert.equal((await recovery(pro, adminAccess)).status, 201)
  const another = await user('admin')
  assert.equal((await recovery(another.id, adminAccess)).status, 201)
  assert.equal((await recovery(admin, adminAccess)).status, 403)
  assert.equal((await recovery(admin.toUpperCase(), adminAccess)).status, 403)
  const a = await reset(randomBytes(32).toString('base64url')),
    b = await reset(randomBytes(32).toString('base64url'))
  assert.deepEqual(a.body, b.body)
  assert.equal(
    (
      await request(app)
        .post('/api/auth/recovery/reset')
        .send({ email: 'someone@example.com' })
    ).status,
    400
  )
})

test('custodian command requires privileged connection and only the last active admin', async () => {
  const { issueEmergencyReset } =
    await import('../src/features/auth/repositories/emergency-recovery.js')
  const target = (
    await database.query('SELECT username FROM private.users WHERE id=$1', [
      admin,
    ])
  ).rows[0].username
  await assert.rejects(issueEmergencyReset(runtime, target), /custodia/)
  await assert.rejects(issueEmergencyReset(database, target), /último/)
  await database.query(
    "UPDATE private.users SET status='inactive' WHERE role='admin' AND id<>$1",
    [admin]
  )
  const result = await issueEmergencyReset(database, target)
  assert.match(result.code, /^[\w-]{43}$/)
  assert.equal((await reset(result.code)).status, 204)
})

test('runtime context resets after transactions and cannot change arbitrary credentials, role or delete users', async () => {
  await invitation()
  const updated = await runtime.query(
    "UPDATE private.users SET username='unauthorized.change' WHERE id=$1",
    [clientUser]
  )
  assert.equal(updated.rowCount, 0)
  await assert.rejects(
    runtime.query("UPDATE private.users SET role='admin' WHERE id=$1", [
      clientUser,
    ]),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '42501'
  )
  await assert.rejects(
    runtime.query('DELETE FROM private.users WHERE id=$1', [clientUser]),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '42501'
  )
})

test('daily cleanup removes only expired codes with runtime permissions and preserves live invitations and resets', async () => {
  await invitation()
  assert.equal((await recovery()).status, 201)
  const {
    rows: [live],
  } = await database.query(
    "INSERT INTO private.clients(professional_id,full_name) VALUES($1,'Reserva vigente') RETURNING id",
    [proRecord]
  )
  await invitation(live.id)
  assert.equal((await recovery(pro, adminAccess)).status, 201)
  await database.query(
    "UPDATE private.invitations SET created_at=clock_timestamp()-interval '8 days',expires_at=clock_timestamp()-interval '1 day' WHERE client_id=$1",
    [recordId]
  )
  await database.query(
    "UPDATE private.password_resets SET created_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '30 minutes' WHERE user_id=$1",
    [clientUser]
  )
  const output = execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/cleanup-access-codes.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: runtime.options.connectionString },
      encoding: 'utf8',
    }
  )
  assert.match(output, /removedInvitations: 1/)
  assert.match(output, /removedResets: 1/)
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.invitations WHERE client_id=$1',
        [recordId]
      )
    ).rows[0].count,
    '0'
  )
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.invitations WHERE client_id=$1',
        [live.id]
      )
    ).rows[0].count,
    '1'
  )
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.password_resets WHERE user_id=$1',
        [clientUser]
      )
    ).rows[0].count,
    '0'
  )
  assert.equal(
    (
      await database.query(
        'SELECT count(*) FROM private.password_resets WHERE user_id=$1',
        [pro]
      )
    ).rows[0].count,
    '1'
  )
})

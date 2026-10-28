import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { hash, argon2id } from 'argon2'
import { Pool } from 'pg'
import request from 'supertest'
import { SignJWT, decodeJwt } from 'jose'

process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const databaseUrl = process.env.TEST_DATABASE_URL
if (
  !databaseUrl ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
)
  throw new Error('Se requiere TEST_DATABASE_URL local exclusiva de pruebas')
const pool = new Pool({ connectionString: databaseUrl })
const app = createApp(pool)
const origin = 'http://localhost:5000'
const run = Date.now().toString(36)
const password = ' una frase segura para pruebas 🔐 '
let professionalId: string
let otherId: string

before(async () => {
  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
  for (const [name, role, status] of [
    ['prof', 'professional', 'active'],
    ['otro', 'professional', 'active'],
    ['baja', 'professional', 'inactive'],
    ['client', 'client', 'active'],
    ['admin', 'admin', 'active'],
  ]) {
    const {
      rows: [row],
    } = await pool.query(
      'INSERT INTO private.users (username,email,password_hash,role,status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [
        `${name}.${run}`,
        `${name}.${run}@example.com`,
        passwordHash,
        role,
        status,
      ],
    )
    if (role === 'professional')
      await pool.query(
        'INSERT INTO private.professionals (user_id,full_name) VALUES ($1,$2)',
        [row.id, `Nombre ${name}`],
      )
    if (name === 'prof') professionalId = row.id
    if (name === 'otro') otherId = row.id
  }
})
after(async () => {
  await pool.end()
})

function cookie(response: request.Response, name: string): string {
  return (
    ((response.headers['set-cookie'] as unknown as string[]) ?? [])
      .find((value) => value.startsWith(`${name}=`))
      ?.split(';')[0] ?? ''
  )
}
async function login(
  identifier = `prof.${run}`,
  suppliedPassword = password,
  target = app,
) {
  const csrf = await request(target).get('/api/auth/csrf')
  return request(target)
    .post('/api/auth/login')
    .set('Origin', origin)
    .set('Cookie', cookie(csrf, 'cof_csrf'))
    .set('X-CSRF-Token', csrf.body.csrfToken ?? '')
    .send({ identifier, password: suppliedPassword })
}
async function mutation(
  path: string,
  session: request.Response,
  refresh?: string,
  target = app,
) {
  const csrf = await request(target).get('/api/auth/csrf')
  return request(target)
    .post(path)
    .set('Origin', origin)
    .set(
      'Cookie',
      [
        cookie(csrf, 'cof_csrf'),
        cookie(session, 'cof_access'),
        refresh ?? cookie(session, 'cof_refresh'),
      ]
        .filter(Boolean)
        .join('; '),
    )
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({})
}

test('normalized username or email login creates a session and reads its own profile', async () => {
  for (const identifier of [
    ` PROF.${run.toUpperCase()} `,
    ` PROF.${run.toUpperCase()}@EXAMPLE.COM `,
  ]) {
    const response = await login(identifier)
    assert.equal(response.status, 200)
    assert.equal(response.body.account.id, professionalId)
    assert.equal(response.body.account.role, 'professional')
    assert.equal(response.body.account.subscription, null)
    assert.equal(response.body.accessToken, undefined)
    const access = cookie(response, 'cof_access')
    assert.ok(access)
    for (const value of response.headers['set-cookie'] as unknown as string[]) {
      assert.match(value, /HttpOnly/)
      assert.match(value, /SameSite=Strict/)
      assert.doesNotMatch(value, /Domain=/)
    }
    const claims = decodeJwt(access.slice('cof_access='.length))
    assert.equal(Number(claims.exp) - Number(claims.iat), 900)
    assert.equal(claims.sub, professionalId)
    assert.ok(claims.sid)
    const profile = await request(app)
      .get(`/api/professional/profile?userId=${otherId}`)
      .set('Cookie', access)
    assert.equal(profile.status, 200)
    assert.equal(profile.body.profile.userId, professionalId)
    const {
      rows: [session],
    } = await pool.query('SELECT * FROM private.sessions WHERE id=$1', [
      claims.sid,
    ])
    assert.equal(session.user_id, professionalId)
    assert.equal(
      new Date(session.expires_at).getTime() -
        new Date(session.created_at).getTime(),
      30 * 86400000,
    )
    const {
      rows: [stored],
    } = await pool.query(
      'SELECT token_hash FROM private.refresh_tokens WHERE session_id=$1',
      [claims.sid],
    )
    assert.match(stored.token_hash, /^[a-f0-9]{64}$/)
    assert.notEqual(
      stored.token_hash,
      cookie(response, 'cof_refresh').slice('cof_refresh='.length),
    )
  }
})

test('wrong passwords and missing, inactive, or client accounts return the same response', async () => {
  const responses = [
    await login(`prof.${run}`, 'incorrecta de prueba'),
    await login(`ausente.${run}`),
    await login(`baja.${run}`),
    await login(`client.${run}`),
  ]
  for (const response of responses) {
    assert.equal(response.status, 401)
    assert.deepEqual(response.body, responses[0].body)
    assert.equal(cookie(response, 'cof_access'), '')
  }
})

test('private API requests without a session or with altered or expired tokens return 401', async () => {
  for (const path of ['/api/auth/session', '/api/professional/profile'])
    assert.equal((await request(app).get(path)).status, 401)
  const session = await login()
  const claims = decodeJwt(
    cookie(session, 'cof_access').slice('cof_access='.length),
  )
  const key = new TextEncoder().encode(process.env.AUTH_JWT_SECRET)
  for (const changes of [
    { exp: 1 },
    { sid: randomUUID() },
    { sub: otherId },
    { aud: 'ajena' },
    { iss: 'ajeno' },
  ]) {
    const token = await new SignJWT({ ...claims, ...changes })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(key)
    assert.equal(
      (
        await request(app)
          .get('/api/professional/profile')
          .set('Cookie', `cof_access=${token}`)
      ).status,
      401,
    )
  }
  assert.equal(
    (
      await request(app)
        .get('/api/professional/profile')
        .set('Cookie', `${cookie(session, 'cof_access')}x`)
    ).status,
    401,
  )
})

test('account status is checked on each request and reactivation does not revive sessions', async () => {
  const response = await login(`otro.${run}`)
  try {
    await pool.query(
      "UPDATE private.users SET status='inactive' WHERE id=$1",
      [otherId],
    )
    assert.equal(
      (
        await request(app)
          .get('/api/auth/session')
          .set('Cookie', cookie(response, 'cof_access'))
      ).status,
      401,
    )
  } finally {
    await pool.query(
      "UPDATE private.users SET status='active' WHERE id=$1",
      [otherId],
    )
  }
  assert.equal(
    (
      await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie(response, 'cof_access'))
    ).status,
    401,
  )
})

test('absolute database expiry blocks access and refresh even with a valid access token', async () => {
  const response = await login()
  const claims = decodeJwt(
    cookie(response, 'cof_access').slice('cof_access='.length),
  )
  await pool.query(
    "UPDATE private.sessions SET created_at=now()-interval '31 days',expires_at=now()-interval '1 day' WHERE id=$1",
    [claims.sid],
  )
  assert.equal(
    (
      await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie(response, 'cof_access'))
    ).status,
    401,
  )
  assert.equal((await mutation('/api/auth/refresh', response)).status, 401)
})

test('simultaneous refresh attempts cannot both rotate the same token', async () => {
  const response = await login()
  const results = await Promise.all([
    mutation('/api/auth/refresh', response),
    mutation('/api/auth/refresh', response),
  ])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401])
  const winner = results.find((r) => r.status === 200)!
  assert.equal(
    (
      await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie(winner, 'cof_access'))
    ).status,
    401,
  )
})

test('refresh creation failure rolls back the session and exposes no internal details', async () => {
  const {
    rows: [initial],
  } = await pool.query('SELECT count(*) FROM private.sessions')
  await pool.query(
    "CREATE FUNCTION private.fail_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'detalle de infraestructura private'; END $$",
  )
  await pool.query(
    'CREATE TRIGGER fail_session_insert BEFORE INSERT ON private.refresh_tokens FOR EACH ROW EXECUTE FUNCTION private.fail_session_insert()',
  )
  try {
    const response = await login()
    assert.equal(response.status, 503)
    assert.equal(cookie(response, 'cof_access'), '')
    assert.equal(
      JSON.stringify(response.body).includes('infraestructura privado'),
      false,
    )
    const {
      rows: [final],
    } = await pool.query('SELECT count(*) FROM private.sessions')
    assert.equal(final.count, initial.count)
  } finally {
    await pool.query(
      'DROP TRIGGER fail_session_insert ON private.refresh_tokens',
    )
    await pool.query('DROP FUNCTION private.fail_session_insert()')
  }
})

test('refresh preserves absolute expiry and replay revokes the current access token', async () => {
  const first = await login()
  const claims = decodeJwt(
    cookie(first, 'cof_access').slice('cof_access='.length),
  )
  const next = await mutation('/api/auth/refresh', first)
  assert.equal(next.status, 200)
  assert.notEqual(cookie(next, 'cof_refresh'), cookie(first, 'cof_refresh'))
  const {
    rows: [session],
  } = await pool.query('SELECT * FROM private.sessions WHERE id=$1', [
    claims.sid,
  ])
  assert.equal(
    new Date(session.expires_at).getTime() -
      new Date(session.created_at).getTime(),
    30 * 86400000,
  )
  assert.equal((await mutation('/api/auth/refresh', first)).status, 401)
  assert.equal(
    (
      await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie(next, 'cof_access'))
    ).status,
    401,
  )
})

test('logout revokes the session and prevents access or refresh token reuse', async () => {
  const response = await login()
  assert.equal((await mutation('/api/auth/logout', response)).status, 204)
  assert.equal(
    (
      await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie(response, 'cof_access'))
    ).status,
    401,
  )
  assert.equal((await mutation('/api/auth/refresh', response)).status, 401)
})

test('Origin and CSRF are required and login payloads cannot assign roles', async () => {
  for (const path of [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
  ]) {
    assert.equal((await request(app).post(path).send({})).status, 403)
    assert.equal(
      (await request(app).post(path).set('Origin', origin).send({})).status,
      403,
    )
  }
  const csrf = await request(app).get('/api/auth/csrf')
  const response = await request(app)
    .post('/api/auth/login')
    .set('Origin', origin)
    .set('Cookie', cookie(csrf, 'cof_csrf'))
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ identifier: `prof.${run}`, password: password, role: 'admin' })
  assert.equal(response.status, 400)
})

test('login attempts are rate limited before password hashing', async () => {
  const isolated = createApp(pool)
  for (let i = 0; i < 20; i++) await login('ausente', password, isolated)
  const response = await login('ausente', password, isolated)
  assert.equal(response.status, 429)
  assert.ok(response.headers['retry-after'])
})

test('runtime without DDL can authenticate but cannot create an admin', async () => {
  const restricted = new Pool({
    connectionString: databaseUrl,
    options: '-c role=couchone_authentication',
  })
  try {
    const response = await login(`prof.${run}`, password, createApp(restricted))
    assert.equal(response.status, 200)
    const profile = await request(createApp(restricted))
      .get('/api/professional/profile')
      .set('Cookie', cookie(response, 'cof_access'))
    assert.equal(profile.status, 200)
    assert.equal(profile.body.profile.userId, professionalId)
    await assert.rejects(
      restricted.query(
        "UPDATE private.users SET role='admin' WHERE id=$1",
        [professionalId],
      ),
      { code: '42501' },
    )
  } finally {
    await restricted.end()
  }
})

test('production session cookies are secure and tokens are not exposed to clients', async () => {
  const { config } = await import('../src/config/index.js')
  const previous = config.nodeEnv
  config.nodeEnv = 'production'
  try {
    const response = await login(`prof.${run}`, password, createApp(pool))
    assert.equal(response.status, 200)
    for (const header of response.headers['set-cookie'] as unknown as string[])
      assert.match(header, /Secure/)
    assert.equal(response.body.refreshToken, undefined)
  } finally {
    config.nodeEnv = previous
  }
})

test('login and profile fail safely when the database is unavailable', async () => {
  const existing = await login(`prof.${run}`, password, createApp(pool))
  const unavailable = new Pool({
    connectionString: 'postgresql://postgres@127.0.0.1:1/absent',
    connectionTimeoutMillis: 100,
  })
  try {
    const isolated = createApp(unavailable)
    const responses = [
      await login(`prof.${run}`, password, isolated),
      await request(isolated)
        .get('/api/professional/profile')
        .set('Cookie', cookie(existing, 'cof_access')),
    ]
    for (const response of responses) {
      assert.equal(response.status, 503)
      assert.equal(JSON.stringify(response.body).includes('127.0.0.1'), false)
      assert.equal(response.body.account, undefined)
    }
  } finally {
    await unavailable.end()
  }
})

test('access signing failure rolls back registration and session rotation', async () => {
  const { insertSession, rotateSession, findLoginAccount } =
    await import('../src/features/auth/repositories/session.js')
  const { randomToken, tokenHash, signAccess } =
    await import('../src/features/auth/services/tokens.js')
  const account = await findLoginAccount(pool, `prof.${run}`)
  assert.ok(account)
  const count = async () =>
    (
      await pool.query(
        'SELECT count(*) FROM private.sessions WHERE user_id=$1',
        [account.id],
      )
    ).rows[0].count
  const initial = await count()
  const failure = new Error('firma de prueba no disponible')
  const failSigning = async () => {
    throw failure
  }
  const refresh = randomToken()
  await assert.rejects(
    insertSession(
      pool,
      account.id,
      account.passwordHash,
      tokenHash(refresh),
      failSigning,
    ),
    (error) => error === failure,
  )
  assert.equal(await count(), initial)

  const session = await insertSession(
    pool,
    account.id,
    account.passwordHash,
    tokenHash(refresh),
    signAccess,
  )
  await assert.rejects(
    rotateSession(
      pool,
      tokenHash(refresh),
      tokenHash(randomToken()),
      failSigning,
    ),
    (error) => error === failure,
  )
  const { rows: tokens } = await pool.query(
    'SELECT used_at FROM private.refresh_tokens WHERE session_id=$1',
    [decodeJwt(session.access).sid],
  )
  assert.equal(tokens.length, 1)
  assert.equal(tokens[0].used_at, null)
  assert.ok(
    await rotateSession(
      pool,
      tokenHash(refresh),
      tokenHash(randomToken()),
      signAccess,
    ),
  )
})

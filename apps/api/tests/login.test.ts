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
    ['prof', 'profesional', 'activo'],
    ['otro', 'profesional', 'activo'],
    ['baja', 'profesional', 'inactivo'],
    ['cliente', 'cliente', 'activo'],
    ['admin', 'administrador', 'activo'],
  ]) {
    const {
      rows: [row],
    } = await pool.query(
      'INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol,estado) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [
        `${name}.${run}`,
        `${name}.${run}@example.com`,
        passwordHash,
        role,
        status,
      ],
    )
    if (role === 'profesional')
      await pool.query(
        'INSERT INTO privado.profesionales (usuario_id,nombre_completo) VALUES ($1,$2)',
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
  contrasena = password,
  target = app,
) {
  const csrf = await request(target).get('/api/auth/csrf')
  return request(target)
    .post('/api/auth/login')
    .set('Origin', origin)
    .set('Cookie', cookie(csrf, 'cof_csrf'))
    .set('X-CSRF-Token', csrf.body.csrfToken ?? '')
    .send({ identificador: identifier, contrasena })
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

test('login por usuario/correo normalizados crea sesión y consulta solo su perfil', async () => {
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
      .get(`/api/professional/profile?accountId=${otherId}`)
      .set('Cookie', access)
    assert.equal(profile.status, 200)
    assert.equal(profile.body.profile.accountId, professionalId)
    const {
      rows: [session],
    } = await pool.query('SELECT * FROM privado.sesiones WHERE id=$1', [
      claims.sid,
    ])
    assert.equal(session.usuario_id, professionalId)
    assert.equal(
      new Date(session.expira_en).getTime() -
        new Date(session.creado_en).getTime(),
      30 * 86400000,
    )
    const {
      rows: [stored],
    } = await pool.query(
      'SELECT hash_token FROM privado.tokens_renovacion WHERE sesion_id=$1',
      [claims.sid],
    )
    assert.match(stored.hash_token, /^[a-f0-9]{64}$/)
    assert.notEqual(
      stored.hash_token,
      cookie(response, 'cof_refresh').slice('cof_refresh='.length),
    )
  }
})

test('contraseña incorrecta, cuenta inexistente/inactiva y cliente responden igual', async () => {
  const responses = [
    await login(`prof.${run}`, 'incorrecta de prueba'),
    await login(`ausente.${run}`),
    await login(`baja.${run}`),
    await login(`cliente.${run}`),
  ]
  for (const response of responses) {
    assert.equal(response.status, 401)
    assert.deepEqual(response.body, responses[0].body)
    assert.equal(cookie(response, 'cof_access'), '')
  }
})

test('API privada sin sesión o con token manipulado/expirado devuelve 401', async () => {
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

test('baja se comprueba en cada consulta y la sesión no revive al reactivar la cuenta', async () => {
  const response = await login(`otro.${run}`)
  try {
    await pool.query(
      "UPDATE privado.usuarios SET estado='inactivo' WHERE id=$1",
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
      "UPDATE privado.usuarios SET estado='activo' WHERE id=$1",
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

test('caducidad absoluta de BD impide acceso y renovación, incluso con access válido', async () => {
  const response = await login()
  const claims = decodeJwt(
    cookie(response, 'cof_access').slice('cof_access='.length),
  )
  await pool.query(
    "UPDATE privado.sesiones SET creado_en=now()-interval '31 days',expira_en=now()-interval '1 day' WHERE id=$1",
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

test('dos refresh simultáneos del mismo token no producen dos renovaciones válidas', async () => {
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

test('fallo al crear refresh revierte sesión y no emite cookies ni detalles internos', async () => {
  const {
    rows: [initial],
  } = await pool.query('SELECT count(*) FROM privado.sesiones')
  await pool.query(
    "CREATE FUNCTION privado.fallar_insercion_sesion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'detalle de infraestructura privado'; END $$",
  )
  await pool.query(
    'CREATE TRIGGER fallar_insercion_sesion BEFORE INSERT ON privado.tokens_renovacion FOR EACH ROW EXECUTE FUNCTION privado.fallar_insercion_sesion()',
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
    } = await pool.query('SELECT count(*) FROM privado.sesiones')
    assert.equal(final.count, initial.count)
  } finally {
    await pool.query(
      'DROP TRIGGER fallar_insercion_sesion ON privado.tokens_renovacion',
    )
    await pool.query('DROP FUNCTION privado.fallar_insercion_sesion()')
  }
})

test('renueva, conserva límite absoluto y replay revoca también el access vigente', async () => {
  const first = await login()
  const claims = decodeJwt(
    cookie(first, 'cof_access').slice('cof_access='.length),
  )
  const next = await mutation('/api/auth/refresh', first)
  assert.equal(next.status, 200)
  assert.notEqual(cookie(next, 'cof_refresh'), cookie(first, 'cof_refresh'))
  const {
    rows: [session],
  } = await pool.query('SELECT * FROM privado.sesiones WHERE id=$1', [
    claims.sid,
  ])
  assert.equal(
    new Date(session.expira_en).getTime() -
      new Date(session.creado_en).getTime(),
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

test('logout revoca sesión: no permite reutilizar access ni refresh', async () => {
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

test('Origin y CSRF son obligatorios para login/refresh/logout; payload no concede rol', async () => {
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
    .send({ identificador: `prof.${run}`, contrasena: password, role: 'admin' })
  assert.equal(response.status, 400)
})

test('limita intentos de acceso antes del hash', async () => {
  const isolated = createApp(pool)
  for (let i = 0; i < 20; i++) await login('ausente', password, isolated)
  const response = await login('ausente', password, isolated)
  assert.equal(response.status, 429)
  assert.ok(response.headers['retry-after'])
})

test('conexión runtime sin DDL: login y consulta funcionan, no puede crear admin', async () => {
  const restricted = new Pool({
    connectionString: databaseUrl,
    options: '-c role=couchone_autenticacion',
  })
  try {
    const response = await login(`prof.${run}`, password, createApp(restricted))
    assert.equal(response.status, 200)
    const profile = await request(createApp(restricted))
      .get('/api/professional/profile')
      .set('Cookie', cookie(response, 'cof_access'))
    assert.equal(profile.status, 200)
    assert.equal(profile.body.profile.accountId, professionalId)
    await assert.rejects(
      restricted.query(
        "UPDATE privado.usuarios SET rol='administrador' WHERE id=$1",
        [professionalId],
      ),
      /permission denied/,
    )
  } finally {
    await restricted.end()
  }
})

test('cookies de sesión en producción llevan Secure y no exponen tokens al cliente', async () => {
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

test('login y perfil fallan de forma segura si BD está caída', async () => {
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

test('fallo al firmar acceso revierte alta y rotación de sesión', async () => {
  const { insertSession, rotateSession, findLoginAccount } =
    await import('../src/features/auth/repositories/session.js')
  const { randomToken, tokenHash, signAccess } =
    await import('../src/features/auth/services/tokens.js')
  const account = await findLoginAccount(pool, `prof.${run}`)
  assert.ok(account)
  const count = async () =>
    (
      await pool.query(
        'SELECT count(*) FROM privado.sesiones WHERE usuario_id=$1',
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
    'SELECT usado_en FROM privado.tokens_renovacion WHERE sesion_id=$1',
    [decodeJwt(session.access).sid],
  )
  assert.equal(tokens.length, 1)
  assert.equal(tokens[0].usado_en, null)
  assert.ok(
    await rotateSession(
      pool,
      tokenHash(refresh),
      tokenHash(randomToken()),
      signAccess,
    ),
  )
})

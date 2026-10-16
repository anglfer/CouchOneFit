import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { after, before, test } from 'node:test'
import { hash, verify, argon2id } from 'argon2'
import { Pool } from 'pg'
import request from 'supertest'
import { SignJWT, decodeJwt } from 'jose'

process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const value = process.env.TEST_DATABASE_URL
if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname))
  throw new Error('Se requiere base local exclusiva de pruebas')
const pool = new Pool({ connectionString: value })
const run = randomBytes(6).toString('hex')
const password = randomBytes(24).toString('base64url')
const ids = new Map<string, string>()
const origin = 'http://localhost:5000'
const cookie = (r: request.Response, name: string) =>
  ((r.headers['set-cookie'] as unknown as string[]) ?? []).find(v => v.startsWith(`${name}=`))?.split(';')[0] ?? ''

before(async () => {
  const digest = await hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
  for (const role of ['administrador', 'profesional', 'cliente']) {
    const { rows: [row] } = await pool.query(
      "INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ($1,$2,$3,$4) RETURNING id",
      [`${role}.${run}`, `${role}.${run}@example.com`, digest, role],
    )
    ids.set(role, row.id)
    if (role === 'profesional') await pool.query(
      'INSERT INTO privado.profesionales (usuario_id,nombre_completo) VALUES ($1,$2)', [row.id, 'Profesional de prueba'],
    )
  }
})
after(() => pool.end())

async function post(app: ReturnType<typeof createApp>, path: string, body: object, session?: request.Response) {
  const csrf = await request(app).get('/api/auth/csrf')
  return request(app).post(path).set('Origin', origin)
    .set('Cookie', [cookie(csrf, 'cof_csrf'), session && cookie(session, 'cof_access'), session && cookie(session, 'cof_refresh')].filter(Boolean).join('; '))
    .set('X-CSRF-Token', csrf.body.csrfToken).send(body)
}
const login = (app: ReturnType<typeof createApp>, role: string) => post(app, '/api/auth/login', { identificador: `${role}.${run}`, contrasena: password })

test('matriz HTTP: admin solo administración, profesional solo operación y cliente sin acceso Web', async () => {
  const restricted = new Pool({ connectionString: value, options: '-c role=couchone_autenticacion' })
  try {
    const app = createApp(restricted)
    for (const role of ['administrador', 'profesional', 'cliente']) {
      const session = await login(app, role)
      if (role === 'cliente') {
        assert.equal(session.status, 401)
        const { rows: [stored] } = await pool.query('INSERT INTO privado.sesiones (usuario_id) VALUES ($1) RETURNING id', [ids.get(role)])
        const token = await signAccess(ids.get(role)!, stored.id)
        for (const path of ['/api/admin/session', '/api/professional/profile'])
          assert.equal((await request(app).get(path).set('Cookie', `cof_access=${token}`)).status, 401)
        continue
      }
      assert.equal(session.status, 200)
      assert.equal(session.body.account.role, role === 'administrador' ? 'admin' : 'professional')
      const access = cookie(session, 'cof_access')
      const expected = role === 'administrador' ? [200, 403] : [403, 200]
      for (const [i, path] of ['/api/admin/session', '/api/professional/profile'].entries()) {
        const response = await request(app).get(`${path}?accountId=${ids.get('profesional')}&role=admin`).set('Cookie', access)
        assert.equal(response.status, expected[i])
        assert.equal(response.headers['cache-control'], 'no-store')
        if (response.status === 403) assert.equal(response.body.profile, undefined)
      }
      const current = await request(app).get('/api/auth/session').set('Cookie', access)
      assert.equal(current.body.account.id, ids.get(role))
    }
    for (const path of ['/api/admin/session', '/api/admin/professionals', '/api/professional/profile'])
      assert.equal((await request(app).get(path)).status, 401)
  } finally { await restricted.end() }
})

test('rol enviado en payload o JWT no concede permisos administrativos', async () => {
  const app = createApp(pool)
  for (const field of ['role', 'rol']) {
    assert.equal((await post(app, '/api/auth/login', {
      identificador: `profesional.${run}`, contrasena: password, [field]: 'administrador',
    })).status, 400)
    assert.equal((await request(app).post('/api/auth/professionals').send({ [field]: 'administrador' })).status, 400)
  }
  const session = await login(app, 'profesional')
  const claims = decodeJwt(cookie(session, 'cof_access').slice('cof_access='.length))
  const token = await new SignJWT({ ...claims, role: 'admin', rol: 'administrador' })
    .setProtectedHeader({ alg: 'HS256' }).sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET))
  assert.equal((await request(app).get('/api/admin/session').set('Cookie', `cof_access=${token}`)).status, 403)
})

test('admin renueva, rechaza replay y logout/baja invalidan sus sesiones', async () => {
  const app = createApp(pool)
  const first = await login(app, 'administrador')
  const renewed = await post(app, '/api/auth/refresh', {}, first)
  assert.equal(renewed.status, 200)
  assert.equal(renewed.body.account.role, 'admin')
  assert.equal((await post(app, '/api/auth/refresh', {}, first)).status, 401)
  assert.equal((await request(app).get('/api/admin/session').set('Cookie', cookie(renewed, 'cof_access'))).status, 401)
  const second = await login(app, 'administrador')
  assert.equal((await post(app, '/api/auth/logout', {}, second)).status, 204)
  assert.equal((await request(app).get('/api/admin/session').set('Cookie', cookie(second, 'cof_access'))).status, 401)
  const third = await login(app, 'administrador')
  try {
    await pool.query("UPDATE privado.usuarios SET estado='inactivo' WHERE id=$1", [ids.get('administrador')])
    assert.equal((await login(app, 'administrador')).status, 401)
    assert.equal((await request(app).get('/api/admin/session').set('Cookie', cookie(third, 'cof_access'))).status, 401)
  } finally { await pool.query("UPDATE privado.usuarios SET estado='activo' WHERE id=$1", [ids.get('administrador')]) }
  assert.equal((await request(app).get('/api/admin/session').set('Cookie', cookie(third, 'cof_access'))).status, 401)
  assert.equal((await post(app, '/api/auth/refresh', {}, third)).status, 401)
})

test('seed manual muestra contraseña una vez, rechaza repetición y no eleva cuentas; runtime no puede provisionar', async () => {
  const username = `seed.${run}`
  const email = `seed.${run}@example.com`
  const seed = (user = username, mail = email, changes = {}) => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-admin.ts'], {
    env: { ...process.env, DATABASE_URL: value, ...changes }, input: `${user}\n${mail}\n`, encoding: 'utf8', stdio: 'pipe',
  })
  const output = seed()
  assert.match(output, /Administrador creado/)
  const generated = output.match(/Contraseña: ([\w-]{43})/)
  assert.ok(generated)
  const { rows: [before] } = await pool.query('SELECT * FROM privado.usuarios WHERE usuario=$1', [username])
  assert.equal(before.rol, 'administrador')
  assert.ok(await verify(before.hash_contrasena, generated[1]))
  assert.throws(() => seed())
  const { rows: [after] } = await pool.query('SELECT * FROM privado.usuarios WHERE id=$1', [before.id])
  assert.deepEqual(after, before)
  assert.equal((await pool.query('SELECT count(*) FROM privado.profesionales WHERE usuario_id=$1', [before.id])).rows[0].count, '0')
  assert.throws(() => seed(`profesional.${run}`, `profesional.${run}@example.com`))
  assert.throws(() => seed('', ''))
  const provision = new Pool({ connectionString: value, options: '-c role=couchone_provision' })
  try {
    await assert.rejects(provision.query('SELECT hash_contrasena FROM privado.usuarios'), /permission denied/)
    await assert.rejects(provision.query("INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ('ilegal','ilegal@example.com','$argon2id$fake','profesional')"), /row-level security/)
  } finally { await provision.end() }
  const runtime = `hu003_runtime_${run}`
  await pool.query(`CREATE ROLE ${runtime} LOGIN`)
  try {
    await pool.query(`GRANT couchone_autenticacion TO ${runtime}`)
    const url = new URL(value!)
    url.username = runtime
    url.password = ''
    assert.throws(() => seed(undefined, undefined, { DATABASE_URL: url.toString() }), /No se pudo provisionar/)
    const ordinary = new Pool({ connectionString: url.toString() })
    try {
      assert.equal((await ordinary.query("SELECT pg_has_role(current_user,'couchone_provision','MEMBER') AS allowed")).rows[0].allowed, false)
      await assert.rejects(ordinary.query("INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ('ilegal','ilegal@example.com','$argon2id$fake','administrador')"), /row-level security/)
      await assert.rejects(ordinary.query('UPDATE privado.usuarios SET rol=\'administrador\''), /permission denied/)
    } finally { await ordinary.end() }
  } finally { await pool.query(`DROP ROLE ${runtime}`) }
})

import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { Pool } from 'pg'
import { verify } from 'argon2'
import { createApp } from '../src/app.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl)
  throw new Error(
    'TEST_DATABASE_URL debe apuntar a una BD local exclusiva de pruebas',
  )
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    'Las pruebas de registro solo se ejecutan contra PostgreSQL local',
  )
}
const pool = new Pool({ connectionString: databaseUrl })
const app = createApp(pool)
const valid = {
  nombreCompleto: 'Persona de Prueba',
  usuario: 'persona.test',
  correo: 'persona@example.com',
  confirmacionCorreo: 'persona@example.com',
  contrasena: ' contraseña 🔐 de prueba ',
  confirmacionContrasena: ' contraseña 🔐 de prueba ',
  telefono: '5512345678',
  planInteres: 'pro',
  avisoVersion: '2026-10-15.1',
  aceptaAviso: true,
}
let sequence = 0
const runId = Date.now().toString(36)
const payload = () => {
  sequence++
  return {
    ...valid,
    usuario: `p.${runId}.${sequence}`,
    correo: `p.${runId}.${sequence}@example.com`,
    confirmacionCorreo: `p.${runId}.${sequence}@example.com`,
  }
}

before(async () => {
  await pool.query('SELECT 1')
})
after(async () => {
  await pool.end()
})

test('alta normaliza identificadores, conserva contraseña y no concede plan ni sesión', async () => {
  const body = {
    ...payload(),
    usuario: `  Mi.${runId}  `,
    correo: ` Demo.${runId}@EXAMPLE.com `,
    confirmacionCorreo: `demo.${runId}@example.com`,
  }
  const response = await request(app).post('/api/auth/professionals').send(body)
  assert.equal(response.status, 201)
  assert.equal(response.body.account.role, 'professional')
  assert.equal(response.body.account.subscription, null)
  assert.equal(response.headers['set-cookie'], undefined)
  const {
    rows: [row],
  } = await pool.query('SELECT * FROM privado.usuarios WHERE id=$1', [
    response.body.account.id,
  ])
  assert.equal(row.usuario, `mi.${runId}`)
  assert.equal(row.correo, `demo.${runId}@example.com`)
  assert.ok(await verify(row.hash_contrasena, body.contrasena))
  assert.match(row.hash_contrasena, /^\$argon2id\$v=19\$/)
  assert.deepEqual(row.hash_contrasena.split('$')[3].split(',').sort(), [
    'm=19456',
    'p=1',
    't=2',
  ])
  assert.equal(
    JSON.stringify(response.body).includes(row.hash_contrasena),
    false,
  )
  const {
    rows: [profile],
  } = await pool.query(
    'SELECT * FROM privado.profesionales WHERE usuario_id=$1',
    [row.id],
  )
  assert.equal(profile.plan_interes, 'pro')
  const {
    rows: [notice],
  } = await pool.query(
    'SELECT * FROM privado.aceptaciones_avisos WHERE usuario_id=$1',
    [row.id],
  )
  assert.equal(notice.version, '2026-10-15.1')
})

test('dos duplicados concurrentes por usuario o correo solo permiten un alta', async () => {
  for (const identifier of ['usuario', 'correo'] as const) {
    const a = payload()
    const b = payload()
    b[identifier] = ` ${a[identifier].toUpperCase()} `
    if (identifier === 'correo') b.confirmacionCorreo = b.correo
    const responses = await Promise.all(
      [a, b].map((body) =>
        request(app).post('/api/auth/professionals').send(body),
      ),
    )
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409])
  }
})

test('rechaza payloads inválidos y privilegios sin crear cuenta', async () => {
  const invalid = [
    { role: 'admin' },
    { nombre_completo: 'Campo del contrato anterior' },
    { rol: 'admin' },
    { usuario: 'a@b' },
    { correo: 'incorrecto' },
    { confirmacionCorreo: 'otro@example.com' },
    { contrasena: 'a'.repeat(14) },
    { contrasena: '🔐'.repeat(129) },
    { confirmacionContrasena: 'distinta' },
    { nombreCompleto: 'ab' },
    { telefono: 5512345678 },
    { telefono: 'abc1234567' },
    { aceptaAviso: false },
    { avisoVersion: '2026-10-15' },
    { planInteres: 'admin' },
  ]
  const {
    rows: [before],
  } = await pool.query('SELECT count(*) FROM privado.usuarios')
  for (const change of invalid) {
    const response = await request(app)
      .post('/api/auth/professionals')
      .send({ ...payload(), ...change })
    assert.equal(response.status, 400, JSON.stringify(change))
  }
  const {
    rows: [after],
  } = await pool.query('SELECT count(*) FROM privado.usuarios')
  assert.equal(after.count, before.count)
})

test('límites Unicode 15/128 y teléfono opcional', async () => {
  for (const length of [15, 128]) {
    const password = '🔐'.repeat(length)
    const response = await request(app)
      .post('/api/auth/professionals')
      .send({
        ...payload(),
        telefono: '',
        contrasena: password,
        confirmacionContrasena: password,
      })
    assert.equal(response.status, 201)
  }
})

test('fallo de perfil o aceptación revierte la cuenta y responde sin detalles internos', async () => {
  for (const table of ['profesionales', 'aceptaciones_avisos']) {
    await pool.query(
      `CREATE FUNCTION privado.fallar_insercion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'detalle interno sensible'; END $$`,
    )
    await pool.query(
      `CREATE TRIGGER fallar_insercion BEFORE INSERT ON privado.${table} FOR EACH ROW EXECUTE FUNCTION privado.fallar_insercion()`,
    )
    const body = payload()
    try {
      const response = await request(app)
        .post('/api/auth/professionals')
        .send(body)
      assert.equal(response.status, 503)
      assert.equal(
        JSON.stringify(response.body).includes('detalle interno'),
        false,
      )
      const { rows } = await pool.query(
        'SELECT id FROM privado.usuarios WHERE usuario=$1',
        [body.usuario],
      )
      assert.equal(rows.length, 0)
    } finally {
      await pool.query(`DROP TRIGGER fallar_insercion ON privado.${table}`)
      await pool.query('DROP FUNCTION privado.fallar_insercion()')
    }
  }
})

test('JSON malformado, origen ajeno y campos desconocidos responden errores seguros', async () => {
  assert.equal(
    (await request(app).post('/api/auth/professionals').type('json').send('{'))
      .status,
    400,
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/professionals')
        .set('Origin', 'https://ajeno.example')
        .send(payload())
    ).status,
    403,
  )
  assert.equal(
    (
      await request(app)
        .post('/api/auth/professionals')
        .send({ ...payload(), subscription: 'active' })
    ).status,
    400,
  )
})

test('limita abuso antes de calcular hashes y no confía en X-Forwarded-For', async () => {
  const isolated = createApp(pool)
  for (let i = 0; i < 40; i++) {
    await request(isolated).post('/api/auth/professionals').send({})
  }
  const response = await request(isolated)
    .post('/api/auth/professionals')
    .set('X-Forwarded-For', '203.0.113.99')
    .send({})
  assert.equal(response.status, 429)
  assert.ok(response.headers['retry-after'])
})

test('la conexión con permisos de registro funciona y RLS bloquea un insert admin', async () => {
  const restricted = new Pool({
    connectionString: databaseUrl,
    options: '-c role=couchone_registro',
  })
  try {
    const response = await request(createApp(restricted))
      .post('/api/auth/professionals')
      .send(payload())
    assert.equal(response.status, 201)
    await assert.rejects(
      restricted.query(
        "INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ($1,$2,'$argon2id$fake','administrador')",
        [`admin.${runId}`, `admin.${runId}@example.com`],
      ),
      /row-level security/,
    )
    await assert.rejects(
      restricted.query('DELETE FROM privado.usuarios'),
      /permission denied/,
    )
  } finally {
    await restricted.end()
  }
})

test('BD no disponible devuelve 503 sin filtrar servidor ni credenciales', async () => {
  const unavailable = new Pool({
    connectionString: 'postgresql://postgres@127.0.0.1:1/absent',
    connectionTimeoutMillis: 100,
  })
  try {
    const response = await request(createApp(unavailable))
      .post('/api/auth/professionals')
      .send(payload())
    assert.equal(response.status, 503)
    assert.equal(response.body.error.code, 'REGISTRATION_UNAVAILABLE')
    assert.equal(JSON.stringify(response.body).includes('127.0.0.1'), false)
  } finally {
    await unavailable.end()
  }
})

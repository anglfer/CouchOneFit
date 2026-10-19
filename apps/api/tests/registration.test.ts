import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { Pool } from 'pg'
import { verify } from 'argon2'
import { createApp } from '../src/app.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl)
    throw new Error('TEST_DATABASE_URL must point to a dedicated local test database')
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    'Registration tests only run against local PostgreSQL',
  )
}
const pool = new Pool({ connectionString: databaseUrl })
const app = createApp(pool)
const valid = {
  fullName: 'Persona de Prueba',
  username: 'persona.test',
  email: 'persona@example.com',
  emailConfirmation: 'persona@example.com',
  password: ' contraseña 🔐 de prueba ',
  passwordConfirmation: ' contraseña 🔐 de prueba ',
  phone: '5512345678',
  planInterest: 'pro',
  noticeVersion: '2026-10-15.1',
  acceptsNotice: true,
}
let sequence = 0
const runId = Date.now().toString(36)
const payload = () => {
  sequence++
  return {
    ...valid,
    username: `p.${runId}.${sequence}`,
    email: `p.${runId}.${sequence}@example.com`,
    emailConfirmation: `p.${runId}.${sequence}@example.com`,
  }
}

before(async () => {
  await pool.query('SELECT 1')
})
after(async () => {
  await pool.end()
})

test('registration normalizes identifiers without granting a subscription or session', async () => {
  const body = {
    ...payload(),
    username: `  Mi.${runId}  `,
    email: ` Demo.${runId}@EXAMPLE.com `,
    emailConfirmation: `demo.${runId}@example.com`,
  }
  const response = await request(app).post('/api/auth/professionals').send(body)
  assert.equal(response.status, 201)
  assert.equal(response.body.account.role, 'professional')
  assert.equal(response.body.account.subscription, null)
  assert.equal(response.headers['set-cookie'], undefined)
  const {
    rows: [row],
  } = await pool.query('SELECT * FROM private.users WHERE id=$1', [
    response.body.account.id,
  ])
  assert.equal(row.username, `mi.${runId}`)
  assert.equal(row.email, `demo.${runId}@example.com`)
  assert.ok(await verify(row.password_hash, body.password))
  assert.match(row.password_hash, /^\$argon2id\$v=19\$/)
  assert.deepEqual(row.password_hash.split('$')[3].split(',').sort(), [
    'm=19456',
    'p=1',
    't=2',
  ])
  assert.equal(
    JSON.stringify(response.body).includes(row.password_hash),
    false,
  )
  const {
    rows: [profile],
  } = await pool.query(
    'SELECT * FROM private.professionals WHERE user_id=$1',
    [row.id],
  )
  assert.equal(profile.plan_interest, 'pro')
  const {
    rows: [notice],
  } = await pool.query(
    'SELECT * FROM private.notice_acceptances WHERE user_id=$1',
    [row.id],
  )
  assert.equal(notice.version, '2026-10-15.1')
})

test('concurrent duplicate usernames or emails allow only one registration', async () => {
  for (const identifier of ['username', 'email'] as const) {
    const a = payload()
    const b = payload()
    b[identifier] = ` ${a[identifier].toUpperCase()} `
    if (identifier === 'email') b.emailConfirmation = b.email
    const responses = await Promise.all(
      [a, b].map((body) =>
        request(app).post('/api/auth/professionals').send(body),
      ),
    )
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409])
  }
})

test('invalid payloads and privilege fields are rejected without creating an account', async () => {
  const invalid = [
    { role: 'admin' },
    { nombreCompleto: 'Old JSON contract field' },
    { username: 'a@b' },
    { email: 'incorrecto' },
    { emailConfirmation: 'otro@example.com' },
    { password: 'a'.repeat(14) },
    { password: '🔐'.repeat(129) },
    { passwordConfirmation: 'distinta' },
    { fullName: 'ab' },
    { phone: 5512345678 },
    { phone: 'abc1234567' },
    { acceptsNotice: false },
    { noticeVersion: '2026-10-15' },
    { planInterest: 'admin' },
  ]
  const {
    rows: [before],
  } = await pool.query('SELECT count(*) FROM private.users')
  for (const change of invalid) {
    const response = await request(app)
      .post('/api/auth/professionals')
      .send({ ...payload(), ...change })
    assert.equal(response.status, 400, JSON.stringify(change))
  }
  const {
    rows: [after],
  } = await pool.query('SELECT count(*) FROM private.users')
  assert.equal(after.count, before.count)
})

test('password Unicode boundaries and optional phone are accepted', async () => {
  for (const length of [15, 128]) {
    const password = '🔐'.repeat(length)
    const response = await request(app)
      .post('/api/auth/professionals')
      .send({
        ...payload(),
        phone: '',
        password: password,
        passwordConfirmation: password,
      })
    assert.equal(response.status, 201)
  }
})

test('profile or notice failures roll back the account without exposing internal details', async () => {
  for (const table of ['professionals', 'notice_acceptances']) {
    await pool.query(
      `CREATE FUNCTION private.fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'detalle interno sensible'; END $$`,
    )
    await pool.query(
      `CREATE TRIGGER fail_insert BEFORE INSERT ON private.${table} FOR EACH ROW EXECUTE FUNCTION private.fail_insert()`,
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
        'SELECT id FROM private.users WHERE username=$1',
        [body.username],
      )
      assert.equal(rows.length, 0)
    } finally {
      await pool.query(`DROP TRIGGER fail_insert ON private.${table}`)
      await pool.query('DROP FUNCTION private.fail_insert()')
    }
  }
})

test('malformed JSON, foreign origins, and unknown fields return safe errors', async () => {
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

test('rate limits run before hashing and do not trust X-Forwarded-For', async () => {
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

test('registration role works while row-level security blocks admin inserts', async () => {
  const restricted = new Pool({
    connectionString: databaseUrl,
    options: '-c role=couchone_registration',
  })
  try {
    const response = await request(createApp(restricted))
      .post('/api/auth/professionals')
      .send(payload())
    assert.equal(response.status, 201)
    await assert.rejects(
      restricted.query(
        "INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,'$argon2id$fake','admin')",
        [`admin.${runId}`, `admin.${runId}@example.com`],
      ),
      /row-level security/,
    )
    await assert.rejects(
      restricted.query('DELETE FROM private.users'),
      /permission denied/,
    )
  } finally {
    await restricted.end()
  }
})

test('database failures return 503 without exposing server or credential details', async () => {
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

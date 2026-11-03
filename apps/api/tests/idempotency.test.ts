import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
process.env.AUTH_JWT_SECRET = 'idempotency-local-only-secret-at-least-32-bytes'
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
  dbName = `cof_idem_${randomBytes(5).toString('hex')}`
let db: Pool, runtime: Pool, app: ReturnType<typeof createApp>
let seq = 0
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
    max: 12,
  })
  app = createApp(runtime)
})
after(async () => {
  await runtime?.end()
  await db?.end()
  await owner.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  await owner.end()
})

async function professional() {
  const name = `idem.${++seq}`
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
    "INSERT INTO private.professionals (user_id,full_name) VALUES ($1,'Profesional idempotencia') RETURNING id",
    [u.id]
  )
  await db.query(
    "INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE max_clients=10",
    [p.id]
  )
  return { id: u.id, professionalId: p.id, token: await signAccess(u.id, s.id) }
}
async function send(
  method: 'post' | 'patch',
  path: string,
  body: unknown,
  who: { token: string },
  key?: string
) {
  const csrf = await request(app).get('/api/auth/csrf')
  let call = request(app)
    [method](path)
    .set('Origin', 'http://localhost:5000')
    .set('Cookie', [
      `cof_access=${who.token}`,
      ...(csrf.headers['set-cookie'] as string[]).map((c) => c.split(';')[0]),
    ])
    .set('X-CSRF-Token', csrf.body.csrfToken)
  if (key) call = call.set('Idempotency-Key', key)
  return call.send(body)
}
const input = (name = 'Cliente sin conexión') => ({
  fullName: name,
  goal: 'Constancia',
  birthDate: '1990-05-20',
  heightCm: 170.5,
  baseWeightKg: 70.2,
  baseBodyFatPercentage: null,
  waistCm: null,
  hipCm: null,
})
const count = async (who: { professionalId: string }) =>
  Number(
    (await db.query('SELECT count(*) FROM private.clients WHERE professional_id=$1', [
      who.professionalId,
    ])).rows[0].count
  )

test('DEC-018: repetir la creación con la misma clave devuelve lo mismo y no duplica', async () => {
  const pro = await professional()
  const key = randomUUID()
  const first = await send('post', '/api/clients', input(), pro, key)
  assert.equal(first.status, 201)
  const second = await send('post', '/api/clients', input(), pro, key)
  assert.equal(second.status, 201)
  assert.equal(second.headers['idempotent-replayed'], 'true')
  assert.deepEqual(second.body, first.body)
  assert.equal(await count(pro), 1)
  const stored = (await db.query('SELECT status_code,completed_at FROM private.idempotency_keys WHERE owner_id=$1', [pro.id])).rows
  assert.equal(stored.length, 1)
  assert.equal(stored[0].status_code, 201)
})

test('sin encabezado se comporta como siempre (dos creaciones, dos expedientes)', async () => {
  const pro = await professional()
  assert.equal((await send('post', '/api/clients', input('Uno'), pro)).status, 201)
  assert.equal((await send('post', '/api/clients', input('Uno'), pro)).status, 201)
  assert.equal(await count(pro), 2)
  assert.equal(
    Number((await db.query('SELECT count(*) FROM private.idempotency_keys WHERE owner_id=$1', [pro.id])).rows[0].count),
    0
  )
})

test('la misma clave con otro cuerpo se rechaza y no escribe', async () => {
  const pro = await professional()
  const key = randomUUID()
  assert.equal((await send('post', '/api/clients', input('Ana Ruiz'), pro, key)).status, 201)
  const reused = await send('post', '/api/clients', input('Beto Ruiz'), pro, key)
  assert.equal(reused.status, 422)
  assert.equal(reused.body.error.code, 'IDEMPOTENCY_KEY_REUSED')
  assert.equal(await count(pro), 1)
})

test('clave inválida: 400 sin tocar nada', async () => {
  const pro = await professional()
  const bad = await send('post', '/api/clients', input(), pro, 'no-es-uuid')
  assert.equal(bad.status, 400)
  assert.equal(bad.body.error.code, 'INVALID_INPUT')
  assert.equal(await count(pro), 0)
})

test('un fallo no consume la clave: el reintento se evalúa de nuevo', async () => {
  const pro = await professional()
  const key = randomUUID()
  const invalid = await send('post', '/api/clients', { ...input(), heightCm: 5 }, pro, key)
  assert.equal(invalid.status, 400)
  assert.equal(
    Number((await db.query('SELECT count(*) FROM private.idempotency_keys WHERE owner_id=$1', [pro.id])).rows[0].count),
    0
  )
  const fixed = await send('post', '/api/clients', { ...input(), heightCm: 170 }, pro, key)
  assert.equal(fixed.status, 201)
})

test('dos profesionales con la misma clave no se mezclan', async () => {
  const a = await professional()
  const b = await professional()
  const key = randomUUID()
  const first = await send('post', '/api/clients', input('De A'), a, key)
  const second = await send('post', '/api/clients', input('De B'), b, key)
  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  assert.notEqual(first.body.client.id, second.body.client.id)
  assert.equal(await count(a), 1)
  assert.equal(await count(b), 1)
  const rows = (await db.query('SELECT owner_id FROM private.idempotency_keys WHERE key=$1', [key])).rows
  assert.equal(rows.length, 2)
})

test('edición y cambio de estado también son idempotentes', async () => {
  const pro = await professional()
  const created = (await send('post', '/api/clients', input('Editable'), pro)).body.client
  const edit = randomUUID()
  const patch = await send('patch', `/api/clients/${created.id}`, { version: 1, goal: 'Nuevo objetivo' }, pro, edit)
  assert.equal(patch.status, 200)
  const again = await send('patch', `/api/clients/${created.id}`, { version: 1, goal: 'Nuevo objetivo' }, pro, edit)
  assert.equal(again.status, 200)
  assert.equal(again.headers['idempotent-replayed'], 'true')
  // Sin clave, la misma versión vieja ya es conflicto: la idempotencia no lo oculta.
  const stale = await send('patch', `/api/clients/${created.id}`, { version: 1, goal: 'Otro' }, pro)
  assert.equal(stale.status, 409)
  const row = (await db.query('SELECT version FROM private.clients WHERE id=$1', [created.id])).rows[0]
  const status = randomUUID()
  const off = await send('patch', `/api/clients/${created.id}/status`, { status: 'inactive', version: row.version }, pro, status)
  assert.equal(off.status, 200)
  const offAgain = await send('patch', `/api/clients/${created.id}/status`, { status: 'inactive', version: row.version }, pro, status)
  assert.equal(offAgain.headers['idempotent-replayed'], 'true')
  assert.equal(offAgain.body.client.status, 'inactive')
})

test('un reclamo abandonado (más de 2 minutos) permite reintentar; uno reciente responde 409', async () => {
  const pro = await professional()
  const key = randomUUID()
  await db.query(
    "INSERT INTO private.idempotency_keys(owner_id,key,request_hash) VALUES($1,$2,'x')",
    [pro.id, key]
  )
  const busy = await send('post', '/api/clients', input(), pro, key)
  // El hash no coincide con el reclamo sembrado: primero se reconoce como otra solicitud.
  assert.equal(busy.status, 422)
  const live = randomUUID()
  const claimed = await send('post', '/api/clients', input('Reclamado'), pro, live)
  assert.equal(claimed.status, 201)
  await db.query(
    "UPDATE private.idempotency_keys SET status_code=NULL,response=NULL,completed_at=NULL,created_at=clock_timestamp() WHERE owner_id=$1 AND key=$2",
    [pro.id, live]
  )
  const inProgress = await send('post', '/api/clients', input('Reclamado'), pro, live)
  assert.equal(inProgress.status, 409)
  assert.equal(inProgress.body.error.code, 'IDEMPOTENCY_IN_PROGRESS')
  await db.query(
    "UPDATE private.idempotency_keys SET created_at=clock_timestamp()-interval '3 minutes' WHERE owner_id=$1 AND key=$2",
    [pro.id, live]
  )
  const retried = await send('post', '/api/clients', input('Reclamado'), pro, live)
  assert.equal(retried.status, 201)
})

test('las claves de más de 35 días se purgan al reclamar otra', async () => {
  const pro = await professional()
  const old = randomUUID()
  await db.query(
    "INSERT INTO private.idempotency_keys(owner_id,key,request_hash,status_code,response,created_at) VALUES($1,$2,'h',201,'{}',clock_timestamp()-interval '36 days')",
    [pro.id, old]
  )
  assert.equal((await send('post', '/api/clients', input(), pro, randomUUID())).status, 201)
  assert.equal(
    Number((await db.query('SELECT count(*) FROM private.idempotency_keys WHERE key=$1', [old])).rows[0].count),
    0
  )
})

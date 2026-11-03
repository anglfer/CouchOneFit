import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
// DEC-017: admin support is read-only and always logged (who, when, why).
process.env.AUTH_JWT_SECRET = 'support-local-only-secret-at-least-32-bytes'
process.env.CORS_ORIGIN = 'http://localhost:5000'
const { createApp } = await import('../src/app.js')
const { signAccess } = await import('../src/features/auth/services/tokens.js')
const { hash: passwordHash } = await import('argon2')
const url = process.env.TEST_DATABASE_URL!
if (
  !url ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
)
  throw new Error('Local database required')
const owner = new Pool({ connectionString: url }),
  dbName = `cof_support_${randomBytes(5).toString('hex')}`
let db: Pool, runtime: Pool, app: ReturnType<typeof createApp>
let seq = 0
const PASSWORD = 'Clave-de-prueba-1234'
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
})
after(async () => {
  await runtime?.end()
  await db?.end()
  await owner.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  await owner.end()
})
async function user(role: 'admin' | 'professional' | 'client') {
  const name = `sup.${++seq}`
  const hash = await passwordHash(PASSWORD)
  const {
    rows: [u],
  } = await db.query(
    'INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
    [name, `${name}@example.com`, hash, role]
  )
  const {
    rows: [s],
  } = await db.query('INSERT INTO private.sessions (user_id) VALUES ($1) RETURNING id', [u.id])
  return { id: u.id as string, token: await signAccess(u.id, s.id) }
}
async function send(
  method: 'post' | 'patch',
  path: string,
  body: unknown,
  token: string
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
const get = (path: string, token: string) =>
  request(app).get(path).set('Cookie', `cof_access=${token}`)

test('admin support lists, views with a logged reason, resets a linked client and cannot edit anything', async () => {
  const admin = await user('admin')
  const proUser = await user('professional')
  const {
    rows: [pro],
  } = await db.query(
    "INSERT INTO private.professionals (user_id,full_name) VALUES ($1,'Profesional Soporte') RETURNING id",
    [proUser.id]
  )
  const clientUser = await user('client')
  const {
    rows: [linked],
  } = await db.query(
    "INSERT INTO private.clients (professional_id,user_id,full_name,goal,birth_date,height_cm,base_weight_kg) VALUES ($1,$2,'Cliente Soporte','Definición','1995-03-01',170,70) RETURNING id",
    [pro.id, clientUser.id]
  )
  const {
    rows: [unlinked],
  } = await db.query(
    "INSERT INTO private.clients (professional_id,full_name,birth_date,height_cm,base_weight_kg) VALUES ($1,'Sin cuenta','1995-03-01',170,70) RETURNING id",
    [pro.id]
  )

  // Roles other than admin never reach the support routes.
  assert.equal((await get('/api/admin/support/clients', proUser.token)).status, 403)
  assert.ok([401, 403].includes((await get('/api/admin/support/clients', clientUser.token)).status))

  const list = await get('/api/admin/support/clients?search=soporte', admin.token)
  assert.equal(list.status, 200, JSON.stringify(list.body))
  assert.equal(list.body.total, 1)
  assert.deepEqual(Object.keys(list.body.clients[0]).sort(), [
    'accountStatus', 'clientId', 'fullName', 'professionalName', 'recordStatus', 'userId', 'username',
  ])

  // A reason is mandatory and nothing is logged without it.
  assert.equal((await send('post', `/api/admin/support/clients/${linked.id}/view`, {}, admin.token)).status, 400)
  assert.equal((await send('post', `/api/admin/support/clients/${linked.id}/view`, { reason: 'x' }, admin.token)).status, 400)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM private.support_log')).rows[0].n, 0)
  assert.equal((await send('post', `/api/admin/support/clients/${linked.id}/view`, { reason: 'Reclamo del cliente' }, proUser.token)).status, 403)

  const view = await send('post', `/api/admin/support/clients/${linked.id}/view`, { reason: 'Reclamo del cliente' }, admin.token)
  assert.equal(view.status, 200, JSON.stringify(view.body))
  assert.equal(view.body.record.fullName, 'Cliente Soporte')
  assert.equal(view.body.record.professionalName, 'Profesional Soporte')
  assert.equal(view.body.record.accountStatus, 'active')
  assert.equal('waistCm' in view.body.record, false)
  assert.equal((await send('post', `/api/admin/support/clients/00000000-0000-4000-8000-000000000000/view`, { reason: 'No existe' }, admin.token)).status, 404)

  // Reset: needs identity verification, current password and a reason; client must be linked.
  const body = { identityVerified: true, verificationMethod: 'known_relationship', currentPassword: PASSWORD }
  assert.equal((await send('post', `/api/accounts/${clientUser.id}/recovery`, body, admin.token)).status, 403)
  const reset = await send('post', `/api/accounts/${clientUser.id}/recovery`, { ...body, reason: 'Perdió el acceso' }, admin.token)
  assert.equal(reset.status, 201, JSON.stringify(reset.body))
  assert.ok(reset.body.code)

  const log = await get('/api/admin/support/log', admin.token)
  assert.equal(log.status, 200)
  assert.deepEqual(log.body.entries.map((e: { action: string; reason: string }) => [e.action, e.reason]).sort(), [
    ['reset_issued', 'Perdió el acceso'],
    ['view_record', 'Reclamo del cliente'],
  ])
  assert.equal((await get('/api/admin/support/log', proUser.token)).status, 403)

  // The administrator cannot edit records, change the account or the subscription.
  assert.equal((await send('patch', `/api/clients/${linked.id}`, { fullName: 'Otro' }, admin.token)).status, 403)
  assert.equal((await send('patch', `/api/clients/${linked.id}/account`, { status: 'inactive' }, admin.token)).status, 403)
  assert.equal((await send('post', '/api/me/subscription/downgrade', {}, admin.token)).status, 403)
  assert.equal((await db.query("SELECT status FROM private.users WHERE id=$1", [clientUser.id])).rows[0].status, 'active')
  void unlinked
})

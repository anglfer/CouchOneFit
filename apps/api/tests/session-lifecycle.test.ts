import { argon2id, hash } from 'argon2'
import type { Express } from 'express'
import { decodeJwt } from 'jose'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'

const run = randomBytes(4).toString('hex')
const password = 'ClaveCicloSesion#2026'
const origin = 'http://localhost:5173'

let owner: Pool
let pool: Pool
let app: Express
let dbName: string
let currentClock = new Date('2026-10-19T12:00:00.000Z')
let professionalUserId: string
let professionalRecordId: string
let clientUserId: string
let adminUserId: string

function cookie(response: request.Response, name: string): string {
  return (
    ((response.headers['set-cookie'] as unknown as string[]) ?? [])
      .find((value) => value.startsWith(`${name}=`))
      ?.split(';')[0] ?? ''
  )
}

async function webLogin(identifier: string, target = app) {
  const csrf = await request(target).get('/api/auth/csrf')
  return request(target)
    .post('/api/auth/login')
    .set('Origin', origin)
    .set('Cookie', cookie(csrf, 'cof_csrf'))
    .set('X-CSRF-Token', csrf.body.csrfToken ?? '')
    .send({ identifier, password })
}

async function webMutation(
  path: string,
  accessCookie: string,
  refreshCookie: string,
  target = app,
) {
  const csrf = await request(target).get('/api/auth/csrf')
  return request(target)
    .post(path)
    .set('Origin', origin)
    .set(
      'Cookie',
      [cookie(csrf, 'cof_csrf'), accessCookie, refreshCookie]
        .filter(Boolean)
        .join('; '),
    )
    .set('X-CSRF-Token', csrf.body.csrfToken ?? '')
    .send({})
}

before(async () => {
  const value = process.env.TEST_DATABASE_URL
  if (
    !value ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)
  ) {
    throw new Error('Se requiere TEST_DATABASE_URL local exclusiva de pruebas')
  }
  dbName = `CouchOneFit_session_lifecycle_${run}`
  owner = new Pool({ connectionString: value })
  await owner.query(`CREATE DATABASE "${dbName}"`)
  const target = new URL(value)
  target.pathname = `/${dbName}`
  process.env.DATABASE_URL = target.toString()
  process.env.AUTH_JWT_SECRET =
    'secreto-pruebas-couchonefit-con-longitud-segura-2026'
  process.env.CORS_ORIGIN = origin
  pool = new Pool({ connectionString: target.toString() })
  await pool.query(
    readFileSync(
      new URL(
        '../../../docs/database/schemas/identity_access.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )

  const passwordHash = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
  const insertedUsers = await pool.query<{ id: string }>(
    `INSERT INTO private.users (username, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'professional', 'active'),
            ($4, $5, $3, 'client', 'active'),
            ($6, $7, $3, 'admin', 'active')
     RETURNING id`,
    [
      `pro.hu005.${run}`,
      `pro.hu005.${run}@example.com`,
      passwordHash,
      `client.hu005.${run}`,
      `client.hu005.${run}@example.com`,
      `admin.hu005.${run}`,
      `admin.hu005.${run}@example.com`,
    ],
  )
  professionalUserId = insertedUsers.rows[0].id
  clientUserId = insertedUsers.rows[1].id
  adminUserId = insertedUsers.rows[2].id

  const insertedProf = await pool.query<{ id: string }>(
    `INSERT INTO private.professionals (user_id, full_name, phone)
     VALUES ($1, 'Profesional HU005', '5511223344')
     RETURNING id`,
    [professionalUserId],
  )
  professionalRecordId = insertedProf.rows[0].id

  await pool.query(
    `INSERT INTO private.clients (professional_id, user_id, full_name, goal, status)
     VALUES ($1, $2, 'Cliente HU005', 'Fuerza y salud', 'active')`,
    [professionalRecordId, clientUserId],
  )

  const { createApp } = await import('../src/app.js')
  app = createApp(pool, { now: () => currentClock })
})

after(async () => {
  await pool?.end()
  if (dbName) await owner?.query(`DROP DATABASE IF EXISTS "${dbName}"`)
  await owner?.end()
})

test('controlled clock enforces 15m JWT expiry, caps access exp at 30d session limit, and expires session at 30d', async () => {
  const baseTime = new Date('2026-10-19T12:00:00.000Z')
  currentClock = baseTime

  const loginRes = await webLogin(`pro.hu005.${run}`)
  assert.equal(loginRes.status, 200)
  const access1 = cookie(loginRes, 'cof_access')
  const refresh1 = cookie(loginRes, 'cof_refresh')
  const claims1 = decodeJwt(access1.slice('cof_access='.length))
  assert.equal(claims1.exp! - claims1.iat!, 15 * 60)

  // At 14m 59s, access token is still valid
  currentClock = new Date(baseTime.getTime() + (15 * 60 - 1) * 1000)
  assert.equal(
    (await request(app).get('/api/auth/session').set('Cookie', access1)).status,
    200,
  )

  // At 15m 01s, access token is expired and rejected with 401
  currentClock = new Date(baseTime.getTime() + (15 * 60 + 1) * 1000)
  assert.equal(
    (await request(app).get('/api/auth/session').set('Cookie', access1)).status,
    401,
  )

  // Rotating at 29 days 23 hours 55 minutes (5 minutes before 30-day absolute limit)
  currentClock = new Date(
    baseTime.getTime() + 30 * 86400000 - 5 * 60 * 1000,
  )
  const rotated = await webMutation('/api/auth/refresh', access1, refresh1)
  assert.equal(rotated.status, 200)
  const access2 = cookie(rotated, 'cof_access')
  const refresh2 = cookie(rotated, 'cof_refresh')
  const claims2 = decodeJwt(access2.slice('cof_access='.length))
  // Access JWT exp is capped to the remaining 5 minutes of the 30-day session
  assert.equal(claims2.exp! - claims2.iat!, 5 * 60)

  // At 30 days + 1 second from initial login, both session check and refresh are denied
  currentClock = new Date(baseTime.getTime() + 30 * 86400000 + 1000)
  assert.equal(
    (await request(app).get('/api/auth/session').set('Cookie', access2)).status,
    401,
  )
  const expiredRefresh = await webMutation(
    '/api/auth/refresh',
    access2,
    refresh2,
  )
  assert.equal(expiredRefresh.status, 401)
})

test('logout revokes sid and consumes refresh tokens even when refresh cookie is unknown or access is expired', async () => {
  currentClock = new Date('2026-10-19T15:00:00.000Z')

  // Case A: Unknown refresh token accompanied by a valid access token still revokes sid
  const loginA = await webLogin(`pro.hu005.${run}`)
  assert.equal(loginA.status, 200)
  const accessA = cookie(loginA, 'cof_access')
  const bogusRefresh = `cof_refresh=${'a'.repeat(43)}`
  const logoutA = await webMutation('/api/auth/logout', accessA, bogusRefresh)
  assert.equal(logoutA.status, 204)
  assert.equal(
    (await request(app).get('/api/professional/profile').set('Cookie', accessA))
      .status,
    401,
  )

  // Case B: Expired access token accompanied by a valid refresh token still revokes the session
  const loginB = await webLogin(`pro.hu005.${run}`)
  assert.equal(loginB.status, 200)
  const accessB = cookie(loginB, 'cof_access')
  const refreshB = cookie(loginB, 'cof_refresh')
  const sidB = decodeJwt(accessB.slice('cof_access='.length)).sid as string

  currentClock = new Date(currentClock.getTime() + 20 * 60 * 1000)
  const logoutB = await webMutation('/api/auth/logout', accessB, refreshB)
  assert.equal(logoutB.status, 204)

  const {
    rows: [sessionRow],
  } = await pool.query<{ revoked_at: Date | null }>(
    'SELECT revoked_at FROM private.sessions WHERE id = $1',
    [sidB],
  )
  assert.notEqual(sessionRow.revoked_at, null)
  assert.equal(
    (await webMutation('/api/auth/refresh', accessB, refreshB)).status,
    401,
  )
})

test('deactivating a professional revokes all their sessions without deactivating linked client accounts, and protects last admin', async () => {
  currentClock = new Date('2026-10-19T18:00:00.000Z')
  const { setAccountStatus } = await import(
    '../src/features/auth/services/session.js'
  )

  const proSession1 = await webLogin(`pro.hu005.${run}`)
  const proSession2 = await webLogin(`pro.hu005.${run}`)
  const clientLoginRes = await request(app)
    .post('/api/auth/client/login')
    .send({ identifier: `client.hu005.${run}`, password })
  assert.equal(clientLoginRes.status, 200)

  // Deactivate the professional account
  const deactivated = await setAccountStatus(
    pool,
    professionalUserId,
    'inactive',
    currentClock,
  )
  assert.equal(deactivated.status, 'inactive')
  assert.ok(deactivated.revokedSessions >= 2)

  // Both professional sessions and refresh tokens are immediately denied
  for (const session of [proSession1, proSession2]) {
    assert.equal(
      (
        await request(app)
          .get('/api/professional/profile')
          .set('Cookie', cookie(session, 'cof_access'))
      ).status,
      401,
    )
    assert.equal(
      (
        await webMutation(
          '/api/auth/refresh',
          cookie(session, 'cof_access'),
          cookie(session, 'cof_refresh'),
        )
      ).status,
      401,
    )
  }

  // Linked client account and mobile session remain active (TT-004-5)
  const clientProfileRes = await request(app)
    .get('/api/client/profile')
    .set(
      'Authorization',
      `Bearer ${clientLoginRes.body.session.accessToken as string}`,
    )
  assert.equal(clientProfileRes.status, 200)

  // Reactivating the professional does not revive revoked sessions
  await setAccountStatus(pool, professionalUserId, 'active', currentClock)
  assert.equal(
    (
      await request(app)
        .get('/api/professional/profile')
        .set('Cookie', cookie(proSession1, 'cof_access'))
    ).status,
    401,
  )

  // Last active admin cannot be deactivated (DEC-004)
  await assert.rejects(
    setAccountStatus(pool, adminUserId, 'inactive', currentClock),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'LAST_ADMIN_PROTECTED',
  )
})


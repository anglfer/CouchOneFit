import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { before, after, test } from 'node:test'
import { Pool, type PoolClient } from 'pg'
import request from 'supertest'
import { hash, argon2id } from 'argon2'
import type { Express } from 'express'

const source = process.env.TEST_DATABASE_URL
if (!source || new URL(source).hostname !== '127.0.0.1' || !new URL(source).pathname.endsWith('_test'))
  throw new Error('Exclusive local test database required')
const run = randomBytes(6).toString('hex')
const databaseName = `cof_read_${run}`
const runtimeRole = `cof_read_${run}`
const password = randomBytes(24).toString('base64url')
const owner = new Pool({ connectionString: source })
let database: Pool, runtime: Pool, app: Express
let createdDatabase = false, createdRole = false
const actors: Record<string, { id: string; session: string; professional?: string; client?: string; token?: string }> = {}

before(async () => {
  await owner.query(`CREATE DATABASE "${databaseName}"`)
  createdDatabase = true
  const target = new URL(source!)
  target.pathname = `/${databaseName}`
  database = new Pool({ connectionString: target.toString() })
  await database.query(readFileSync(new URL('../../../docs/database/schemas/identity_access.sql', import.meta.url), 'utf8'))
  const credential = randomBytes(32).toString('hex')
  await owner.query(`CREATE ROLE ${runtimeRole} LOGIN PASSWORD '${credential}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`)
  createdRole = true
  await owner.query(`GRANT couchone_authentication TO ${runtimeRole}`)
  target.username = runtimeRole
  target.password = credential
  runtime = new Pool({ connectionString: target.toString(), max: 3 })
  const digest = await hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
  for (const [name, role] of Object.entries({ proA: 'professional', proB: 'professional', proEmpty: 'professional', clientA: 'client', clientB: 'client', admin: 'admin' })) {
    const id = randomUUID()
    await database.query('INSERT INTO private.users(id,username,email,password_hash,role) VALUES($1,$2,$3,$4,$5)', [id, name.toLowerCase(), `${name.toLowerCase()}@example.com`, digest, role])
    const session = (await database.query('INSERT INTO private.sessions(user_id) VALUES($1) RETURNING id', [id])).rows[0].id
    actors[name] = { id, session }
    if (role === 'professional') {
      actors[name].professional = (await database.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,$2) RETURNING id", [id, name])).rows[0].id
      await database.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE name='Básico 10'", [actors[name].professional])
    }
  }
  for (const suffix of ['A', 'B']) {
    actors[`client${suffix}`].client = (await database.query(`INSERT INTO private.clients(professional_id,user_id,full_name,birth_date,height_cm,base_weight_kg,base_body_fat_percentage,waist_cm,hip_cm)
      VALUES($1,$2,$3,'1990-05-20',170.5,70.2,20.2,80.2,90.2) RETURNING id`, [actors[`pro${suffix}`].professional, actors[`client${suffix}`].id, `Client ${suffix}`])).rows[0].id
  }
  process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
  process.env.CORS_ORIGIN = 'http://localhost:5000'
  const { createApp } = await import('../src/app.js')
  const { signAccess } = await import('../src/features/auth/services/tokens.js')
  app = createApp(runtime)
  for (const actor of Object.values(actors)) actor.token = await signAccess(actor.id, actor.session)
})

after(async () => {
  await runtime?.end()
  await database?.end()
  if (createdDatabase) await owner.query(`DROP DATABASE "${databaseName}"`)
  if (createdRole) await owner.query(`DROP ROLE ${runtimeRole}`)
  await owner.end()
})

async function asSubject<T>(subject: string, work: (client: PoolClient) => Promise<T>) {
  const client = await runtime.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.subject_id',$1,true)", [subject])
    return await work(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

test('HU-019 composition reuses the real owned base profile and never fabricates unintegrated module records', async () => {
  const id = actors.clientA.client!
  const read = await request(app).get(`/api/clients/${id}/record`).set('Authorization', `Bearer ${actors.proA.token}`)
  const legacy = await request(app).get(`/api/clients/${id}`).set('Authorization', `Bearer ${actors.proA.token}`)
  assert.equal(read.status, 200)
  assert.equal(read.headers['cache-control'], 'no-store')
  assert.deepEqual(read.body.record.profile, legacy.body.client)
  assert.deepEqual(Object.keys(read.body), ['record'])
  assert.deepEqual(Object.keys(read.body.record).sort(), ['profile', 'sections'])
  assert.deepEqual(Object.keys(read.body.record.sections).sort(), ['bodyWeightHistory', 'evaluations', 'nutritionPlan', 'progress', 'trainingPlan'])
  for (const section of Object.values(read.body.record.sections)) assert.deepEqual(section, {status: 'not_integrated'})
  assert.equal(read.body.record.profile.id, id)
  assert.equal(read.body.record.profile.baseWeightKg, 70.2)
  assert.equal('createdAt' in read.body.record.profile, false)
  assert.equal('measuredAt' in read.body.record.profile, false)
  assert.equal('professionalId' in read.body.record.profile, false)
  const nullable = (await database.query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'HU019 nullable fixture') RETURNING id", [actors.proA.professional])).rows[0].id
  const absent = await request(app).get(`/api/clients/${nullable}/record`).set('Authorization', `Bearer ${actors.proA.token}`)
  assert.equal(absent.status, 200)
  assert.equal(absent.body.record.profile.goal, null)
  assert.equal(absent.body.record.profile.baseWeightKg, null)
  assert.deepEqual(absent.body.record.sections.bodyWeightHistory, {status: 'not_integrated'})
  await database.query('DELETE FROM private.clients WHERE id=$1', [nullable])
})

test('HU-019 role, ownership and injected query failures return no composed record', async () => {
  const id = actors.clientA.client!
  assert.equal((await request(app).get(`/api/clients/${id}/record`)).status, 401)
  for (const actor of ['clientA', 'admin']) {
    const result = await request(app).get(`/api/clients/${id}/record`).set('Authorization', `Bearer ${actors[actor].token}`)
    assert.equal(result.status, 403)
    assert.equal(result.body.record, undefined)
  }
  const foreign = await request(app).get(`/api/clients/${id}/record`).set('Authorization', `Bearer ${actors.proB.token}`)
  assert.equal(foreign.status, 404)
  assert.equal(foreign.body.record, undefined)
  for (const path of [`${id}/record?professionalId=${actors.proA.professional}`, 'invalid/record']) {
    const invalid = await request(app).get(`/api/clients/${path}`).set('Authorization', `Bearer ${actors.proA.token}`)
    assert.equal(invalid.status, 400)
    assert.equal(invalid.body.record, undefined)
  }
})

test('HU-019 failure of the available profile query is a safe error, never empty or partial success', async () => {
  // Fault injection belongs only to this suite's temporary database.
  await database.query('ALTER TABLE private.clients RENAME COLUMN goal TO hu019_hidden_goal')
  try {
    const result = await request(app).get(`/api/clients/${actors.clientA.client}/record`).set('Authorization', `Bearer ${actors.proA.token}`)
    assert.equal(result.status, 503)
    assert.deepEqual(result.body, {error: {code: 'SERVICE_UNAVAILABLE', message: 'No pudimos completar la solicitud.'}})
    assert.equal(result.headers['cache-control'], 'no-store')
  } finally {
    await database.query('ALTER TABLE private.clients RENAME COLUMN hu019_hidden_goal TO goal')
  }
  assert.equal((await request(app).get(`/api/clients/${actors.clientA.client}/record`).set('Authorization', `Bearer ${actors.proA.token}`)).status, 200)
})

test('ordinary LOGIN without a valid subject cannot read clients or base measurements', async () => {
  const role = (await runtime.query('SELECT current_user,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0]
  assert.equal(role.current_user, runtimeRole)
  for (const field of ['rolsuper', 'rolbypassrls', 'rolcreatedb', 'rolcreaterole']) assert.equal(role[field], false)
  for (const subject of ['', 'not-a-uuid', randomUUID(), actors.admin.id]) {
    await asSubject(subject, async (client) => {
      await client.query("SELECT set_config('app.client_id',$1,true),set_config('app.access_operation','activation',true)", [actors.clientB.client])
      assert.equal((await client.query('SELECT * FROM private.clients')).rowCount, 0)
    })
  }
  assert.equal((await runtime.query('SELECT birth_date,height_cm,base_weight_kg,base_body_fat_percentage,waist_cm,hip_cm FROM private.clients')).rowCount, 0)
})

test('each professional reads only their own portfolio and all foreign physical measures stay invisible', async () => {
  for (const [own, foreign] of [['A', 'B'], ['B', 'A']]) {
    await asSubject(actors[`pro${own}`].id, async (client) => {
      const rows = (await client.query('SELECT id,base_weight_kg,base_body_fat_percentage FROM private.clients')).rows
      assert.deepEqual(rows.map((row) => row.id), [actors[`client${own}`].client])
      assert.equal(Number(rows[0].base_weight_kg), 70.2)
      assert.equal((await client.query('SELECT birth_date,height_cm,base_weight_kg,base_body_fat_percentage,waist_cm,hip_cm FROM private.clients WHERE id=$1', [actors[`client${foreign}`].client])).rowCount, 0)
    })
    const response = await request(app).get('/api/clients').set('Cookie', `cof_access=${actors[`pro${own}`].token}`)
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.clients.map((c: { id: string }) => c.id), [actors[`client${own}`].client])
  }
  assert.equal((await runtime.query('SELECT * FROM private.clients')).rowCount, 0)
})

test('each active client reads only their linked record even when the professional is suspended', async () => {
  await database.query("UPDATE private.subscriptions SET status='suspended' WHERE professional_id=$1", [actors.proA.professional])
  try {
    for (const suffix of ['A', 'B']) {
      await asSubject(actors[`client${suffix}`].id, async (client) => {
        const result = await client.query('SELECT id,base_weight_kg FROM private.clients')
        assert.deepEqual(result.rows.map((r) => r.id), [actors[`client${suffix}`].client])
      })
      const response = await request(app).get(`/api/client/profile?clientId=${actors[`client${suffix === 'A' ? 'B' : 'A'}`].client}`).set('Authorization', `Bearer ${actors[`client${suffix}`].token}`)
      assert.equal(response.status, 200)
      assert.equal(response.body.profile.id, actors[`client${suffix}`].client)
    }
    await database.query("UPDATE private.users SET status='inactive' WHERE id=$1", [actors.clientA.id])
    await asSubject(actors.clientA.id, async (client) => assert.equal((await client.query('SELECT * FROM private.clients')).rowCount, 0))
  } finally {
    await database.query("UPDATE private.users SET status='active' WHERE id=$1", [actors.clientA.id])
    await database.query("UPDATE private.subscriptions SET status='active' WHERE professional_id=$1", [actors.proA.professional])
  }
})

test('special functions expose no physical rows and cannot grant a professional read context', async () => {
  const digest = randomBytes(32).toString('hex')
  const invited = (await database.query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'Invited fixture') RETURNING id", [actors.proB.professional])).rows[0].id
  await database.query("INSERT INTO private.invitations(client_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", [invited, digest])
  await asSubject('', async (client) => {
    const candidate = (await client.query('SELECT * FROM private.invited_client_record($1)', [digest])).rows
    assert.equal(candidate.length, 1)
    assert.deepEqual(Object.keys(candidate[0]).sort(), ['id', 'professional_id', 'status', 'user_id'])
    assert.equal(candidate[0].id, invited)
    assert.equal((await client.query('SELECT * FROM private.clients')).rowCount, 0)
    assert.equal((await client.query('SELECT * FROM private.invited_client_record($1)', [randomBytes(32).toString('hex')])).rowCount, 0)
    assert.equal((await client.query('SELECT * FROM private.admin_client_counts()')).rowCount, 0)
    assert.equal((await client.query('SELECT private.lock_expired_invitation_client($1) AS id', [invited])).rows[0].id, null)
    assert.equal((await client.query('SELECT private.link_invited_client($1,$2) AS linked', [digest, actors.clientA.id])).rows[0].linked, false)
    await assert.rejects(client.query('UPDATE private.clients SET user_id=$1 WHERE id=$2', [actors.clientA.id, invited]), { code: '42501' })
  })
  await asSubject(actors.proA.id, async (client) => assert.equal((await client.query('SELECT * FROM private.admin_client_counts()')).rowCount, 0))
  await asSubject(actors.admin.id, async (client) => {
    assert.equal((await client.query('SELECT * FROM private.admin_client_counts()')).rowCount, 2)
    assert.equal((await client.query('SELECT * FROM private.clients')).rowCount, 0)
  })
  await database.query("UPDATE private.invitations SET created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 day' WHERE client_id=$1", [invited])
  await asSubject('', async (client) => {
    assert.equal((await client.query("SELECT * FROM private.invited_client_record($1,clock_timestamp()-interval '2 days')", [digest])).rowCount, 0)
    assert.equal((await client.query('SELECT private.lock_expired_invitation_client($1) AS id', [invited])).rows[0].id, invited)
  })
  const functions = (await database.query("SELECT p.prosecdef,p.proconfig,NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_denied FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname IN ('invited_client_record','link_invited_client','admin_client_counts','lock_expired_invitation_client')")).rows
  assert.equal(functions.length, 4)
  for (const routine of functions) {
    assert.equal(routine.prosecdef, true)
    assert.equal(routine.public_denied, true)
    assert.ok(routine.proconfig.includes('search_path=pg_catalog, private'))
  }
})

const portfolioGet = (query: Record<string, string> = {}, actor = 'proA') =>
  request(app).get('/api/clients').query(query).set('Authorization', `Bearer ${actors[actor].token}`)

test('portfolio searches literal special characters and isolates active and inactive records', async () => {
  const names = ['Literal % name', 'Literal _ name', 'Literal \\ name', "Literal O'Connor", 'Literal 😀 Ána', "Literal ' OR 1=1 --"]
  for (const [index, name] of names.entries()) {
    await database.query('INSERT INTO private.clients(professional_id,full_name,status) VALUES($1,$2,$3)',
      [actors.proA.professional, name, index % 2 ? 'inactive' : 'active'])
    await database.query('INSERT INTO private.clients(professional_id,full_name) VALUES($1,$2)', [actors.proB.professional, name])
  }
  for (const search of ['%', '_', '\\', "O'Connor", '😀 ána', "' OR 1=1 --"]) {
    const result = await portfolioGet({ search })
    assert.equal(result.status, 200)
    assert.equal(result.body.clients.length, 1, search)
    assert.ok(names.includes(result.body.clients[0].fullName))
    const own = await database.query('SELECT id FROM private.clients WHERE id=$1 AND professional_id=$2', [result.body.clients[0].id, actors.proA.professional])
    assert.equal(own.rowCount, 1)
  }
  for (const status of ['active', 'inactive']) {
    const result = await portfolioGet({ search: 'literal', status })
    assert.equal(result.body.clients.length, 3)
    assert.ok(result.body.clients.every((row: { status: string }) => row.status === status))
  }
  const empty = await portfolioGet({ search: 'No coincidencias únicas' })
  assert.equal(empty.body.hasClients, true)
  assert.deepEqual(empty.body.clients, [])
  assert.equal(empty.body.pageInfo.nextCursor, null)
})

test('cursor traversal preserves microseconds and UUID ties without gaps or duplicates', async () => {
  for (let i = 0; i < 25; i++) {
    await database.query("INSERT INTO private.clients(professional_id,full_name,created_at) VALUES($1,$2,$3::timestamptz)",
      [actors.proA.professional, `Traversal ${i}`, `2026-01-01 12:00:00.${i % 2 ? '123456' : '123457'}+00`])
  }
  const expected = (await database.query('SELECT id FROM private.clients WHERE professional_id=$1 ORDER BY created_at DESC,id DESC', [actors.proA.professional])).rows.map((r) => r.id)
  const ids: string[] = []
  let cursor: string | null = null
  let firstCursor = ''
  for (let pages = 0; pages < 50; pages++) {
    const result = await portfolioGet({ pageSize: '3', ...(cursor ? { cursor } : {}) })
    assert.equal(result.status, 200)
    assert.ok(result.body.clients.length <= 3)
    ids.push(...result.body.clients.map((r: { id: string }) => r.id))
    if (!firstCursor) {
      firstCursor = result.body.pageInfo.nextCursor
      // A newer insert cannot shift the remaining keyset pages.
      await database.query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'New between pages')", [actors.proA.professional])
    }
    cursor = result.body.pageInfo.nextCursor
    if (!cursor) break
  }
  assert.deepEqual(ids, expected)
  assert.equal(new Set(ids).size, ids.length)
  for (const changed of [{ search: 'Traversal' }, { status: 'inactive' }, { pageSize: '4' }]) {
    assert.equal((await portfolioGet({ pageSize: '3', cursor: firstCursor, ...changed })).status, 400)
  }
  assert.equal((await portfolioGet({ pageSize: '3', cursor: firstCursor }, 'proB')).status, 400)
  assert.equal((await portfolioGet({ pageSize: '3', cursor: firstCursor.slice(0, -3) + 'abc' })).status, 400)
  const single = await portfolioGet({ search: 'Client A', pageSize: '1' })
  assert.equal(single.body.clients.length, 1)
  assert.equal(single.body.pageInfo.hasMore, false)
  assert.equal(single.body.pageInfo.nextCursor, null)
})

test('invalid portfolio queries fail before SQL and cannot inject owner or order', async () => {
  for (const query of [{ pageSize: '0' }, { pageSize: '101' }, { pageSize: '1.5' }, { cursor: 'broken' },
    { status: 'ACTIVE' }, { professionalId: actors.proB.professional! }, { order: 'id; DROP TABLE clients' }, { search: 'x'.repeat(151) }, { search: '\u0000' }]) {
    assert.equal((await portfolioGet(query)).status, 400)
  }
  assert.equal((await request(app).get('/api/clients?search=a&search=b').set('Cookie', `cof_access=${actors.proA.token}`)).status, 400)
  for (const actor of ['clientB', 'admin']) assert.equal((await portfolioGet({}, actor)).status, 403)
  assert.equal((await request(app).get('/api/clients')).status, 401)
})

test('empty portfolio and page-size boundaries have unambiguous pagination metadata', async () => {
  const empty = await portfolioGet({}, 'proEmpty')
  assert.equal(empty.status, 200)
  assert.deepEqual(empty.body, { clients: [], hasClients: false, pageInfo: { pageSize: 20, hasMore: false, nextCursor: null } })
  const first = await portfolioGet({ search: 'Traversal' })
  assert.equal(first.body.clients.length, 20)
  assert.equal(first.body.pageInfo.hasMore, true)
  const max = await portfolioGet({ search: 'Traversal', pageSize: '100' })
  assert.equal(max.body.clients.length, 25)
  assert.equal(max.body.pageInfo.hasMore, false)
  assert.deepEqual(Object.keys(max.body.clients[0]).sort(), ['id', 'userId', 'fullName', 'goal', 'status', 'invitationExpiresAt'].sort())
})

test('tenant cursor index supports ordered bounded reads with an ordinary runtime plan', async () => {
  await database.query(`INSERT INTO private.clients(professional_id,full_name)
    SELECT $1,'Index fixture '||n FROM generate_series(1,2500) n`, [actors.proA.professional])
  await database.query(`INSERT INTO private.clients(professional_id,full_name)
    SELECT $1,'Foreign index fixture '||n FROM generate_series(1,2500) n`, [actors.proB.professional])
  await database.query('ANALYZE private.clients')
  await asSubject(actors.proA.id, async (client) => {
    const result = await client.query('EXPLAIN (FORMAT JSON) SELECT id FROM private.clients WHERE professional_id=$1 ORDER BY created_at DESC,id DESC LIMIT 21', [actors.proA.professional])
    assert.match(JSON.stringify(result.rows), /idx_clients_portfolio_order/)
  })
})

test('read-only base record permits only owned records and preserves nullable legacy data', async () => {
  const detail = (id: string, actor = 'proA') => request(app).get(`/api/clients/${id}`).set('Authorization', `Bearer ${actors[actor].token}`)
  const own = await detail(actors.clientA.client!)
  assert.equal(own.status, 200)
  assert.equal(own.body.client.baseWeightKg, 70.2)
  assert.equal(own.body.client.birthDate, '1990-05-20')
  assert.equal('professionalId' in own.body.client, false)
  const foreign = await detail(actors.clientB.client!)
  const missing = await detail(randomUUID())
  assert.equal(foreign.status, 404)
  assert.deepEqual(foreign.body, missing.body)
  assert.equal((await detail('bad-id')).status, 400)
  for (const actor of ['clientB', 'admin']) assert.equal((await detail(actors.clientA.client!, actor)).status, 403)
  const legacy = (await database.query("INSERT INTO private.clients(professional_id,full_name,status) VALUES($1,'Legacy inactive','inactive') RETURNING id", [actors.proA.professional])).rows[0].id
  const record = (await detail(legacy)).body.client
  for (const key of ['birthDate', 'heightCm', 'baseWeightKg', 'baseBodyFatPercentage', 'waistCm', 'hipCm']) assert.equal(record[key], null)
  assert.equal(record.status, 'inactive')
  await database.query("UPDATE private.subscriptions SET status='suspended' WHERE professional_id=$1", [actors.proA.professional])
  try {
    assert.deepEqual((await portfolioGet()).body.clients, [])
    assert.equal((await detail(legacy)).status, 404)
  } finally { await database.query("UPDATE private.subscriptions SET status='active' WHERE professional_id=$1", [actors.proA.professional]) }
  assert.equal((await runtime.query('SELECT * FROM private.clients')).rowCount, 0)
})

async function editRecord(id: string, body: unknown, actor = 'proA') {
  const csrf = await request(app).get('/api/auth/csrf')
  return request(app).patch(`/api/clients/${id}`).set('Authorization', `Bearer ${actors[actor].token}`)
    .set('Origin', 'http://localhost:5000').set('Cookie', csrf.headers['set-cookie'])
    .set('X-CSRF-Token', csrf.body.csrfToken).send(body)
}
const readRecord = async (id: string) => (await request(app).get(`/api/clients/${id}`).set('Authorization', `Bearer ${actors.proA.token}`)).body.client

test('HU-017 own partial edits preserve untouched fields, metadata and runtime version ownership', async () => {
  const id = actors.clientA.client!
  const before = await readRecord(id)
  const changed = await editRecord(id, { version: before.version, fullName: 'Ana 😀 editada', waistCm: null })
  assert.equal(changed.status, 200)
  assert.equal(changed.body.client.version, before.version + 1)
  assert.equal(changed.body.client.fullName, 'Ana 😀 editada')
  assert.equal(changed.body.client.waistCm, null)
  for (const key of ['birthDate','heightCm','baseWeightKg','status','goal']) assert.equal(changed.body.client[key], before[key])
  const noop = await editRecord(id, { version: changed.body.client.version, fullName: ' Ana 😀 editada ' })
  assert.equal(noop.status, 200)
  assert.equal(noop.body.client.version, changed.body.client.version)
  await asSubject(actors.proA.id, async (client) => {
    await assert.rejects(client.query('UPDATE private.clients SET version=1 WHERE id=$1', [id]), { code: '42501' })
  })
  const forced = (await database.query("INSERT INTO private.clients(professional_id,full_name,version) VALUES($1,'Version fixture',999) RETURNING version", [actors.proA.professional])).rows[0]
  assert.equal(forced.version, 1)
})

test('HU-017 rejects invalid fields, foreign ownership, client/admin roles and missing CSRF without writes', async () => {
  const id = actors.clientA.client!
  const before = await readRecord(id)
  for (const patch of [{}, {version: before.version}, {version: 0, goal: 'x'}, {version: before.version, professionalId: actors.proB.professional},
    {version: before.version, status: 'inactive'}, {version: before.version, userId: null}, {version: before.version, fullName: ''},
    {version: before.version, goal: ''}, {version: before.version, heightCm: null}, {version: before.version, baseWeightKg: 70.25},
    {version: before.version, waistCm: 80.25}, {version: before.version, birthDate: '2026-02-30'}, {version: before.version, birthDate: '2020-01-01'}]) {
    assert.equal((await editRecord(id, patch)).status, 400, JSON.stringify(patch))
    assert.deepEqual(await readRecord(id), before)
  }
  for (const role of ['clientB', 'admin']) assert.equal((await editRecord(id, {version: before.version, goal: 'forbidden'}, role)).status, 403)
  const foreign = await editRecord(actors.clientB.client!, {version: 1, goal: 'foreign'})
  const missing = await editRecord(randomUUID(), {version: 1, goal: 'missing'})
  assert.equal(foreign.status, 404); assert.deepEqual(foreign.body, missing.body)
  assert.equal((await request(app).patch(`/api/clients/${id}`).set('Authorization', `Bearer ${actors.proA.token}`).send({version: before.version, goal: 'csrf'})).status, 403)
  assert.equal((await request(app).patch(`/api/clients/${id}`).send({version: before.version, goal: 'anonymous'})).status, 401)
  assert.deepEqual(await readRecord(id), before)
  await asSubject(actors.clientB.id, async (client) => assert.equal((await client.query("UPDATE private.clients SET goal='forged' WHERE id=$1", [actors.clientB.client])).rowCount, 0))
  await asSubject(actors.proA.id, async (client) => assert.equal((await client.query("UPDATE private.clients SET goal='forged' WHERE id=$1", [actors.clientB.client])).rowCount, 0))
})

test('HU-017 two editors and effective state changes cause conflicts, while no-op state updates do not', async () => {
  const id = actors.clientA.client!, before = await readRecord(id)
  const responses = await Promise.all(['First editor', 'Second editor'].map((goal) => editRecord(id, {version: before.version, goal})))
  assert.deepEqual(responses.map((r) => r.status).sort(), [200,409])
  const current = await readRecord(id)
  await asSubject(actors.proA.id, async (client) => {
    const row = (await client.query('UPDATE private.clients SET status=status WHERE id=$1 RETURNING version', [id])).rows[0]
    assert.equal(row.version, current.version)
    // asSubject rolls back: assertions also exercise the trigger with the ordinary role.
  })
  await database.query("UPDATE private.clients SET status='inactive' WHERE id=$1", [id])
  const conflict = await editRecord(id, {version: current.version, goal: 'must not overwrite'})
  assert.equal(conflict.status, 409); assert.equal(conflict.body.error.code, 'CLIENT_RECORD_CONFLICT')
  const inactive = await readRecord(id)
  assert.equal((await editRecord(id, {version: inactive.version, goal: 'Edit inactive record'})).status, 200)
})

test('HU-017 legacy base remains null until completed as a group and complete data cannot be cleared', async () => {
  const id = (await database.query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'Legacy edit fixture') RETURNING id", [actors.proA.professional])).rows[0].id
  assert.equal((await editRecord(id, {version: 1, goal: 'Only goal', baseBodyFatPercentage: 20.2})).status, 200)
  const legacy = await readRecord(id)
  for (const key of ['birthDate','heightCm','baseWeightKg']) assert.equal(legacy[key], null)
  assert.equal((await editRecord(id, {version: legacy.version, heightCm: 170.5})).status, 400)
  const complete = await editRecord(id, {version: legacy.version, birthDate: '1990-05-20', heightCm: 170.5, baseWeightKg: 70.2})
  assert.equal(complete.status, 200)
  assert.equal((await editRecord(id, {version: complete.body.client.version, birthDate: null, heightCm: null, baseWeightKg: null})).status, 400)
})

test('HU-017 omitted text preserves legacy whitespace rather than normalizing other fields', async () => {
  const id = (await database.query("INSERT INTO private.clients(professional_id,full_name,goal) VALUES($1,'  Legacy name  ','  Legacy goal  ') RETURNING id", [actors.proA.professional])).rows[0].id
  const response = await editRecord(id, {version: 1, waistCm: 81.2})
  assert.equal(response.status, 200)
  assert.equal(response.body.client.fullName, '  Legacy name  ')
  assert.equal(response.body.client.goal, '  Legacy goal  ')
})

test('HU-017 editing at full capacity consumes no place, but DEC-004 blocks absent/suspended/expired subscriptions', async () => {
  const id = actors.clientA.client!
  const usage = async () => (await database.query("SELECT count(*)::int AS n FROM private.clients WHERE professional_id=$1 AND status='active'", [actors.proA.professional])).rows[0].n
  await database.query("INSERT INTO private.clients(professional_id,full_name) SELECT $1,'Full edit fixture '||n FROM generate_series(1,12) n", [actors.proA.professional])
  const before = await readRecord(id), count = await usage()
  assert.equal((await editRecord(id, {version: before.version, goal: 'Edit above capacity'})).status, 200)
  assert.equal(await usage(), count)
  const snapshot = (await database.query('SELECT * FROM private.clients WHERE id=$1', [id])).rows[0]
  for (const status of ['suspended', 'expired']) {
    await database.query('UPDATE private.subscriptions SET status=$1 WHERE professional_id=$2', [status, actors.proA.professional])
    const response = await editRecord(id, {version: snapshot.version, goal: 'blocked'})
    assert.equal(response.status, 403); assert.equal(response.body.error.code, 'SUBSCRIPTION_SUSPENDED')
  }
  await database.query("UPDATE private.subscriptions SET status='active' WHERE professional_id=$1", [actors.proA.professional])
  const sub = (await database.query('DELETE FROM private.subscriptions WHERE professional_id=$1 RETURNING *', [actors.proA.professional])).rows[0]
  try {
    const response = await editRecord(id, {version: snapshot.version, goal: 'blocked'})
    assert.equal(response.status, 403); assert.equal(response.body.error.code, 'PLAN_REQUIRED')
  } finally { await database.query('INSERT INTO private.subscriptions SELECT * FROM json_populate_record(NULL::private.subscriptions,$1)', [JSON.stringify(sub)]) }
  assert.deepEqual((await database.query('SELECT * FROM private.clients WHERE id=$1', [id])).rows[0], snapshot)
})

test('HU-017 failed persistence rolls back fields and version and preserves existing linkage and access records', async () => {
  const id = actors.clientA.client!, before = await readRecord(id)
  const related = async () => ({ client: (await database.query('SELECT * FROM private.clients WHERE id=$1', [id])).rows,
    invitations: (await database.query('SELECT * FROM private.invitations WHERE client_id=$1 ORDER BY id', [id])).rows,
    events: (await database.query('SELECT * FROM private.access_events WHERE client_id=$1 ORDER BY id', [id])).rows })
  const snapshot = await related()
  await database.query("CREATE FUNCTION private.fail_hu017_edit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER fail_hu017_edit AFTER UPDATE ON private.clients FOR EACH ROW EXECUTE FUNCTION private.fail_hu017_edit()")
  try { assert.equal((await editRecord(id, {version: before.version, goal: 'rollback'})).status, 503) }
  finally { await database.query('DROP TRIGGER fail_hu017_edit ON private.clients; DROP FUNCTION private.fail_hu017_edit()') }
  assert.deepEqual(await related(), snapshot)
  assert.equal((await runtime.query('SELECT * FROM private.clients')).rowCount, 0)
})

test('HU-017 activation capability changes database version and stale editor cannot overwrite the linked record', async () => {
  const id = (await database.query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'Activation version fixture') RETURNING id", [actors.proA.professional])).rows[0].id
  const digest = randomBytes(32).toString('hex')
  const user = (await database.query("INSERT INTO private.users(username,email,password_hash,role) SELECT $1,$2,password_hash,'client' FROM private.users WHERE id=$3 RETURNING id", [`activate.${run}`, `activate.${run}@example.com`, actors.clientB.id])).rows[0].id
  await database.query("INSERT INTO private.invitations(client_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", [id, digest])
  const client = await runtime.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.access_operation','activation',true)")
    await client.query("SELECT set_config('app.client_id',$1,true)", [id])
    assert.equal((await client.query('SELECT private.link_invited_client($1,$2) AS linked', [digest,user])).rows[0].linked, true)
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  assert.equal((await readRecord(id)).version, 2)
  assert.equal((await editRecord(id, {version: 1, goal: 'stale activation edit'})).status, 409)
  assert.equal((await database.query('SELECT user_id FROM private.clients WHERE id=$1', [id])).rows[0].user_id, user)
})

test('HU-017 successful editing preserves nonempty invitations and existing access audit without fabricating historical modules', async () => {
  const id = (await database.query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'Preserved related records') RETURNING id", [actors.proA.professional])).rows[0].id
  await database.query("INSERT INTO private.invitations(client_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", [id, randomBytes(32).toString('hex')])
  await database.query("INSERT INTO private.access_events(actor_id,client_id,action) VALUES($1,$2,'invitation_issued')", [actors.proA.id, id])
  const related = async () => ({ invitations: (await database.query('SELECT * FROM private.invitations WHERE client_id=$1', [id])).rows,
    events: (await database.query('SELECT * FROM private.access_events WHERE client_id=$1', [id])).rows })
  const before = await related()
  assert.equal(before.invitations.length, 1); assert.equal(before.events.length, 1)
  assert.equal((await editRecord(id, {version: 1, goal: 'New base goal'})).status, 200)
  assert.deepEqual(await related(), before)
})

async function statusActor() {
  const id = randomUUID(), key = `status.${id.slice(0,8)}`
  await database.query("INSERT INTO private.users(id,username,email,password_hash,role) SELECT $1,$2,$3,password_hash,'professional' FROM private.users WHERE id=$4", [id,key,`${key}@example.com`,actors.proA.id])
  const professional = (await database.query('INSERT INTO private.professionals(user_id,full_name) VALUES($1,$2) RETURNING id', [id,key])).rows[0].id
  const session = (await database.query('INSERT INTO private.sessions(user_id) VALUES($1) RETURNING id', [id])).rows[0].id
  await database.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE name='Básico 10'", [professional])
  const { signAccess } = await import('../src/features/auth/services/tokens.js')
  actors[key] = {id,professional,session,token:await signAccess(id,session)}
  return key
}
async function statusFixture(actor: string, status = 'active') {
  return (await database.query('INSERT INTO private.clients(professional_id,full_name,status) VALUES($1,$2,$3) RETURNING id', [actors[actor].professional,`HU018 ${randomUUID()}`,status])).rows[0].id as string
}
async function changeStatus(id: string, body: unknown, actor: string) {
  const csrf=await request(app).get('/api/auth/csrf')
  return request(app).patch(`/api/clients/${id}/status`).set('Authorization',`Bearer ${actors[actor].token}`)
    .set('Origin','http://localhost:5000').set('Cookie',csrf.headers['set-cookie']).set('X-CSRF-Token',csrf.body.csrfToken).send(body)
}
const statusSnapshot = async (id: string) => (await database.query('SELECT * FROM private.clients WHERE id=$1',[id])).rows[0]
const statusEvents = async (id: string) => (await database.query("SELECT * FROM private.access_events WHERE client_id=$1 AND action IN ('client_record_activated','client_record_inactivated') ORDER BY created_at,id",[id])).rows

test('HU-020 own base projection excludes ownership, progress and history; query injection and other roles cannot select another record', async () => {
  for (const suffix of ['A','B']) {
    const actor=actors[`client${suffix}`]
    const response=await request(app).get('/api/me/record').set('Authorization',`Bearer ${actor.token}`)
    assert.equal(response.status,200)
    assert.equal(response.headers['cache-control'],'no-store')
    assert.equal(response.body.record.id,actor.client)
    assert.deepEqual(Object.keys(response.body.record).sort(),['id','fullName','goal','status','username','email','birthDate','heightCm','baseWeightKg','baseBodyFatPercentage','waistCm','hipCm'].sort())
    const stored=await statusSnapshot(actor.client!)
    for (const [json,sql] of [['baseBodyFatPercentage','base_body_fat_percentage'],['waistCm','waist_cm'],['hipCm','hip_cm']])
      assert.equal(response.body.record[json],stored[sql] === null ? null : Number(stored[sql]))
    assert.equal((await request(app).get(`/api/me/record?clientId=${actors.clientA.client}`).set('Authorization',`Bearer ${actor.token}`)).status,400)
    const legacy=await request(app).get('/api/client/profile').set('Authorization',`Bearer ${actor.token}`)
    assert.equal(legacy.status,200); assert.equal(legacy.body.profile.id,actor.client)
    assert.equal('birthDate' in legacy.body.profile,false)
    assert.equal('professionalId' in legacy.body.profile,true)
    assert.equal((await request(app).patch('/api/me/record').set('Authorization',`Bearer ${actor.token}`).send({goal:'forged'})).status,403)
  }
  for (const role of ['proA','admin']) assert.equal((await request(app).get('/api/me/record').set('Authorization',`Bearer ${actors[role].token}`)).status,403)
  assert.equal((await request(app).get('/api/me/record')).status,401)
  assert.equal((await request(app).get('/api/me/plans').set('Authorization',`Bearer ${actors.proA.token}`)).status,200)
  assert.equal((await request(app).get('/api/me/plans').set('Authorization',`Bearer ${actors.clientB.token}`)).status,403)
  assert.equal((await runtime.query('SELECT * FROM private.clients')).rowCount,0)
})

test('HU-020 reads inactive own record without subscription or quota; revoked account and sessions cannot read', async () => {
  const actor=await statusActor(), id=await statusFixture(actor,'inactive')
  const user=randomUUID(), name=`qa020.${user.slice(0,8)}`
  await database.query("INSERT INTO private.users(id,username,email,password_hash,role) SELECT $1,$2,$3,password_hash,'client' FROM private.users WHERE id=$4",[user,name,`${name}@example.com`,actors.proA.id])
  await database.query('UPDATE private.clients SET user_id=$2 WHERE id=$1',[id,user])
  await database.query('DELETE FROM private.subscriptions WHERE professional_id=$1',[actors[actor].professional])
  await database.query("UPDATE private.users SET status='inactive' WHERE id=$1",[actors[actor].id])
  const session=(await database.query('INSERT INTO private.sessions(user_id) VALUES($1) RETURNING id',[user])).rows[0].id
  const {signAccess}=await import('../src/features/auth/services/tokens.js')
  const token=await signAccess(user,session)
  const read=()=>request(app).get('/api/me/record').set('Authorization',`Bearer ${token}`)
  const result=await read(); assert.equal(result.status,200); assert.equal(result.body.record.id,id)
  for (const key of ['birthDate','heightCm','baseWeightKg','baseBodyFatPercentage','waistCm','hipCm']) assert.equal(result.body.record[key],null)
  await database.query('UPDATE private.sessions SET revoked_at=clock_timestamp() WHERE id=$1',[session])
  assert.equal((await read()).status,401)
  await database.query("UPDATE private.users SET status='inactive' WHERE id=$1",[user])
  assert.equal((await read()).status,401)
})

test('HU-020 vertical registration invitation activation and professional edit preserve the exact linked record and client isolation', async () => {
  const key=`qa020.${randomBytes(5).toString('hex')}`, email=`${key}@example.com`
  const registered=await request(app).post('/api/auth/professionals').send({fullName:'HU020 QA professional',username:key,email,emailConfirmation:email,password,passwordConfirmation:password,planInterest:'basic',noticeVersion:'2026-10-15.1',acceptsNotice:true})
  assert.equal(registered.status,201)
  const user=registered.body.account.id
  const professional=(await database.query('SELECT id FROM private.professionals WHERE user_id=$1',[user])).rows[0].id
  // Subscription setup is synthetic QA provisioning, not a fabricated payment.
  await database.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE name='Básico 10'",[professional])
  const csrf=await request(app).get('/api/auth/csrf')
  const login=await request(app).post('/api/auth/login').set('Origin','http://localhost:5000').set('Cookie',csrf.headers['set-cookie']).set('X-CSRF-Token',csrf.body.csrfToken).send({identifier:key,password})
  assert.equal(login.status,200)
  const cookies=[...csrf.headers['set-cookie'],...login.headers['set-cookie']]
  const web=(method:'post'|'patch',url:string,body:unknown)=>request(app)[method](url).set('Origin','http://localhost:5000').set('Cookie',cookies).set('X-CSRF-Token',csrf.body.csrfToken).send(body)
  const base={fullName:'HU020 QA Unicode Sofía',goal:'Objetivo inicial',birthDate:'1990-06-15',heightCm:170.5,baseWeightKg:70.2,baseBodyFatPercentage:20.2,waistCm:80.2,hipCm:90.2}
  const created=await web('post','/api/clients',base); assert.equal(created.status,201)
  const id=created.body.client.id
  const invitation=await web('post',`/api/clients/${id}/invitations`,{}); assert.equal(invitation.status,201)
  const clientName=`c.${key}`, clientEmail=`${clientName}@example.com`
  const activation=await request(app).post('/api/auth/activation').send({code:invitation.body.code,username:clientName,email:clientEmail,emailConfirmation:clientEmail,password,passwordConfirmation:password,noticeVersion:'2026-10-15.1',acceptsNotice:true})
  assert.equal(activation.status,201)
  assert.equal(activation.body.account.clientId,id)
  const token=activation.body.session.accessToken
  const read=()=>request(app).get('/api/me/record').set('Authorization',`Bearer ${token}`)
  const first=await read(); assert.equal(first.status,200); assert.equal(first.body.record.id,id)
  for(const [field,value] of Object.entries(base)) assert.deepEqual(first.body.record[field],value)
  const version=(await statusSnapshot(id)).version
  const edited=await web('patch',`/api/clients/${id}`,{version,goal:'Objetivo actualizado HU020',baseWeightKg:71.3}); assert.equal(edited.status,200)
  const updated=await read(); assert.equal(updated.body.record.id,id); assert.equal(updated.body.record.goal,'Objetivo actualizado HU020'); assert.equal(updated.body.record.baseWeightKg,71.3)
  const other=await request(app).get('/api/me/record').set('Authorization',`Bearer ${actors.clientB.token}`)
  assert.equal(other.body.record.id,actors.clientB.client); assert.notEqual(other.body.record.id,id)
  assert.equal((await request(app).get(`/api/me/record?clientId=${id}`).set('Authorization',`Bearer ${actors.clientB.token}`)).status,400)
  assert.equal((await database.query('SELECT count(*)::int AS n FROM private.clients WHERE id=$1',[id])).rows[0].n,1)
})

test('HU-018 effective transitions audit once and no-op repetitions ignore older versions without consuming capacity', async () => {
  const actor=await statusActor(), id=await statusFixture(actor)
  const before=await statusSnapshot(id)
  const down=await changeStatus(id,{status:'inactive',version:1},actor)
  assert.equal(down.status,200); assert.equal(down.body.client.version,2)
  assert.deepEqual(Object.keys(down.body.client).sort(),['id','fullName','goal','birthDate','heightCm','baseWeightKg','baseBodyFatPercentage','waistCm','hipCm','status','version'].sort())
  const repeat=await changeStatus(id,{status:'inactive',version:1},actor)
  assert.equal(repeat.status,200); assert.equal(repeat.body.client.version,2)
  assert.equal((await statusEvents(id)).length,1)
  assert.equal((await statusEvents(id))[0].actor_id,actors[actor].id)
  assert.equal((await statusEvents(id))[0].action,'client_record_inactivated')
  assert.equal((await changeStatus(id,{status:'active',version:2},actor)).status,200)
  assert.equal((await statusSnapshot(id)).version,3)
  const stale=await changeStatus(id,{status:'inactive',version:1},actor)
  assert.equal(stale.status,409); assert.equal(stale.body.error.code,'CLIENT_RECORD_CONFLICT')
  assert.equal((await statusSnapshot(id)).status,'active')
  assert.equal((await statusEvents(id)).length,2)
  const after=await statusSnapshot(id)
  for(const key of Object.keys(before).filter(key=>!['version','status'].includes(key))) assert.deepEqual(after[key],before[key],key)
})

test('HU-018 concurrent duplicates emit one audit; opposite old requests and HU-017 editors cannot overwrite newer transitions', async () => {
  const actor=await statusActor(), id=await statusFixture(actor)
  const repeated=await Promise.all([changeStatus(id,{status:'inactive',version:1},actor),changeStatus(id,{status:'inactive',version:1},actor)])
  assert.deepEqual(repeated.map(r=>r.status),[200,200]); assert.equal((await statusEvents(id)).length,1)
  assert.equal((await statusSnapshot(id)).version,2)
  const editor=await editRecord(id,{version:1,goal:'stale editor'},actor)
  assert.equal(editor.status,409)
  const edit=await editRecord(id,{version:2,goal:'updated base'},actor)
  assert.equal(edit.status,200)
  assert.equal((await changeStatus(id,{status:'active',version:2},actor)).status,409)
  assert.equal((await changeStatus(id,{status:'inactive',version:1},actor)).status,200)
  assert.equal((await statusSnapshot(id)).version,3)
  assert.equal((await statusEvents(id)).length,1)
})

test('HU-018 ordinary roles reject foreign/malformed/forged/anonymous requests and preserve state and audit', async () => {
  const actor=await statusActor(), other=await statusActor(), id=await statusFixture(actor)
  const before=await statusSnapshot(id)
  for(const body of [{status:'inactive'}, {status:'inactive',version:0},{status:'inactive',version:'1'}, {status:'inactive',version:1,accountStatus:'inactive'},
    {status:'inactive',version:1,userId:actors.clientB.id},{status:'inactive',version:1,professionalId:actors[other].professional},{status:'deleted',version:1}])
    assert.equal((await changeStatus(id,body,actor)).status,400)
  for(const denied of ['clientB','admin']) assert.equal((await changeStatus(id,{status:'inactive',version:1},denied)).status,403)
  const foreign=await changeStatus(id,{status:'inactive',version:1},other), missing=await changeStatus(randomUUID(),{status:'inactive',version:1},other)
  assert.equal(foreign.status,404); assert.deepEqual(foreign.body,missing.body)
  assert.equal((await request(app).patch(`/api/clients/${id}/status`).send({status:'inactive',version:1})).status,401)
  assert.equal((await request(app).patch(`/api/clients/${id}/status`).set('Authorization',`Bearer ${actors[actor].token}`).send({status:'inactive',version:1})).status,403)
  assert.deepEqual(await statusSnapshot(id),before); assert.equal((await statusEvents(id)).length,0)
})

test('HU-018 audit failure rolls back status/version/place and releases transaction context', async () => {
  const actor=await statusActor(), id=await statusFixture(actor), before=await statusSnapshot(id)
  await database.query("CREATE FUNCTION private.fail_hu018_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('client_record_activated','client_record_inactivated') THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_hu018_audit BEFORE INSERT ON private.access_events FOR EACH ROW EXECUTE FUNCTION private.fail_hu018_audit()")
  try{assert.equal((await changeStatus(id,{status:'inactive',version:1},actor)).status,503)}
  finally{await database.query('DROP TRIGGER fail_hu018_audit ON private.access_events; DROP FUNCTION private.fail_hu018_audit()')}
  assert.deepEqual(await statusSnapshot(id),before); assert.equal((await statusEvents(id)).length,0)
  assert.equal((await runtime.query('SELECT * FROM private.clients')).rowCount,0)
  assert.equal((await changeStatus(id,{status:'inactive',version:1},actor)).status,200)
})

test('HU-018 inactivation preserves linked account/open sessions/subscription and client read/refresh; account inactivity remains independent', async () => {
  const actor=await statusActor(), id=await statusFixture(actor)
  const user=randomUUID(), key=`client.${user.slice(0,8)}`
  await database.query("INSERT INTO private.users(id,username,email,password_hash,role) SELECT $1,$2,$3,password_hash,'client' FROM private.users WHERE id=$4",[user,key,`${key}@example.com`,actors.proA.id])
  await database.query('UPDATE private.clients SET user_id=$2 WHERE id=$1',[id,user])
  const {createHash}=await import('node:crypto'), {signAccess}=await import('../src/features/auth/services/tokens.js')
  const session=(await database.query('INSERT INTO private.sessions(user_id) VALUES($1) RETURNING id',[user])).rows[0].id
  const refresh=randomBytes(32).toString('base64url')
  await database.query('INSERT INTO private.refresh_tokens(session_id,token_hash) VALUES($1,$2)',[session,createHash('sha256').update(refresh).digest('hex')])
  const token=await signAccess(user,session)
  const sub=(await database.query('SELECT * FROM private.subscriptions WHERE professional_id=$1',[actors[actor].professional])).rows[0]
  assert.equal((await changeStatus(id,{status:'inactive',version:2},actor)).status,200)
  assert.equal((await database.query('SELECT status FROM private.users WHERE id=$1',[user])).rows[0].status,'active')
  assert.equal((await database.query('SELECT revoked_at FROM private.sessions WHERE id=$1',[session])).rows[0].revoked_at,null)
  assert.deepEqual((await database.query('SELECT * FROM private.subscriptions WHERE professional_id=$1',[actors[actor].professional])).rows[0],sub)
  assert.equal((await request(app).get('/api/client/profile').set('Authorization',`Bearer ${token}`)).status,200)
  assert.equal((await request(app).post('/api/auth/client/login').send({identifier:key,password})).status,200)
  const renewed=await request(app).post('/api/auth/client/refresh').send({refreshToken:refresh})
  assert.equal(renewed.status,200)
  const {setAccountStatus}=await import('../src/features/auth/services/session.js')
  await setAccountStatus(database,user,'inactive')
  assert.equal((await changeStatus(id,{status:'active',version:3},actor)).status,200)
  assert.equal((await database.query('SELECT status FROM private.users WHERE id=$1',[user])).rows[0].status,'inactive')
  assert.equal((await request(app).get('/api/client/profile').set('Authorization',`Bearer ${token}`)).status,401)
})

test('HU-018 invitation survives inactivation, cannot be issued/redeemed while inactive and regains eligibility after explicit reactivation', async () => {
  const actor=await statusActor(), id=await statusFixture(actor)
  const code=randomBytes(32).toString('base64url'), {createHash}=await import('node:crypto')
  await database.query("INSERT INTO private.invitations(client_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')",[id,createHash('sha256').update(code).digest('hex')])
  await database.query("INSERT INTO private.access_events(actor_id,client_id,action) VALUES($1,$2,'invitation_issued')",[actors[actor].id,id])
  const invitation=(await database.query('SELECT * FROM private.invitations WHERE client_id=$1',[id])).rows
  const prevalidate=()=>request(app).post('/api/auth/activation/prevalidate').send({code})
  assert.equal((await prevalidate()).status,200)
  assert.equal((await changeStatus(id,{status:'inactive',version:1},actor)).status,200)
  assert.equal((await prevalidate()).status,400)
  const csrf = await request(app).get('/api/auth/csrf')
  const issue = await request(app).post(`/api/clients/${id}/invitations`).set('Authorization',`Bearer ${actors[actor].token}`)
    .set('Origin','http://localhost:5000').set('Cookie',csrf.headers['set-cookie']).set('X-CSRF-Token',csrf.body.csrfToken).send({})
  assert.equal(issue.status,400)
  assert.deepEqual((await database.query('SELECT * FROM private.invitations WHERE client_id=$1',[id])).rows,invitation)
  assert.equal((await changeStatus(id,{status:'active',version:2},actor)).status,200)
  assert.equal((await prevalidate()).status,200)
  assert.equal((await database.query("SELECT count(*)::int AS n FROM private.access_events WHERE client_id=$1 AND action='invitation_issued'",[id])).rows[0].n,1)
})

test('HU-018 last-place competition, no-op at full capacity and DEC-004 suspended/no-plan eligibility', async () => {
  const actor=await statusActor(), first=await statusFixture(actor,'inactive'), second=await statusFixture(actor,'inactive')
  await database.query("INSERT INTO private.clients(professional_id,full_name) SELECT $1,'Reserved '||n FROM generate_series(1,9) n",[actors[actor].professional])
  const outcomes=await Promise.all([changeStatus(first,{status:'active',version:1},actor),changeStatus(second,{status:'active',version:1},actor)])
  assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409])
  assert.equal(outcomes.find(r=>r.status===409)!.body.error.code,'CUPO_AGOTADO')
  const winner=(await statusSnapshot(first)).status==='active'?first:second
  assert.equal((await changeStatus(winner,{status:'active',version:1},actor)).status,200)
  assert.equal((await statusEvents(winner)).length,1)
  const before=await statusSnapshot(winner)
  await database.query("UPDATE private.subscriptions SET status='suspended' WHERE professional_id=$1",[actors[actor].professional])
  assert.equal((await changeStatus(winner,{status:'inactive',version:before.version},actor)).status,403)
  await database.query('DELETE FROM private.subscriptions WHERE professional_id=$1',[actors[actor].professional])
  const noPlan=await changeStatus(winner,{status:'inactive',version:before.version},actor)
  assert.equal(noPlan.status,403); assert.equal(noPlan.body.error.code,'PLAN_REQUIRED')
  assert.deepEqual(await statusSnapshot(winner),before)
})

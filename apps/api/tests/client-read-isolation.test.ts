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
  runtime = new Pool({ connectionString: target.toString(), max: 1 })
  const digest = await hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
  for (const [name, role] of Object.entries({ proA: 'professional', proB: 'professional', clientA: 'client', clientB: 'client', admin: 'admin' })) {
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

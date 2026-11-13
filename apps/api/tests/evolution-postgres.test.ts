import assert from 'node:assert/strict'
import { before, after, test, describe } from 'node:test'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Pool, type PoolClient } from 'pg'
import request from 'supertest'
import type { Express } from 'express'

describe(
  'HU-022 isolated physical PostgreSQL',
  { skip: process.env.HU022_TEMPORARY_PG_AUTHORIZED !== 'yes' },
  () => {
    // Explicit opt-in; never consume DATABASE_URL / TEST_DATABASE_URL or local .env.
    if (process.env.HU022_TEMPORARY_PG_AUTHORIZED !== 'yes')
      throw Error('Explicit temporary PostgreSQL authorization required')
    const source = process.env.HU022_SETUP_DATABASE_URL
    if (!source) throw Error('Separate setup connection required')
    const url = new URL(source)
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.port, '5433')
    assert.equal(url.pathname, '/postgres')
    const name = `cof_hu022_${randomBytes(10).toString('hex')}`
    assert.match(name, /^cof_hu022_[0-9a-f]{20}$/)
    const owner = new Pool({
      connectionString: source,
      connectionTimeoutMillis: 5000,
    })
    let db: Pool | undefined, runtime: Pool | undefined, app: Express
    let csrfHeaders: Record<string, string>
    let dbOid: number | undefined, roleOid: number | undefined, globals: unknown
    const actors: Record<
      string,
      {
        id: string
        session: string
        professional?: string
        client?: string
        token?: string
      }
    > = {}
    const schema = readFileSync(
      new URL(
        '../../../docs/database/schemas/identity_access.sql',
        import.meta.url,
      ),
      'utf8',
    )
    assert.equal((schema.match(/DO \$roles\$/g) ?? []).length, 2)
    assert.equal(
      (
        schema.match(
          /^GRANT couchone_registration TO couchone_authentication;$/gm,
        ) ?? []
      ).length,
      1,
    )
    const isolatedSchema = schema
      .replace(/DO \$roles\$[\s\S]*?END \$roles\$;/g, '')
      .replace(/^GRANT couchone_registration TO couchone_authentication;$/m, '')
    assert.doesNotMatch(
      isolatedSchema,
      /\b(?:CREATE|ALTER|DROP) ROLE\b|^GRANT \w+ TO \w+;/m,
    )
    async function globalState() {
      return (
        await owner.query(`SELECT r.rolname,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,r.rolcanlogin,
    COALESCE((SELECT jsonb_agg(parent.rolname ORDER BY parent.rolname) FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid WHERE m.member=r.oid),'[]'::jsonb) AS parents
    FROM pg_roles r WHERE r.rolname IN ('couchone_registration','couchone_authentication','couchone_provision','couchone_api') ORDER BY r.rolname`)
      ).rows
    }
    async function target(pool: Pool, database: string) {
      const row = (
        await pool.query(
          "SELECT host(inet_server_addr()) AS host,inet_server_port() AS port,current_database() AS db,current_setting('server_version_num')::int AS version",
        )
      ).rows[0]
      assert.equal(row.host, '127.0.0.1')
      assert.equal(row.port, 5433)
      assert.equal(row.db, database)
      assert.ok(row.version >= 170000 && row.version < 180000)
    }
    before(async () => {
      await target(owner, 'postgres')
      globals = await globalState()
      assert.equal((globals as unknown[]).length, 4)
      for (const role of globals as {
        rolname: string
        rolsuper: boolean
        rolcreatedb: boolean
        rolcreaterole: boolean
        rolbypassrls: boolean
        parents: string[]
      }[]) {
        assert.equal(role.rolsuper, false)
        assert.equal(role.rolcreatedb, false)
        assert.equal(role.rolcreaterole, false)
        assert.equal(role.rolbypassrls, false)
        if (role.rolname === 'couchone_authentication')
          assert.deepEqual(role.parents, ['couchone_registration'])
        if (
          ['couchone_registration', 'couchone_provision'].includes(role.rolname)
        )
          assert.deepEqual(role.parents, [])
      }
      assert.equal(
        (
          await owner.query('SELECT 1 FROM pg_database WHERE datname=$1', [
            name,
          ])
        ).rowCount,
        0,
      )
      assert.equal(
        (await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]))
          .rowCount,
        0,
      )
      const password = randomBytes(32).toString('hex')
      // Only the NEW role receives a parent; no existing member's memberships change.
      await owner.query(
        `CREATE ROLE "${name}" LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION IN ROLE couchone_authentication PASSWORD '${password}'`,
      )
      roleOid = (
        await owner.query('SELECT oid FROM pg_roles WHERE rolname=$1', [name])
      ).rows[0].oid
      await owner.query(`CREATE DATABASE "${name}"`)
      dbOid = (
        await owner.query('SELECT oid FROM pg_database WHERE datname=$1', [
          name,
        ])
      ).rows[0].oid
      const databaseUrl = new URL(source)
      databaseUrl.pathname = `/${name}`
      db = new Pool({ connectionString: databaseUrl.toString() })
      await target(db, name)
      await db.query(isolatedSchema)
      const runtimeUrl = new URL(databaseUrl)
      runtimeUrl.username = name
      runtimeUrl.password = password
      runtime = new Pool({ connectionString: runtimeUrl.toString(), max: 3 })
      await target(runtime, name)
      assert.deepEqual(
        (
          await runtime.query(
            'SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user',
          )
        ).rows[0],
        {
          rolsuper: false,
          rolbypassrls: false,
          rolcreatedb: false,
          rolcreaterole: false,
        },
      )
      for (const [key, role] of Object.entries({
        proA: 'professional',
        proB: 'professional',
        disabled: 'professional',
        clientA: 'client',
        clientB: 'client',
        admin: 'admin',
        revoked: 'professional',
      })) {
        const id = randomUUID()
        await db.query(
          "INSERT INTO private.users(id,username,email,password_hash,role) VALUES($1,$2,$3,'$argon2id$synthetic-fixture',$4)",
          [id, key.toLowerCase(), `${key.toLowerCase()}@example.com`, role],
        )
        const session = (
          await db.query(
            'INSERT INTO private.sessions(user_id) VALUES($1) RETURNING id',
            [id],
          )
        ).rows[0].id
        actors[key] = { id, session }
        if (role === 'professional') {
          actors[key].professional = (
            await db.query(
              'INSERT INTO private.professionals(user_id,full_name) VALUES($1,$2) RETURNING id',
              [id, `Synthetic ${key}`],
            )
          ).rows[0].id
          if (key !== 'disabled')
            await db.query(
              "INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE name='Básico 10'",
              [actors[key].professional],
            )
        }
      }
      for (const suffix of ['A', 'B'])
        actors[`client${suffix}`].client = (
          await db.query(
            "INSERT INTO private.clients(professional_id,user_id,full_name,birth_date,height_cm,base_weight_kg) VALUES($1,$2,$3,'1990-01-01',170.1,70.1) RETURNING id",
            [
              actors[`pro${suffix}`].professional,
              actors[`client${suffix}`].id,
              `Synthetic client ${suffix}`,
            ],
          )
        ).rows[0].id
      await db.query(
        'UPDATE private.sessions SET revoked_at=clock_timestamp() WHERE id=$1',
        [actors.revoked.session],
      )
      process.env.AUTH_JWT_SECRET = randomBytes(32).toString('hex')
      process.env.DATABASE_URL = runtimeUrl.toString()
      process.env.NODE_ENV = 'test'
      process.env.CORS_ORIGIN = 'http://localhost:5000'
      const { createApp } = await import('../src/app.js')
      const { signAccess } =
        await import('../src/features/auth/services/tokens.js')
      app = createApp(runtime)
      const csrf = await request(app).get('/api/auth/csrf')
      assert.equal(csrf.status, 200)
      csrfHeaders = {
        Origin: 'http://localhost:5000',
        Cookie: csrf.headers['set-cookie'][0].split(';')[0],
        'X-CSRF-Token': csrf.body.csrfToken,
      }
      for (const actor of Object.values(actors))
        actor.token = await signAccess(actor.id, actor.session)
      for (let i = 0; i < 25; i++)
        await db.query(
          'INSERT INTO private.client_evaluations(id,client_id,evaluation_date,created_at,weight_kg) VALUES($1,$2,$3,$4,70.1)',
          [
            `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
            actors.clientA.client,
            i < 15 ? '2026-10-01' : '2026-10-02',
            `2026-10-03T10:00:00.${String(i + 1).padStart(6, '0')}Z`,
          ],
        )
      // Same timestamp and day: UUID provides the final stable tie-break.
      await db.query(
        "INSERT INTO private.client_evaluations(id,client_id,evaluation_date,created_at,thigh_skinfold_mm) VALUES('20000000-0000-4000-8000-000000000001',$1,'2026-10-01','2026-10-03T10:00:00.000001Z',8.1)",
        [actors.clientA.client],
      )
    })
    after(async () => {
      await runtime?.end()
      await db?.end()
      try {
        await target(owner, 'postgres')
        if (dbOid !== undefined) {
          assert.match(name, /^cof_hu022_[0-9a-f]{20}$/)
          assert.equal(
            (
              await owner.query(
                'SELECT oid FROM pg_database WHERE datname=$1',
                [name],
              )
            ).rows[0]?.oid,
            dbOid,
          )
          await owner.query(`DROP DATABASE "${name}"`)
        }
      } finally {
        try {
          if (roleOid !== undefined) {
            assert.equal(
              (
                await owner.query('SELECT oid FROM pg_roles WHERE rolname=$1', [
                  name,
                ])
              ).rows[0]?.oid,
              roleOid,
            )
            await owner.query(`DROP ROLE "${name}"`)
          }
          assert.deepEqual(await globalState(), globals)
          assert.equal(
            (
              await owner.query('SELECT 1 FROM pg_database WHERE datname=$1', [
                name,
              ])
            ).rowCount,
            0,
          )
          assert.equal(
            (
              await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [
                name,
              ])
            ).rowCount,
            0,
          )
          console.log(`HU022_TEMPORARY_RESOURCES_REMOVED ${name}`)
        } finally {
          await owner.end()
        }
      }
    })
    const path = (id = actors.clientA.client) =>
      `/api/clients/${id}/evaluation-history`
    const get = (route = path(), actor = 'proA') =>
      request(app)
        .get(route)
        .set('Authorization', `Bearer ${actors[actor].token}`)
    async function asSubject(
      subject: string,
      work: (c: PoolClient) => Promise<unknown>,
    ) {
      const c = await runtime!.connect()
      try {
        await c.query('BEGIN')
        await c.query("SELECT set_config('app.subject_id',$1,true)", [subject])
        return await work(c)
      } finally {
        await c.query('ROLLBACK')
        c.release()
      }
    }
    const fingerprint = async () =>
      createHash('sha256')
        .update(
          JSON.stringify(
            (
              await db!.query(
                'SELECT to_jsonb(e) FROM private.client_evaluations e ORDER BY id',
              )
            ).rows,
          ),
        )
        .digest('hex')

    test('physical keyset reads >20 samples, repeated dates, timestamp microseconds and UUID ties without loss', async () => {
      let cursor: string | null = null
      const ids: string[] = []
      let pages = 0
      do {
        const r = await get(
          path() +
            '?pageSize=7' +
            (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
        )
        assert.equal(r.status, 200)
        assert.ok(
          r.body.samples.every((s: { createdAt: string }) =>
            /\.\d{6}Z$/.test(s.createdAt),
          ),
        )
        ids.push(...r.body.samples.map((s: { id: string }) => s.id))
        cursor = r.body.pageInfo.nextCursor
        pages++
      } while (cursor)
      assert.equal(ids.length, 26)
      assert.equal(new Set(ids).size, 26)
      assert.equal(pages, 4)
      const expected = (
        await db!.query(
          'SELECT id FROM private.client_evaluations WHERE client_id=$1 ORDER BY evaluation_date,created_at,id',
          [actors.clientA.client],
        )
      ).rows.map((r) => r.id)
      assert.deepEqual(ids, expected)
    })
    test('physical inclusive periods, invalid parameters, inherited origin and optional values', async () => {
      const r = await get(
        path() + '?from=2026-10-01&to=2026-10-01&pageSize=100',
      )
      assert.equal(r.status, 200)
      assert.equal(r.body.samples.length, 16)
      assert.ok(
        r.body.samples.every(
          (s: { date: string; method: unknown; dateBasis: string }) =>
            s.date === '2026-10-01' &&
            s.method === null &&
            s.dateBasis === 'legacy_evaluation_date',
        ),
      )
      const thigh = r.body.samples.find(
        (s: { measurements: Record<string, number> }) =>
          s.measurements.thighSkinfoldMm,
      )
      assert.equal(thigh.measurements.weightKg, undefined)
      assert.equal(thigh.measurements.thighSkinfoldMm, 8.1)
      assert.equal(r.body.metricDefinitions.thighSkinfoldMm.unit, 'mm')
      for (const q of [
        'from=2026-02-30',
        'from=2026-11-01&to=2026-10-01',
        'pageSize=101',
        'order=desc',
        'cursor=forged',
      ])
        assert.equal((await get(path() + '?' + q)).status, 400)
    })
    test('physical API and PostgreSQL deny unrelated professional, client, administrator and missing/revoked session', async () => {
      for (const [actor, status] of [
        ['proB', 404],
        ['clientA', 403],
        ['admin', 403],
        ['disabled', 403],
        ['revoked', 401],
      ] as const)
        assert.equal((await get(path(), actor)).status, status, actor)
      assert.equal((await request(app).get(path())).status, 401)
      const absent = await get(path(randomUUID()))
      const foreign = await get(path(), 'proB')
      assert.equal(absent.status, 404)
      assert.deepEqual(absent.body, foreign.body)
      for (const actor of ['proB', 'clientA', 'admin', 'disabled'])
        await asSubject(actors[actor].id, async (c) =>
          assert.equal(
            (
              await c.query(
                'SELECT id FROM private.client_evaluations WHERE client_id=$1',
                [actors.clientA.client],
              )
            ).rowCount,
            0,
          ),
        )
      await asSubject(actors.proA.id, async (c) =>
        assert.equal(
          (
            await c.query(
              'SELECT id FROM private.client_evaluations WHERE client_id=$1',
              [actors.clientA.client],
            )
          ).rowCount,
          26,
        ),
      )
      const grants = (
        await runtime!.query(
          "SELECT has_table_privilege(current_user,'private.client_evaluations','UPDATE') AS u,has_table_privilege(current_user,'private.client_evaluations','DELETE') AS d",
        )
      ).rows[0]
      assert.deepEqual(grants, { u: false, d: false })
    })
    test('physical cursor cannot cross client, professional, filters or be altered', async () => {
      const first = await get(path() + '?pageSize=2')
      assert.equal(first.status, 200)
      const cursor = first.body.pageInfo.nextCursor
      for (const route of [
        path(actors.clientB.client) + '?pageSize=2&cursor=' + cursor,
        path() + '?pageSize=2&method=legacy&cursor=' + cursor,
        path() + '?pageSize=2&cursor=' + cursor + 'x',
      ])
        assert.equal((await get(route)).status, 400)
      assert.equal(
        (await get(path() + '?pageSize=2&cursor=' + cursor, 'proB')).status,
        400,
      )
    })
    test('physical record available/empty/error and authorization propagation preserve HU-021', async () => {
      const route = `/api/clients/${actors.clientA.client}/record`
      let r = await get(route)
      assert.equal(r.status, 200)
      assert.equal(r.body.record.sections.progress.status, 'available')
      assert.equal(
        r.body.record.sections.bodyWeightHistory.status,
        'not_integrated',
      )
      r = await get(`/api/clients/${actors.clientB.client}/record`, 'proB')
      assert.equal(r.status, 200)
      assert.equal(r.body.record.sections.progress.status, 'empty')
      assert.equal((await get(route, 'proB')).status, 404)
      assert.equal((await get(route, 'clientA')).status, 403)
      // Damage is confined to the newly created disposable database; always restore.
      await db!.query(
        'ALTER TABLE private.client_evaluations RENAME TO hu022_temporarily_hidden',
      )
      try {
        r = await get(route)
        assert.equal(r.status, 200)
        assert.deepEqual(r.body.record.sections.progress, {
          status: 'error',
          code: 'QUERY_FAILED',
        })
        assert.equal((await get()).status, 503)
      } finally {
        await db!.query(
          'ALTER TABLE private.hu022_temporarily_hidden RENAME TO client_evaluations',
        )
      }
    })
    test('physical profile edit and inactive/reactivated record never change historical rows', async () => {
      const before = await fingerprint()
      for (const status of ['inactive', 'active']) {
        await db!.query(
          'UPDATE private.clients SET base_weight_kg=99.9,status=$2 WHERE id=$1',
          [actors.clientA.client, status],
        )
        assert.equal((await get()).status, 200)
        assert.equal(
          (await get(`/api/clients/${actors.clientA.client}/evaluations`))
            .status,
          200,
        )
        assert.equal(await fingerprint(), before)
      }
    })
    test('physical three-method HU-021 writes, invalid precision, server date, real history and idempotency', async () => {
      for (const [method, measurements] of [
        ['perimetros', { waistCm: 80.1 }],
        ['pliegues', { thighSkinfoldMm: 8.1 }],
        ['bioimpedancia', { weightKg: 80.1, measuredBodyFatPercentage: 25.1 }],
      ] as const) {
        const body = {
          method,
          equation: 'not_applicable',
          effectiveDate: '2026-09-01',
          measurements,
        }
        const key = randomUUID()
        const post = () =>
          request(app)
            .post(`/api/clients/${actors.clientA.client}/evaluations`)
            .set(csrfHeaders)
            .set('Authorization', `Bearer ${actors.proA.token}`)
            .set('Idempotency-Key', key)
            .send(body)
        const r = await post()
        assert.equal(r.status, 201, JSON.stringify(r.body))
        assert.equal((await post()).body.evaluation.id, r.body.evaluation.id)
        assert.equal(r.body.evaluation.assessment.effectiveDate, '2026-09-01')
        assert.ok(Number.isFinite(Date.parse(r.body.evaluation.createdAt)))
        const persisted = (
          await db!.query(
            "SELECT evaluation_date::text AS date,created_at,timezone('UTC',clock_timestamp())::date::text AS today FROM private.client_evaluations WHERE id=$1",
            [r.body.evaluation.id],
          )
        ).rows[0]
        assert.equal(r.body.evaluation.evaluationDate, persisted.date)
        assert.equal(persisted.date, persisted.today)
        assert.equal(
          r.body.evaluation.createdAt,
          persisted.created_at.toISOString(),
        )
        const filtered = await get(path() + '?method=' + method)
        assert.equal(filtered.status, 200)
        assert.equal(filtered.body.samples.length, 1)
        assert.deepEqual(filtered.body.samples[0].measurements, measurements)
      }
      const bad = await request(app)
        .post(`/api/clients/${actors.clientA.client}/evaluations`)
        .set(csrfHeaders)
        .set('Authorization', `Bearer ${actors.proA.token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ weightKg: 70.11 })
      assert.equal(bad.status, 400)
      assert.equal(
        (await get(path() + '?pageSize=100')).body.samples.length,
        29,
      )
    })
    test('physical CSRF rejects missing protection and inactive/foreign writes preserve all history', async () => {
      const endpoint = `/api/clients/${actors.clientA.client}/evaluations`
      const before = await fingerprint()
      const unprotected = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${actors.proA.token}`)
        .send({ weightKg: 70.1 })
      assert.equal(unprotected.status, 403)
      assert.equal(unprotected.body.error.code, 'CSRF_INVALID')
      const foreign = await request(app)
        .post(endpoint)
        .set(csrfHeaders)
        .set('Authorization', `Bearer ${actors.proB.token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ weightKg: 70.1 })
      assert.equal(foreign.status, 404)
      await db!.query(
        "UPDATE private.clients SET status='inactive' WHERE id=$1",
        [actors.clientA.client],
      )
      try {
        const denied = await request(app)
          .post(endpoint)
          .set(csrfHeaders)
          .set('Authorization', `Bearer ${actors.proA.token}`)
          .set('Idempotency-Key', randomUUID())
          .send({ weightKg: 70.1 })
        assert.equal(denied.status, 403)
      } finally {
        await db!.query(
          "UPDATE private.clients SET status='active' WHERE id=$1",
          [actors.clientA.client],
        )
      }
      assert.equal(await fingerprint(), before)
    })
  },
)

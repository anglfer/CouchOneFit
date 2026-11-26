import { Pool } from 'pg'
import { hash, argon2id } from 'argon2'
import { transaction } from '../src/features/auth/repositories/lifecycle.js'

// Additive synthetic fixture for the C-02 load scenario (SLA v3.0).
// Only against the local test database. Never updates or deletes rows and never
// prints credentials; username/password come from the environment.
async function main() {
  const value = process.env.TEST_DATABASE_URL
  if (!value || value !== process.env.DATABASE_URL) throw Error('target')
  const url = new URL(value)
  if (
    url.protocol !== 'postgresql:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/CouchOneFit_test' ||
    url.search ||
    url.hash
  )
    throw Error('target')
  const username = process.env.LOAD_FIXTURE_USERNAME
  const password = process.env.LOAD_FIXTURE_PASSWORD
  const clientCount = Number(process.env.LOAD_FIXTURE_CLIENTS ?? 16)
  if (
    !username ||
    !/^qa\.load\.[a-z0-9]{1,16}$/.test(username) ||
    !password ||
    [...password].length < 15 ||
    [...password].length > 128 ||
    !Number.isInteger(clientCount) ||
    clientCount < 1 ||
    clientCount > 50
  )
    throw Error('fixture input')
  const pool = new Pool({ connectionString: value })
  try {
    const server = (
      await pool.query('SELECT current_database() AS db')
    ).rows[0]
    if (server.db !== 'CouchOneFit_test') throw Error('identity')
    const digest = await hash(password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    })
    const fixture = await transaction(pool, async (client) => {
      const user = (
        await client.query(
          "INSERT INTO private.users(username,email,password_hash,role) VALUES($1,$2,$3,'professional') RETURNING id",
          [username, `${username}@example.com`, digest]
        )
      ).rows[0]
      const pro = (
        await client.query(
          "INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Carga QA profesional sintético') RETURNING id",
          [user.id]
        )
      ).rows[0]
      await client.query(
        "INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE name='Élite ilimitado'",
        [pro.id]
      )
      const clientIds: string[] = []
      for (let index = 1; index <= clientCount; index += 1) {
        const row = (
          await client.query(
            `INSERT INTO private.clients(professional_id,full_name,goal,birth_date,height_cm,base_weight_kg,base_body_fat_percentage,waist_cm,hip_cm)
             VALUES($1,$2,'Objetivo base carga','1990-06-15',170.5,70.2,20.2,80.2,NULL) RETURNING id`,
            [pro.id, `Carga QA ${username} ${index}`]
          )
        ).rows[0]
        clientIds.push(row.id)
      }
      return { professionalId: pro.id, clientIds }
    })
    console.log(JSON.stringify(fixture))
  } finally {
    await pool.end()
  }
}
main().catch(() => {
  console.error('Preparación de la carga detenida sin mostrar credenciales.')
  process.exitCode = 1
})

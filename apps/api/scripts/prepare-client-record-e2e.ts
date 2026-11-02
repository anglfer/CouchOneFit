import { Pool } from 'pg'
import { hash, argon2id } from 'argon2'
import { transaction } from '../src/features/auth/repositories/lifecycle.js'

// Additive synthetic preparation only. Never resets an existing fixture/password.
async function main() {
  const value = process.env.TEST_DATABASE_URL
  if (!value || value !== process.env.DATABASE_URL) throw Error('target')
  const url = new URL(value)
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || url.port !== '5432' || url.pathname !== '/CouchOneFit_test' || url.search || url.hash) throw Error('target')
  const username = process.env.QA_PROFESSIONAL_USERNAME
  const password = process.env.QA_PROFESSIONAL_PASSWORD
  if (!username || !/^qa\.hu020\.[a-z0-9]{1,16}$/.test(username) || !password || [...password].length < 15 || [...password].length > 128) throw Error('fixture input')
  const pool = new Pool({ connectionString: value })
  try {
    const server = (await pool.query('SELECT host(inet_server_addr()) AS host,inet_server_port() AS port,current_database() AS db')).rows[0]
    if (server.host !== '127.0.0.1' || server.port !== 5432 || server.db !== 'CouchOneFit_test') throw Error('identity')
    const digest = await hash(password, {type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1})
    const fixtures = await transaction(pool, async client => {
      // No ON CONFLICT, UPDATE or DELETE. Collision aborts the entire preparation.
      const user = (await client.query("INSERT INTO private.users(username,email,password_hash,role) VALUES($1,$2,$3,'professional') RETURNING id",[username,`${username}@example.com`,digest])).rows[0]
      const pro = (await client.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'HU020 QA profesional sintético') RETURNING id",[user.id])).rows[0]
      await client.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE name='Básico 10'",[pro.id])
      const records = []
      for (const suffix of ['A','B']) records.push((await client.query(`INSERT INTO private.clients(professional_id,full_name,goal,birth_date,height_cm,base_weight_kg,base_body_fat_percentage,waist_cm,hip_cm)
        VALUES($1,$2,$3,'1990-06-15',170.5,70.2,20.2,80.2,NULL) RETURNING id,full_name AS "fullName"`,[pro.id,`HU020 QA ${username} ${suffix}`,'Objetivo base HU020'])).rows[0])
      return { username, professionalId: pro.id, records }
    })
    console.log(JSON.stringify({target:'127.0.0.1:5432/CouchOneFit_test',fixtures,existingRowsUntouched:true}))
  } finally { await pool.end() }
}
main().catch(() => { console.error('Preparación HU020 detenida sin mostrar credenciales; no se restablecen ni borran filas.'); process.exitCode=1 })

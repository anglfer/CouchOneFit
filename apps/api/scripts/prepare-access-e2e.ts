import { argon2id, hash } from 'argon2'
import { Pool } from 'pg'
import { transaction } from '../src/features/auth/repositories/lifecycle.js'

const value = process.env.TEST_DATABASE_URL
if (
  !value ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname) ||
  !/^\/(CouchOneFit_test|cof_e2e_[a-z0-9_]+)$/.test(new URL(value).pathname)
) {
  throw new Error(
    'Usa TEST_DATABASE_URL local exclusiva CouchOneFit_test o cof_e2e_*. Nunca producción.'
  )
}
const username = process.env.QA_PROFESSIONAL_USERNAME ?? 'qa.lifecycle'
const password =
  process.env.QA_PROFESSIONAL_PASSWORD ?? 'ClaveLocalDePrueba2026'
if (
  !/^qa\.[a-z0-9._]{1,27}$/.test(username) ||
  [...password].length < 15 ||
  [...password].length > 128
)
  throw new Error(
    'Usa un usuario sintético qa.* y una clave de pruebas válida.'
  )
const pool = new Pool({ connectionString: value })
try {
  const digest = await hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
  await transaction(pool, async (client) => {
    const {
      rows: [existing],
    } = await client.query<{ id: string; role: string }>(
      'SELECT id,role FROM private.users WHERE username=$1 FOR UPDATE',
      [username]
    )
    if (existing) {
      const { rowCount } = await client.query(
        "SELECT id FROM private.professionals WHERE user_id=$1 AND full_name='Profesional QA local'",
        [existing.id]
      )
      if (existing.role !== 'professional' || rowCount !== 1)
        throw new Error('La identidad existente no es la fixture QA esperada.')
    }
    const {
      rows: [user],
    } = await client.query<{ id: string }>(
      `INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,'professional')
       ON CONFLICT (lower(btrim(username))) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`,
      [username, `${username}@example.com`, digest]
    )
    const {
      rows: [professional],
    } = await client.query<{ id: string }>(
      `INSERT INTO private.professionals (user_id,full_name) VALUES ($1,'Profesional QA local')
       ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name RETURNING id`,
      [user.id]
    )
    await client.query(
      `INSERT INTO private.subscriptions (professional_id,plan_id,status,expires_at) VALUES ($1,(SELECT id FROM private.saas_plans WHERE name='Básico 10'),'active',clock_timestamp()+interval '30 days')
      ON CONFLICT (professional_id) DO UPDATE SET status='active',expires_at=EXCLUDED.expires_at`,
      [professional.id]
    )
    await client.query(
      "INSERT INTO private.clients (professional_id,full_name,goal) VALUES ($1,'Cliente QA preparado','Prueba de vinculación local')",
      [professional.id]
    )
  })
  console.log(
    'Fixture sintética local lista para Web/Android. No se publicaron secretos ni se modificó un entorno remoto.'
  )
} finally {
  await pool.end()
}

import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import { hash, argon2id } from 'argon2'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL to the provisioning operator connection.')
const input = createInterface({ input: process.stdin, output: process.stdout, terminal: false })
const answers = input[Symbol.asyncIterator]()
let username: string | undefined
let email: string | undefined
try {
  process.stdout.write('Administrator username: ')
  username = (await answers.next()).value?.trim().toLowerCase()
  process.stdout.write('Administrator email: ')
  email = (await answers.next()).value?.trim().toLowerCase()
} finally {
  input.close()
}
if (!username || !/^[a-z0-9._]{3,30}$/.test(username)
  || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Enter a valid username (3–30 lowercase letters, numbers, dots, or underscores) and email.')
const password = randomBytes(32).toString('base64url')

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('couchonefit_seed_admin'))")
    await client.query('SET LOCAL ROLE couchone_provision')
    const digest = await hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 })
    await client.query(
      "INSERT INTO private.users (username,email,password_hash,role) VALUES ($1,$2,$3,'admin')",
      [username, email, digest],
    )
    await client.query('COMMIT')
    console.log(`\nAdministrator created without a professional profile.\nUsername: ${username}\nPassword: ${password}\nSave this password now; it is not stored or shown again.`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} catch (error) {
  // Never print SQL parameters or secret-bearing connections during provisioning failures.
  console.error(error instanceof Error && !('code' in error) ? error.message : 'Could not provision the administrator; check permissions, migrations, and identifiers.')
  process.exitCode = 1
} finally {
  await pool.end()
}

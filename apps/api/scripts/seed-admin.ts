import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import { hash, argon2id } from 'argon2'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL)
  throw new Error('Configura DATABASE_URL con la conexión del operador de provisión.')
const input = createInterface({ input: process.stdin, output: process.stdout, terminal: false })
const answers = input[Symbol.asyncIterator]()
let username: string | undefined
let email: string | undefined
try {
  process.stdout.write('Usuario del administrador: ')
  username = (await answers.next()).value?.trim().toLowerCase()
  process.stdout.write('Correo del administrador: ')
  email = (await answers.next()).value?.trim().toLowerCase()
} finally {
  input.close()
}
if (!username || !/^[a-z0-9._]{3,30}$/.test(username)
  || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  throw new Error('Revisa usuario (3–30 caracteres: letras, números, punto o guion bajo) y correo.')
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
      "INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ($1,$2,$3,'administrador')",
      [username, email, digest],
    )
    await client.query('COMMIT')
    console.log(`\nAdministrador creado sin perfil profesional.\nUsuario: ${username}\nContraseña: ${password}\nGuarda esta contraseña: no se guarda en archivos ni se vuelve a mostrar.`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} catch (error) {
  // No imprimir parámetros SQL ni conexiones con secretos en fallos de provisión.
  console.error(error instanceof Error && !('code' in error) ? error.message : 'No se pudo provisionar el administrador; revisa permisos, migraciones e identificadores.')
  process.exitCode = 1
} finally {
  await pool.end()
}

import 'dotenv/config'
import { createInterface } from 'node:readline'
import { Pool } from 'pg'
import { issueEmergencyReset } from '../src/features/auth/repositories/emergency-recovery.js'

if (!process.env.DATABASE_URL)
  throw new Error('Configura la conexión del custodio en DATABASE_URL.')
const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})
const answers = input[Symbol.asyncIterator]()
let username: string | undefined
let confirmed = false
try {
  process.stdout.write('Usuario del último administrador activo: ')
  username = (await answers.next()).value?.trim().toLowerCase()
  process.stdout.write(
    'Corrobora identidad fuera de banda por relación conocida. Escribe IDENTIDAD CORROBORADA para autorizar: '
  )
  confirmed = (await answers.next()).value === 'IDENTIDAD CORROBORADA'
} finally {
  input.close()
}
if (!username || !confirmed)
  throw new Error('Recuperación denegada sin corroboración del custodio.')
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
})
try {
  const result = await issueEmergencyReset(pool, username)
  // Intentional one-time manual delivery, never redirect this output to application logs.
  process.stdout.write(
    `Código de entrega privada: ${result.code}\nVence: ${result.expiresAt}\nLa persona elige su contraseña en /recuperar. No registres este código en bitácoras.\n`
  )
} catch {
  console.error(
    'No se autorizó la emergencia. Comprueba custodia, identidad, permisos y que sea el último administrador activo.'
  )
  process.exitCode = 1
} finally {
  await pool.end()
}

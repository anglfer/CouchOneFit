import 'dotenv/config'
import { Pool } from 'pg'
import {
  context,
  transaction,
} from '../src/features/auth/repositories/lifecycle.js'

if (!process.env.DATABASE_URL)
  throw new Error('Configura DATABASE_URL para el operador de limpieza.')
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
})
try {
  const counts = await transaction(pool, async (client) => {
    const invitations = await client.query<{ client_id: string }>(
      'SELECT client_id FROM private.invitations WHERE expires_at<=clock_timestamp()'
    )
    let removedInvitations = 0
    for (const item of invitations.rows) {
      await context(client, 'client_id', item.client_id)
      await client.query(
        'SELECT id FROM private.clients WHERE id=$1 FOR UPDATE',
        [item.client_id]
      )
      const result = await client.query(
        'DELETE FROM private.invitations WHERE client_id=$1 AND expires_at<=clock_timestamp()',
        [item.client_id]
      )
      removedInvitations += result.rowCount ?? 0
    }
    const resets = await client.query<{ user_id: string }>(
      'SELECT user_id FROM private.password_resets WHERE expires_at<=clock_timestamp()'
    )
    let removedResets = 0
    for (const item of resets.rows) {
      await context(client, 'subject_id', item.user_id)
      await client.query(
        'SELECT id FROM private.users WHERE id=$1 FOR UPDATE',
        [item.user_id]
      )
      const result = await client.query(
        'DELETE FROM private.password_resets WHERE user_id=$1 AND expires_at<=clock_timestamp()',
        [item.user_id]
      )
      removedResets += result.rowCount ?? 0
    }
    return { removedInvitations, removedResets }
  })
  console.log(counts)
} catch {
  console.error('No se pudo completar la limpieza de códigos.')
  process.exitCode = 1
} finally {
  await pool.end()
}

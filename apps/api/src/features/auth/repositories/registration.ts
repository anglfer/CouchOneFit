import type { Pool } from 'pg'
import { RegistrationError } from '../types/registration.js'
import type { Registration } from '../types/registration.js'

export async function insertProfessional(
  pool: Pool,
  data: Registration,
  passwordHash: string
): Promise<string> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (data.planInterestId) {
      const plan = await client.query(
        'SELECT id FROM private.saas_plans WHERE id=$1 AND is_active',
        [data.planInterestId]
      )
      if (!plan.rowCount)
        throw new RegistrationError(
          409,
          'PLAN_UNAVAILABLE',
          'El plan ya no está disponible. Elige otro plan o continúa sin selección.'
        )
    }
    const {
      rows: [account],
    } = await client.query<{ id: string }>(
      `INSERT INTO private.users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'professional') RETURNING id`,
      [data.username, data.email, passwordHash]
    )
    await client.query(
      'INSERT INTO private.professionals (user_id, full_name, phone, plan_interest, plan_interest_id) VALUES ($1, $2, $3, $4, $5)',
      [
        account.id,
        data.fullName,
        data.phone,
        data.planInterest,
        data.planInterestId ?? null,
      ]
    )
    await client.query(
      'INSERT INTO private.notice_acceptances (user_id, version) VALUES ($1, $2)',
      [account.id, data.noticeVersion]
    )
    await client.query('COMMIT')
    return account.id
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

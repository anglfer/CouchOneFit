import type { Pool } from 'pg'
import type { Registration } from '../types/registration.js'

export async function insertProfessional(
  pool: Pool,
  data: Registration,
  passwordHash: string,
): Promise<string> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [account],
    } = await client.query<{ id: string }>(
      `INSERT INTO private.users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'professional') RETURNING id`,
      [data.username, data.email, passwordHash],
    )
    await client.query(
      'INSERT INTO private.professionals (user_id, full_name, phone, plan_interest) VALUES ($1, $2, $3, $4)',
      [account.id, data.fullName, data.phone, data.planInterest],
    )
    await client.query(
      'INSERT INTO private.notice_acceptances (user_id, version) VALUES ($1, $2)',
      [account.id, data.noticeVersion],
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

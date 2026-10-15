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
      `INSERT INTO privado.usuarios (usuario, correo, hash_contrasena, rol)
       VALUES ($1, $2, $3, 'profesional') RETURNING id`,
      [data.usuario, data.correo, passwordHash],
    )
    await client.query(
      'INSERT INTO privado.profesionales (usuario_id, nombre_completo, telefono, plan_interes) VALUES ($1, $2, $3, $4)',
      [account.id, data.nombreCompleto, data.telefono, data.planInteres],
    )
    await client.query(
      'INSERT INTO privado.aceptaciones_avisos (usuario_id, version) VALUES ($1, $2)',
      [account.id, data.avisoVersion],
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

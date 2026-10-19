import { invalidLogin, invalidSession } from '../types/errors.js'
import type { Pool } from 'pg'
import type {
  LoginAccount,
  ProfessionalIdentity,
  SessionIdentity,
} from '../types/session.js'

export async function findLoginAccount(
  pool: Pool,
  identifier: string,
): Promise<LoginAccount | undefined> {
  const column = identifier.includes('@') ? 'correo' : 'usuario'
  const {
    rows: [row],
  } = await pool.query<LoginAccount>(
    `SELECT id,hash_contrasena AS "passwordHash",rol AS role,estado AS status FROM privado.usuarios WHERE lower(btrim(${column}))=$1`,
    [identifier],
  )
  return row
}
export async function currentSession(
  pool: Pool,
  id: string,
  sid: string,
): Promise<SessionIdentity | undefined> {
  const {
    rows: [row],
  } = await pool.query<SessionIdentity>(
    `SELECT a.id,a.usuario AS username,a.correo AS email,COALESCE(p.nombre_completo,a.usuario) AS "fullName",a.rol AS role,s.id AS "sessionId",s.expira_en AS "expiresAt"
     FROM privado.sesiones s JOIN privado.usuarios a ON a.id=s.usuario_id
     LEFT JOIN privado.profesionales p ON p.usuario_id=a.id
     WHERE s.id=$1 AND a.id=$2 AND (a.rol='administrador' OR (a.rol='profesional' AND p.id IS NOT NULL)) AND a.estado='activo'
       AND s.revocado_en IS NULL AND s.expira_en>clock_timestamp()`,
    [sid, id],
  )
  return row
}
export async function insertSession(
  pool: Pool,
  accountId: string,
  passwordHash: string,
  refreshHash: string,
  signAccess: (id: string, sid: string) => Promise<string>,
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [identity],
    } = await client.query<ProfessionalIdentity>(
      `SELECT a.id,a.usuario AS username,a.correo AS email,COALESCE(p.nombre_completo,a.usuario) AS "fullName",a.rol AS role FROM privado.usuarios a
       LEFT JOIN privado.profesionales p ON p.usuario_id=a.id
       WHERE a.id=$1 AND a.hash_contrasena=$2 AND (a.rol='administrador' OR (a.rol='profesional' AND p.id IS NOT NULL)) AND a.estado='activo'`,
      [accountId, passwordHash],
    )
    if (!identity) throw invalidLogin()
    const {
      rows: [session],
    } = await client.query<{ id: string; expiresAt: Date }>(
      'INSERT INTO privado.sesiones (usuario_id) VALUES ($1) RETURNING id,expira_en AS "expiresAt"',
      [accountId],
    )
    await client.query(
      'INSERT INTO privado.tokens_renovacion (hash_token,sesion_id) VALUES ($1,$2)',
      [refreshHash, session.id],
    )
    // Firmar antes del COMMIT conserva el rollback si falla la emisión.
    const access = await signAccess(accountId, session.id)
    await client.query('COMMIT')
    return {
      access,
      expiresAt: session.expiresAt,
      identity,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function rotateSession(
  pool: Pool,
  refreshHash: string,
  nextRefreshHash: string,
  signAccess: (id: string, sid: string) => Promise<string>,
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [row],
    } = await client.query<
      ProfessionalIdentity & {
        sessionId: string
        expiresAt: Date
        usedAt: Date | null
        revokedAt: Date | null
        valid: boolean
      }
    >(
      `SELECT a.id,a.usuario AS username,a.correo AS email,COALESCE(p.nombre_completo,a.usuario) AS "fullName",a.rol AS role,s.id AS "sessionId",s.expira_en AS "expiresAt",s.revocado_en AS "revokedAt",t.usado_en AS "usedAt",
       (s.expira_en>clock_timestamp() AND a.estado='activo' AND (a.rol='administrador' OR (a.rol='profesional' AND p.id IS NOT NULL))) AS valid
       FROM privado.tokens_renovacion t JOIN privado.sesiones s ON s.id=t.sesion_id
       JOIN privado.usuarios a ON a.id=s.usuario_id LEFT JOIN privado.profesionales p ON p.usuario_id=a.id
       WHERE t.hash_token=$1 FOR UPDATE OF s,t`,
      [refreshHash],
    )
    if (!row || row.revokedAt) throw invalidSession()
    if (row.usedAt || !row.valid) {
      await client.query(
        'UPDATE privado.sesiones SET revocado_en=clock_timestamp() WHERE id=$1',
        [row.sessionId],
      )
      await client.query('COMMIT')
      return null
    }
    await client.query(
      'UPDATE privado.tokens_renovacion SET usado_en=clock_timestamp() WHERE hash_token=$1',
      [refreshHash],
    )
    await client.query(
      'INSERT INTO privado.tokens_renovacion (hash_token,sesion_id) VALUES ($1,$2)',
      [nextRefreshHash, row.sessionId],
    )
    const access = await signAccess(row.id, row.sessionId)
    await client.query('COMMIT')
    return {
      access,
      expiresAt: row.expiresAt,
      identity: row,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function revokeSession(
  pool: Pool,
  sid: string,
  id: string,
): Promise<void> {
  await pool.query(
    'UPDATE privado.sesiones SET revocado_en=clock_timestamp() WHERE id=$1 AND usuario_id=$2 AND revocado_en IS NULL',
    [sid, id],
  )
}

export async function revokeRefreshSession(
  pool: Pool,
  refreshHash: string,
): Promise<void> {
  await pool.query(
    `UPDATE privado.sesiones SET revocado_en=clock_timestamp()
      WHERE id=(SELECT sesion_id FROM privado.tokens_renovacion WHERE hash_token=$1) AND revocado_en IS NULL`,
    [refreshHash],
  )
}

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
  const column = identifier.includes('@') ? 'email' : 'username'
  const {
    rows: [row],
  } = await pool.query<LoginAccount>(
    `SELECT id,password_hash AS "passwordHash",role,status FROM private.users WHERE lower(btrim(${column}))=$1`,
    [identifier],
  )
  return row
}
export async function currentSession(
  pool: Pool,
  id: string,
  sid: string,
  surface: 'web' | 'any' = 'web',
): Promise<SessionIdentity | undefined> {
  const {
    rows: [row],
  } = await pool.query<SessionIdentity>(
    `SELECT a.id,a.username,a.email,
            COALESCE(p.full_name,c.full_name,a.username) AS "fullName",
            a.role,c.id AS "clientId",c.status AS "clientStatus",
            s.id AS "sessionId",s.expires_at AS "expiresAt"
     FROM private.sessions s JOIN private.users a ON a.id=s.user_id
     LEFT JOIN private.professionals p ON p.user_id=a.id
     LEFT JOIN private.clients c ON c.user_id=a.id
     WHERE s.id=$1 AND a.id=$2
       AND (
         a.role='admin'
         OR (a.role='professional' AND p.id IS NOT NULL)
         OR ($3='any' AND a.role='client' AND c.id IS NOT NULL)
       )
       AND a.status='active'
       AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()`,
    [sid, id, surface],
  )
  return row
}
export async function insertSession(
  pool: Pool,
  userId: string,
  passwordHash: string,
  refreshHash: string,
  signAccess: (id: string, sid: string) => Promise<string>,
  surface: 'web' | 'client' = 'web',
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [identity],
    } = await client.query<ProfessionalIdentity>(
      `SELECT a.id,a.username,a.email,
              COALESCE(p.full_name,c.full_name,a.username) AS "fullName",
              a.role,c.id AS "clientId",c.status AS "clientStatus"
       FROM private.users a
       LEFT JOIN private.professionals p ON p.user_id=a.id
       LEFT JOIN private.clients c ON c.user_id=a.id
       WHERE a.id=$1 AND a.password_hash=$2
         AND (
           ($3='web' AND (a.role='admin' OR (a.role='professional' AND p.id IS NOT NULL)))
           OR ($3='client' AND a.role='client' AND c.id IS NOT NULL)
         )
         AND a.status='active'`,
      [userId, passwordHash, surface],
    )
    if (!identity) throw invalidLogin()
    const {
      rows: [session],
    } = await client.query<{ id: string; expiresAt: Date }>(
      'INSERT INTO private.sessions (user_id) VALUES ($1) RETURNING id,expires_at AS "expiresAt"',
      [userId],
    )
    await client.query(
      'INSERT INTO private.refresh_tokens (token_hash,session_id) VALUES ($1,$2)',
      [refreshHash, session.id],
    )
    // Signing before COMMIT keeps the transaction reversible if signing fails.
    const access = await signAccess(userId, session.id)
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
  surface: 'web' | 'client' = 'web',
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
      `SELECT a.id,a.username,a.email,
              COALESCE(p.full_name,c.full_name,a.username) AS "fullName",
              a.role,c.id AS "clientId",c.status AS "clientStatus",
              s.id AS "sessionId",s.expires_at AS "expiresAt",s.revoked_at AS "revokedAt",t.used_at AS "usedAt",
       (s.expires_at>clock_timestamp() AND a.status='active' AND (
         ($2='web' AND (a.role='admin' OR (a.role='professional' AND p.id IS NOT NULL)))
         OR ($2='client' AND a.role='client' AND c.id IS NOT NULL)
       )) AS valid
       FROM private.refresh_tokens t JOIN private.sessions s ON s.id=t.session_id
       JOIN private.users a ON a.id=s.user_id
       LEFT JOIN private.professionals p ON p.user_id=a.id
       LEFT JOIN private.clients c ON c.user_id=a.id
       WHERE t.token_hash=$1 FOR UPDATE OF s,t`,
      [refreshHash, surface],
    )
    if (!row || row.revokedAt) throw invalidSession()
    if (row.usedAt || !row.valid) {
      await client.query(
        'UPDATE private.sessions SET revoked_at=clock_timestamp() WHERE id=$1',
        [row.sessionId],
      )
      await client.query('COMMIT')
      return null
    }
    await client.query(
      'UPDATE private.refresh_tokens SET used_at=clock_timestamp() WHERE token_hash=$1',
      [refreshHash],
    )
    await client.query(
      'INSERT INTO private.refresh_tokens (token_hash,session_id) VALUES ($1,$2)',
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
    'UPDATE private.sessions SET revoked_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',
    [sid, id],
  )
}

export async function revokeRefreshSession(
  pool: Pool,
  refreshHash: string,
): Promise<void> {
  await pool.query(
    `UPDATE private.sessions SET revoked_at=clock_timestamp()
      WHERE id=(SELECT session_id FROM private.refresh_tokens WHERE token_hash=$1) AND revoked_at IS NULL`,
    [refreshHash],
  )
}

import type { Pool } from 'pg'
import { AuthError, invalidLogin, invalidSession } from '../types/errors.js'
import type { SignAccessOptions } from '../services/tokens.js'
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
  now?: Date,
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
       AND s.revoked_at IS NULL
       AND s.expires_at>COALESCE($4::timestamptz,clock_timestamp())`,
    [sid, id, surface, now ?? null],
  )
  return row
}
export async function insertSession(
  pool: Pool,
  userId: string,
  passwordHash: string,
  refreshHash: string,
  signAccess: (
    id: string,
    sid: string,
    options?: SignAccessOptions,
  ) => Promise<string>,
  surface: 'web' | 'client' = 'web',
  now?: Date,
) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.subject_id',$1,true)", [userId])
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
         AND a.status='active' FOR SHARE OF a`,
      [userId, passwordHash, surface],
    )
    if (!identity) throw invalidLogin()
    const {
      rows: [session],
    } = await client.query<{ id: string; expiresAt: Date }>(
      `INSERT INTO private.sessions (user_id,created_at,expires_at)
       VALUES ($1,COALESCE($2::timestamptz,now()),COALESCE($2::timestamptz,now())+interval '30 days')
       RETURNING id,expires_at AS "expiresAt"`,
      [userId, now ?? null],
    )
    await client.query(
      `INSERT INTO private.refresh_tokens (token_hash,session_id,created_at)
       VALUES ($1,$2,COALESCE($3::timestamptz,now()))`,
      [refreshHash, session.id, now ?? null],
    )
    // Signing before COMMIT keeps the transaction reversible if signing fails.
    const access = await signAccess(userId, session.id, {
      now,
      sessionExpiresAt: session.expiresAt,
    })
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
  signAccess: (
    id: string,
    sid: string,
    options?: SignAccessOptions,
  ) => Promise<string>,
  surface: 'web' | 'client' = 'web',
  now?: Date,
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
       (s.expires_at>COALESCE($3::timestamptz,clock_timestamp()) AND a.status='active' AND (
         ($2='web' AND (a.role='admin' OR (a.role='professional' AND p.id IS NOT NULL)))
         OR ($2='client' AND a.role='client' AND c.id IS NOT NULL)
       )) AS valid
       FROM private.refresh_tokens t JOIN private.sessions s ON s.id=t.session_id
       JOIN private.users a ON a.id=s.user_id
       LEFT JOIN private.professionals p ON p.user_id=a.id
       LEFT JOIN private.clients c ON c.user_id=a.id
       WHERE t.token_hash=$1 FOR UPDATE OF s,t`,
      [refreshHash, surface, now ?? null],
    )
    if (!row || row.revokedAt) throw invalidSession()
    if (row.usedAt || !row.valid) {
      await client.query(
        'UPDATE private.sessions SET revoked_at=COALESCE($2::timestamptz,clock_timestamp()) WHERE id=$1 AND revoked_at IS NULL',
        [row.sessionId, now ?? null],
      )
      await client.query(
        'UPDATE private.refresh_tokens SET used_at=COALESCE($2::timestamptz,clock_timestamp()) WHERE session_id=$1 AND used_at IS NULL',
        [row.sessionId, now ?? null],
      )
      await client.query('COMMIT')
      return null
    }
    await client.query(
      'UPDATE private.refresh_tokens SET used_at=COALESCE($2::timestamptz,clock_timestamp()) WHERE token_hash=$1',
      [refreshHash, now ?? null],
    )
    await client.query(
      'INSERT INTO private.refresh_tokens (token_hash,session_id,created_at) VALUES ($1,$2,COALESCE($3::timestamptz,now()))',
      [nextRefreshHash, row.sessionId, now ?? null],
    )
    const access = await signAccess(row.id, row.sessionId, {
      now,
      sessionExpiresAt: row.expiresAt,
    })
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
  now?: Date,
): Promise<void> {
  await pool.query(
    `WITH revoked AS (
       UPDATE private.sessions s
          SET revoked_at=COALESCE($3::timestamptz,clock_timestamp())
        WHERE s.user_id=$2
          AND s.revoked_at IS NULL
          AND (
            s.id=$1
            OR EXISTS (
              SELECT 1 FROM private.users u
               WHERE u.id=s.user_id AND u.status<>'active'
            )
          )
       RETURNING s.id
     )
     UPDATE private.refresh_tokens
        SET used_at=COALESCE($3::timestamptz,clock_timestamp())
      WHERE session_id IN (SELECT id FROM revoked)
        AND used_at IS NULL`,
    [sid, id, now ?? null],
  )
}

export async function revokeRefreshSession(
  pool: Pool,
  refreshHash: string,
  now?: Date,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `WITH target AS (
       SELECT session_id FROM private.refresh_tokens WHERE token_hash=$1
     ),
     revoked_session AS (
       UPDATE private.sessions
          SET revoked_at=COALESCE(revoked_at,COALESCE($2::timestamptz,clock_timestamp()))
        WHERE id IN (SELECT session_id FROM target)
       RETURNING id
     ),
     consumed_tokens AS (
       UPDATE private.refresh_tokens
          SET used_at=COALESCE(used_at,COALESCE($2::timestamptz,clock_timestamp()))
        WHERE session_id IN (SELECT session_id FROM target)
          AND (token_hash=$1 OR used_at IS NULL)
       RETURNING id
     )
     SELECT id FROM revoked_session`,
    [refreshHash, now ?? null],
  )
  return (rowCount ?? 0) > 0
}

export async function revokeUserSessions(
  pool: Pool,
  userId: string,
  now?: Date,
): Promise<number> {
  const { rowCount } = await pool.query(
    `WITH revoked AS (
       UPDATE private.sessions
          SET revoked_at=COALESCE($2::timestamptz,clock_timestamp())
        WHERE user_id=$1 AND revoked_at IS NULL
       RETURNING id
     ),
     consumed AS (
       UPDATE private.refresh_tokens
          SET used_at=COALESCE($2::timestamptz,clock_timestamp())
        WHERE session_id IN (SELECT id FROM private.sessions WHERE user_id=$1)
          AND used_at IS NULL
       RETURNING id
     )
     SELECT id FROM revoked`,
    [userId, now ?? null],
  )
  return rowCount ?? 0
}

export async function updateAccountStatus(
  pool: Pool,
  userId: string,
  status: 'active' | 'inactive',
  now?: Date,
): Promise<{
  id: string
  role: 'professional' | 'client' | 'admin'
  status: 'active' | 'inactive'
  revokedSessions: number
}> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      rows: [user],
    } = await client.query<{
      id: string
      role: 'professional' | 'client' | 'admin'
      status: 'active' | 'inactive'
    }>('SELECT id,role,status FROM private.users WHERE id=$1 FOR UPDATE', [
      userId,
    ])
    if (!user) {
      throw new AuthError(
        404,
        'ACCOUNT_NOT_FOUND',
        'La cuenta solicitada no existe.',
      )
    }
    if (
      status === 'inactive' &&
      user.role === 'admin' &&
      user.status === 'active'
    ) {
      const { rows: activeAdmins } = await client.query<{ id: string }>(
        "SELECT id FROM private.users WHERE role='admin' AND status='active' FOR UPDATE",
      )
      if (activeAdmins.length <= 1) {
        throw new AuthError(
          409,
          'LAST_ADMIN_PROTECTED',
          'No se puede desactivar la última cuenta administradora activa.',
        )
      }
    }
    await client.query('UPDATE private.users SET status=$2 WHERE id=$1', [
      userId,
      status,
    ])
    // DEC-004: account state never allocates or releases an operational place.
    let revokedSessions = 0
    if (status === 'inactive') {
      const { rowCount } = await client.query(
        `WITH revoked AS (
           UPDATE private.sessions
              SET revoked_at=COALESCE($2::timestamptz,clock_timestamp())
            WHERE user_id=$1 AND revoked_at IS NULL
           RETURNING id
         ),
         consumed AS (
           UPDATE private.refresh_tokens
              SET used_at=COALESCE($2::timestamptz,clock_timestamp())
            WHERE session_id IN (SELECT id FROM private.sessions WHERE user_id=$1)
              AND used_at IS NULL
           RETURNING id
         )
         SELECT id FROM revoked`,
        [userId, now ?? null],
      )
      revokedSessions = rowCount ?? 0
    }
    await client.query('COMMIT')
    return {
      id: user.id,
      role: user.role,
      status,
      revokedSessions,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

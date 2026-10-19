import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'

export async function professionalProfile(
  pool: Pool,
  identity: SessionIdentity,
) {
  const {
    rows: [profile],
  } = await pool.query(
    `SELECT p.id,p.user_id AS "userId",p.full_name AS "fullName",p.phone,a.username,a.email
     FROM private.professionals p JOIN private.users a ON a.id=p.user_id
     JOIN private.sessions s ON s.user_id=a.id
     WHERE p.user_id=$1 AND s.id=$2 AND a.role='professional' AND a.status='active'
       AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()`,
    [identity.id, identity.sessionId],
  )
  return profile
}

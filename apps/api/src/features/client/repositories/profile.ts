import type { Pool } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';

export async function clientProfile(pool: Pool, identity: SessionIdentity) {
  const {
    rows: [profile],
  } = await pool.query(
    `SELECT c.id,
            c.user_id AS "userId",
            c.professional_id AS "professionalId",
            c.full_name AS "fullName",
            c.goal,
            c.status,
            a.username,
            a.email
       FROM private.clients c
       JOIN private.users a ON a.id = c.user_id
       JOIN private.sessions s ON s.user_id = a.id
      WHERE c.user_id = $1
        AND s.id = $2
        AND a.role = 'client'
        AND a.status = 'active'
        AND s.revoked_at IS NULL
        AND s.expires_at > clock_timestamp()`,
    [identity.id, identity.sessionId]
  );
  return profile;
}

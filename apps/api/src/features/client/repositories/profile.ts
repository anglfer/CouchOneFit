import type { Pool } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';
import { readAsSubject } from '../../auth/repositories/lifecycle.js';

export async function clientProfile(pool: Pool, identity: SessionIdentity, base = false) {
  const {
    rows: [profile],
  } = await readAsSubject(pool, identity.id, (client) => client.query(
    `SELECT c.id,
            c.user_id AS "userId",
            c.professional_id AS "professionalId",
            c.full_name AS "fullName",
            c.goal,
            c.status,
            ${base ? `c.birth_date::text AS "birthDate",
            c.height_cm::float8 AS "heightCm",
            c.base_weight_kg::float8 AS "baseWeightKg",
            c.base_body_fat_percentage::float8 AS "baseBodyFatPercentage",
            c.waist_cm::float8 AS "waistCm",
            c.hip_cm::float8 AS "hipCm",` : ''}
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
  ));
  return profile;
}

export async function clientRecord(pool: Pool, identity: SessionIdentity) {
  const profile = await clientProfile(pool, identity, true);
  if (!profile) return undefined;
  // The account and professional identifiers are not needed by this read model.
  const { userId: _userId, professionalId: _professionalId, ...record } = profile;
  return record;
}

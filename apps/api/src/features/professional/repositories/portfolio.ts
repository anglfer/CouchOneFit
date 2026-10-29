import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { readAsSubject } from '../../auth/repositories/lifecycle.js'
import type { PortfolioQuery } from '../validators/portfolio.js'

// The server owns identity, order and projections. No query-provided owner.
const scope = `FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
  JOIN private.subscriptions s ON s.professional_id=p.id AND s.status='active'
    AND s.expires_at>COALESCE($2::timestamptz,clock_timestamp())
  WHERE p.user_id=$1`

export async function portfolioPage(
  pool: Pool,
  identity: SessionIdentity,
  query: PortfolioQuery,
  now?: Date
) {
  return readAsSubject(pool, identity.id, async (client) => {
    const {
      rows: [result]
    } = await client.query(
      `WITH page AS (
      SELECT c.id,c.user_id AS "userId",c.full_name AS "fullName",c.goal,c.status,c.created_at,
        c.created_at::text AS "cursorCreatedAt",
        (SELECT expires_at FROM private.invitations i WHERE i.client_id=c.id) AS "invitationExpiresAt"
      ${scope} AND ($3='' OR position(lower($3) in lower(c.full_name))>0)
        AND ($4='' OR c.status=$4)
        AND ($5::timestamptz IS NULL OR (c.created_at,c.id)<($5::timestamptz,$6::uuid))
      ORDER BY c.created_at DESC,c.id DESC LIMIT $7
    ) SELECT EXISTS(SELECT 1 ${scope}) AS "hasClients",
      COALESCE((SELECT json_agg(row_to_json(item) ORDER BY created_at DESC,id DESC) FROM page item),'[]') AS clients`,
      [
        identity.id,
        now ?? null,
        query.search,
        query.status,
        query.after?.createdAt ?? null,
        query.after?.id ?? null,
        query.pageSize + 1
      ]
    )
    return result as {
      hasClients: boolean
      clients: Array<
        Record<string, unknown> & { id: string; cursorCreatedAt: string }
      >
    }
  })
}

export async function portfolioRecord(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  now?: Date
) {
  return readAsSubject(pool, identity.id, async (client) => {
    const { rows } = await client.query(
      `SELECT c.id,c.full_name AS "fullName",c.goal,c.status,
      c.birth_date::text AS "birthDate",c.height_cm::float8 AS "heightCm",c.base_weight_kg::float8 AS "baseWeightKg",
      c.base_body_fat_percentage::float8 AS "baseBodyFatPercentage",c.waist_cm::float8 AS "waistCm",c.hip_cm::float8 AS "hipCm"
      ${scope} AND c.id=$3`,
      [identity.id, now ?? null, id]
    )
    return rows[0]
  })
}

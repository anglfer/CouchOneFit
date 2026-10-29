import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { readAsSubject } from '../../auth/repositories/lifecycle.js'

import type { directoryInput } from '../../saas/validators/subscription.js'

export async function professionalDirectory(
  pool: Pool,
  identity: SessionIdentity,
  data: ReturnType<typeof directoryInput>,
  now?: Date
) {
  const { page, pageSize, search, status } = data
  const result = await readAsSubject(pool, identity.id, (client) => client.query(
    `WITH directory AS (
    SELECT p.id,p.full_name AS "fullName",u.email,u.status AS "accountStatus",s.plan_id AS "planId",sp.name AS "planName",
      sp.max_clients AS "limit",COALESCE(sp.is_unlimited,false) AS "isUnlimited",
      CASE WHEN s.id IS NULL THEN 'none' WHEN s.expires_at<=COALESCE($1::timestamptz,clock_timestamp()) THEN 'expired' ELSE s.status END AS "subscriptionStatus",
      s.expires_at AS "expiresAt",COALESCE(cc.active_count,0) AS "clientsUsed",
      COALESCE(cc.inactive_count,0) AS "inactiveClients"
    FROM private.professionals p JOIN private.users u ON u.id=p.user_id LEFT JOIN private.subscriptions s ON s.professional_id=p.id LEFT JOIN private.saas_plans sp ON sp.id=s.plan_id
    LEFT JOIN private.admin_client_counts() cc ON cc.professional_id=p.id
  ), filtered AS (SELECT * FROM directory WHERE ($2='' OR position(lower($2) in lower("fullName"||' '||email))>0) AND ($3='' OR "subscriptionStatus"=$3))
  SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT json_agg(row_to_json(item)) FROM (SELECT * FROM filtered ORDER BY id LIMIT $4 OFFSET $5) item),'[]'::json) AS professionals`,
    [now ?? null, search, status, pageSize, (page - 1) * pageSize]
  ))
  return { ...result.rows[0], page, pageSize }
}

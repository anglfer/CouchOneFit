import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
export interface SubscriptionDetails {
  planId: string | null
  status: 'active' | 'suspended' | 'expired' | 'none'
  planName: string | null
  limit: number | null
  isUnlimited: boolean
  used: number
  remaining: number | null
  excess: number
  expiresAt: Date | null
}
export async function professionalSubscription(
  pool: Pool,
  identity: SessionIdentity,
  now?: Date
): Promise<SubscriptionDetails> {
  const {
    rows: [row],
  } = await pool.query(
    `SELECT s.plan_id AS "planId",sp.name AS "planName",sp.max_clients AS "limit",COALESCE(sp.is_unlimited,false) AS "isUnlimited",s.expires_at AS "expiresAt",
    CASE WHEN s.id IS NULL THEN 'none' WHEN s.expires_at<=COALESCE($2::timestamptz,clock_timestamp()) THEN 'expired' ELSE s.status END AS status,
    (SELECT count(*)::int FROM private.clients c WHERE c.professional_id=p.id AND c.status='active') AS used
    FROM private.professionals p LEFT JOIN private.subscriptions s ON s.professional_id=p.id LEFT JOIN private.saas_plans sp ON sp.id=s.plan_id WHERE p.user_id=$1`,
    [identity.id, now ?? null]
  )
  if (!row || row.status === 'none')
    return {
      planId: null,
      status: 'none',
      planName: null,
      limit: 0,
      isUnlimited: false,
      used: row?.used ?? 0,
      remaining: 0,
      excess: row?.used ?? 0,
      expiresAt: null,
    }
  return {
    ...row,
    remaining:
      row.status !== 'active'
        ? 0
        : row.isUnlimited
          ? null
          : Math.max(0, row.limit - row.used),
    excess: row.isUnlimited ? 0 : Math.max(0, row.used - row.limit),
  }
}

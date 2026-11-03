import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { readAsSubject } from '../../auth/repositories/lifecycle.js'
export interface SubscriptionDetails {
  planId: string | null
  status: 'active' | 'grace' | 'suspended' | 'expired' | 'none'
  cancelAtPeriodEnd: boolean
  graceUntil: Date | null
  renewalMethod: 'test_approved' | 'test_declined' | 'test_error' | null
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
  } = await readAsSubject(pool, identity.id, async (client) => {
    // DEC-017: lazy simulated renewal before reading the state.
    await client.query('SELECT private.renew_subscription($1)', [now ?? null])
    return client.query(
    `SELECT s.plan_id AS "planId",sp.name AS "planName",sp.max_clients AS "limit",COALESCE(sp.is_unlimited,false) AS "isUnlimited",s.expires_at AS "expiresAt",
    s.cancel_at_period_end AS "cancelAtPeriodEnd",s.grace_until AS "graceUntil",s.renewal_method AS "renewalMethod",
    CASE WHEN s.id IS NULL THEN 'none' WHEN COALESCE(s.grace_until,s.expires_at)<=COALESCE($2::timestamptz,clock_timestamp()) THEN 'expired'
      WHEN s.expires_at<=COALESCE($2::timestamptz,clock_timestamp()) THEN 'grace' ELSE s.status END AS status,
    (SELECT count(*)::int FROM private.clients c WHERE c.professional_id=p.id AND c.status='active') AS used
    FROM private.professionals p LEFT JOIN private.subscriptions s ON s.professional_id=p.id LEFT JOIN private.saas_plans sp ON sp.id=s.plan_id WHERE p.user_id=$1`,
    [identity.id, now ?? null]
  )})
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
      cancelAtPeriodEnd: false,
      graceUntil: null,
      renewalMethod: null,
    }
  return {
    ...row,
    remaining:
      row.status !== 'active' && row.status !== 'grace'
        ? 0
        : row.isUnlimited
          ? null
          : Math.max(0, row.limit - row.used),
    excess: row.isUnlimited ? 0 : Math.max(0, row.used - row.limit),
  }
}

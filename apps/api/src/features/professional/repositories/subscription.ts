import type { Pool } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';

export interface SubscriptionDetails {
  status: 'active' | 'suspended' | 'none';
  planName: string | null;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export async function professionalSubscription(
  pool: Pool,
  identity: SessionIdentity
): Promise<SubscriptionDetails> {
  const { rows: [sub] } = await pool.query(
    `SELECT s.status, p_saas.name AS "planName", p_saas.max_clients AS "limit"
     FROM private.professionals p
     LEFT JOIN private.subscriptions s ON s.professional_id = p.id
     LEFT JOIN private.saas_plans p_saas ON p_saas.id = s.plan_id
     WHERE p.user_id = $1`,
    [identity.id]
  );

  if (!sub || !sub.status) {
    return { status: 'none', planName: null, limit: null, used: 0, remaining: null };
  }

  const { rows: [countRes] } = await pool.query(
    `SELECT count(*)::int AS used
     FROM private.clients c
     JOIN private.professionals p ON p.id = c.professional_id
     WHERE p.user_id = $1 AND c.status = 'active'`,
    [identity.id]
  );

  const used = countRes?.used ?? 0;
  const limit = sub.limit; // null significa ilimitado
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return {
    status: sub.status,
    planName: sub.planName,
    limit,
    used,
    remaining,
  };
}
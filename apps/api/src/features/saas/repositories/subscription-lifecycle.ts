import type { Pool } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import { audit, lockActor, transaction } from '../../auth/repositories/lifecycle.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import { lockProfessional } from './capacity.js'

const DB_ERRORS: Record<string, [number, string, string]> = {
  PLAN_REQUIRED: [403, 'PLAN_REQUIRED', 'Se requiere un plan vigente.'],
  PLAN_UNAVAILABLE: [404, 'PLAN_UNAVAILABLE', 'El plan no está disponible.'],
  DOWNGRADE_NOT_LOWER: [
    409,
    'DOWNGRADE_NOT_LOWER',
    'Elige un plan con menor capacidad que el vigente.',
  ],
  DOWNGRADE_EXCESS: [
    409,
    'DOWNGRADE_EXCESS',
    'Inactiva clientes hasta quedar dentro del límite del nuevo plan.',
  ],
}
function mapDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : ''
  const known = DB_ERRORS[message]
  if (known) throw new AuthError(known[0], known[1], known[2])
  throw error
}

// DEC-017: cancel at the end of the paid period and/or choose the simulated renewal method.
export async function writeSubscriptionPreferences(
  pool: Pool,
  identity: SessionIdentity,
  input: { cancelAtPeriodEnd?: boolean; renewalMethod?: string },
  now?: Date
) {
  return transaction(pool, async (client) => {
    await lockActor(client, identity, now, true)
    try {
      await client.query(
        'SELECT private.set_subscription_preferences($1,$2,$3)',
        [input.cancelAtPeriodEnd ?? null, input.renewalMethod ?? null, now ?? null]
      )
    } catch (error) {
      mapDbError(error)
    }
  })
}

// DEC-017: downgrade choosing which active records to inactivate. One transaction:
// records are inactivated (versioned + audited) and the plan changes, or nothing does.
export async function writeDowngrade(
  pool: Pool,
  identity: SessionIdentity,
  input: { planId: string; inactivateClientIds: string[] },
  now?: Date
) {
  return transaction(pool, async (client) => {
    await lockActor(client, identity, now, true)
    const {
      rows: [professional],
    } = await client.query<{ id: string }>(
      'SELECT id FROM private.professionals WHERE user_id=$1',
      [identity.id]
    )
    if (!professional)
      throw new AuthError(404, 'NOT_FOUND', 'El profesional no existe.')
    await lockProfessional(client, professional.id)
    if (input.inactivateClientIds.length) {
      const { rows } = await client.query<{ id: string; userId: string | null }>(
        `UPDATE private.clients SET status='inactive'
          WHERE id=ANY($1::uuid[]) AND professional_id=$2 AND status='active'
          RETURNING id,user_id AS "userId"`,
        [input.inactivateClientIds, professional.id]
      )
      if (rows.length !== input.inactivateClientIds.length)
        throw new AuthError(
          409,
          'CLIENT_NOT_ACTIVE',
          'Algún expediente elegido no existe o ya está inactivo.'
        )
      for (const row of rows)
        await audit(
          client,
          'client_record_inactivated',
          identity.id,
          row.userId,
          row.id,
          now
        )
    }
    try {
      await client.query('SELECT private.apply_plan_downgrade($1,$2)', [
        input.planId,
        now ?? null,
      ])
    } catch (error) {
      mapDbError(error)
    }
  })
}

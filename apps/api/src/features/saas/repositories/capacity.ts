import type { Pool, PoolClient } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import { lockActor, transaction } from '../../auth/repositories/lifecycle.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import type { ClientInitialRecordInput } from '../services/clients.js'

export async function lockProfessional(
  client: PoolClient,
  professionalId: string
) {
  const result = await client.query(
    'SELECT id FROM private.professionals WHERE id=$1 FOR UPDATE',
    [professionalId]
  )
  if (!result.rowCount)
    throw new AuthError(404, 'NOT_FOUND', 'El profesional no existe.')
}
export async function requireCapacity(
  client: PoolClient,
  professionalId: string,
  consume: boolean,
  now?: Date
) {
  const {
    rows: [subscription],
  } = await client.query(
    `SELECT s.status,s.expires_at,p.max_clients FROM private.subscriptions s JOIN private.saas_plans p ON p.id=s.plan_id WHERE s.professional_id=$1`,
    [professionalId]
  )
  if (!subscription)
    throw new AuthError(403, 'PLAN_REQUIRED', 'Se requiere un plan asignado.')
  const {
    rows: [time],
  } = await client.query(
    'SELECT COALESCE($1::timestamptz,clock_timestamp()) AS now',
    [now ?? null]
  )
  if (subscription.status !== 'active' || subscription.expires_at <= time.now)
    throw new AuthError(
      403,
      'SUBSCRIPTION_SUSPENDED',
      'La suscripción no está vigente.'
    )
  if (consume && subscription.max_clients !== null) {
    const {
      rows: [usage],
    } = await client.query(
      "SELECT count(*)::int AS used FROM private.clients WHERE professional_id=$1 AND status='active'",
      [professionalId]
    )
    if (usage.used >= subscription.max_clients)
      throw new AuthError(
        409,
        'CUPO_AGOTADO',
        'Has alcanzado el límite de clientes activos de tu plan.'
      )
  }
}
export async function writeClientStatus(
  pool: Pool,
  identity: SessionIdentity,
  input:
    | ClientInitialRecordInput
    | { status: 'active' | 'inactive' },
  clientId?: string,
  now?: Date
) {
  return transaction(pool, async (client) => {
    await lockActor(client, identity, now, true)
    const {
      rows: [professional],
    } = await client.query(
      'SELECT id FROM private.professionals WHERE user_id=$1',
      [identity.id]
    )
    if (!professional)
      throw new AuthError(404, 'NOT_FOUND', 'El profesional no existe.')
    await lockProfessional(client, professional.id)
    // All consumers of capacity and subscription writes share the professional lock.
    if ('fullName' in input) {
      await requireCapacity(client, professional.id, true, now)
      return (
        await client.query(
          `INSERT INTO private.clients (
             professional_id,full_name,goal,birth_date,height_cm,weight_kg,
             body_fat_percentage,waist_cm,hip_cm
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id,full_name AS "fullName",goal,birth_date::text AS "birthDate",
             height_cm::float8 AS "heightCm",weight_kg::float8 AS "weightKg",
             body_fat_percentage::float8 AS "bodyFatPercentage",waist_cm::float8 AS "waistCm",
             hip_cm::float8 AS "hipCm",status`,
          [
            professional.id,
            input.fullName,
            input.goal,
            input.birthDate,
            input.heightCm,
            input.weightKg,
            input.bodyFatPercentage,
            input.waistCm,
            input.hipCm,
          ]
        )
      ).rows[0]
    }
    // Do not lock a client row before subscription: invitation/activation already lock it.
    const {
      rows: [record],
    } = await client.query(
      'SELECT status FROM private.clients WHERE id=$1 AND professional_id=$2',
      [clientId, professional.id]
    )
    if (!record)
      throw new AuthError(404, 'NOT_FOUND', 'El expediente no existe.')
    await requireCapacity(
      client,
      professional.id,
      input.status === 'active' && record.status !== 'active',
      now
    )
    return (
      await client.query(
        `UPDATE private.clients SET status=$3 WHERE id=$1 AND professional_id=$2
         RETURNING id,full_name AS "fullName",goal,birth_date::text AS "birthDate",
           height_cm::float8 AS "heightCm",weight_kg::float8 AS "weightKg",
           body_fat_percentage::float8 AS "bodyFatPercentage",waist_cm::float8 AS "waistCm",
           hip_cm::float8 AS "hipCm",status`,
        [clientId, professional.id, input.status]
      )
    ).rows[0]
  })
}

import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { lockActor, transaction } from '../../auth/repositories/lifecycle.js'
import type { SaasPlanInput } from '../validators/plans.js'

const projection =
  'id,name,max_clients AS "maxClients",is_unlimited AS "isUnlimited",price_mxn AS "priceMxn",is_active AS "isActive"'
export async function findPlans(pool: Pool) {
  return (
    await pool.query(
      `SELECT ${projection} FROM private.saas_plans ORDER BY max_clients ASC NULLS LAST,id`
    )
  ).rows
}
export async function savePlan(
  pool: Pool,
  identity: SessionIdentity,
  data: SaasPlanInput,
  id?: string
) {
  try {
    return await transaction(pool, async (client) => {
      await lockActor(client, identity, undefined, true)
      let previous = null
      if (id) {
        previous = (
          await client.query(
            'SELECT * FROM private.saas_plans WHERE id=$1 FOR UPDATE',
            [id]
          )
        ).rows[0]
        if (!previous)
          throw new AuthError(404, 'NOT_FOUND', 'El plan no existe.')
      }
      const values = [
        data.name,
        data.maxClients,
        data.isUnlimited,
        data.priceMxn,
        data.isActive,
      ]
      const {
        rows: [plan],
      } = id
        ? await client.query(
            `UPDATE private.saas_plans SET name=$1,max_clients=$2,is_unlimited=$3,price_mxn=$4,is_active=$5,updated_at=clock_timestamp() WHERE id=$6 RETURNING ${projection}`,
            [...values, id]
          )
        : await client.query(
            `INSERT INTO private.saas_plans (name,max_clients,is_unlimited,price_mxn,is_active) VALUES ($1,$2,$3,$4,$5) RETURNING ${projection}`,
            values
          )
      await client.query(
        'INSERT INTO private.plan_history (plan_id,actor_id,previous_value,new_value) VALUES ($1,$2,$3,$4)',
        [plan.id, identity.id, previous, plan]
      )
      return plan
    })
  } catch (error) {
    if (error instanceof AuthError && error.code === 'IDENTIFIER_UNAVAILABLE')
      throw new AuthError(
        409,
        'DUPLICATE_PLAN',
        'Ya existe un plan con ese nombre.'
      )
    throw error
  }
}

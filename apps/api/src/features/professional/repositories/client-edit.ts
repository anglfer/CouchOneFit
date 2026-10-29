import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { lockActor, transaction } from '../../auth/repositories/lifecycle.js'
import {
  lockProfessional,
  requireCapacity
} from '../../saas/repositories/capacity.js'
import {
  editableClientFields,
  mergedClientEdit
} from '../validators/client-edit.js'

export const clientBaseProjection = `id,full_name AS "fullName",goal,status,version,
  birth_date::text AS "birthDate",height_cm::float8 AS "heightCm",base_weight_kg::float8 AS "baseWeightKg",
  base_body_fat_percentage::float8 AS "baseBodyFatPercentage",waist_cm::float8 AS "waistCm",hip_cm::float8 AS "hipCm"`
const columns = [
  'full_name',
  'goal',
  'birth_date',
  'height_cm',
  'base_weight_kg',
  'base_body_fat_percentage',
  'waist_cm',
  'hip_cm'
]

export async function updateClientRecord(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  body: Record<string, unknown>,
  now?: Date
) {
  return transaction(pool, async (client) => {
    await lockActor(client, identity, now, true)
    if (identity.role !== 'professional')
      throw new AuthError(
        403,
        'ROLE_FORBIDDEN',
        'Tu cuenta no tiene acceso a esta área.'
      )
    const {
      rows: [professional]
    } = await client.query(
      'SELECT id FROM private.professionals WHERE user_id=$1',
      [identity.id]
    )
    if (!professional)
      throw new AuthError(
        404,
        'CLIENT_NOT_FOUND',
        'El expediente no está disponible.'
      )
    await lockProfessional(client, professional.id)
    // No subscription row lock before the client: invitation/activation lock client first.
    const {
      rows: [current]
    } = await client.query(
      `SELECT ${clientBaseProjection} FROM private.clients WHERE id=$1 AND professional_id=$2 FOR UPDATE`,
      [id, professional.id]
    )
    if (!current)
      throw new AuthError(
        404,
        'CLIENT_NOT_FOUND',
        'El expediente no está disponible.'
      )
    // DEC-004 business eligibility, never consumption/reallocation of a place.
    await requireCapacity(client, professional.id, false, now)
    if (current.version !== body.version)
      throw new AuthError(
        409,
        'CLIENT_RECORD_CONFLICT',
        'El expediente cambió. Consulta la versión actual antes de reaplicar tus cambios.'
      )
    const merged = mergedClientEdit(current, body, now)
    if (editableClientFields.every((key) => merged[key] === current[key]))
      return current
    await client.query("SET LOCAL TIME ZONE 'America/Mexico_City'")
    const values = editableClientFields.map((key) => merged[key])
    const {
      rows: [updated]
    } = await client.query(
      `UPDATE private.clients SET ${columns.map((col, index) => `${col}=$${index + 4}`).join(',')}
      WHERE id=$1 AND professional_id=$2 AND version=$3 RETURNING ${clientBaseProjection}`,
      [id, professional.id, body.version, ...values]
    )
    if (!updated)
      throw new AuthError(
        409,
        'CLIENT_RECORD_CONFLICT',
        'El expediente cambió. Consulta la versión actual.'
      )
    return updated
  })
}

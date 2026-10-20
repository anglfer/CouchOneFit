import type { Pool, PoolClient } from 'pg'
import { AuthError, invalidSession } from '../types/errors.js'
import type { SessionIdentity } from '../types/session.js'

export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new AuthError(
        409,
        'IDENTIFIER_UNAVAILABLE',
        'El usuario o correo no está disponible.'
      )
    }
    throw error
  } finally {
    client.release()
  }
}
export async function context(
  client: PoolClient,
  key: 'subject_id' | 'client_id' | 'access_operation',
  value: string
) {
  await client.query('SELECT set_config($1,$2,true)', [`app.${key}`, value])
}
export async function lockActor(
  client: PoolClient,
  identity: SessionIdentity,
  now?: Date,
  shared = false
) {
  await context(client, 'subject_id', identity.id)
  // Account first: credential changes/reset/login serialize on the same row.
  const {
    rows: [actor],
  } = await client.query<{ id: string; role: string; password_hash: string }>(
    `SELECT u.id,u.role,u.password_hash FROM private.users u WHERE u.id=$1 AND u.status='active' FOR ${shared ? 'SHARE' : 'UPDATE'}`,
    [identity.id]
  )
  if (!actor || actor.role !== identity.role) throw invalidSession()
  const { rowCount } = await client.query(
    `SELECT id FROM private.sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>COALESCE($3::timestamptz,clock_timestamp())`,
    [identity.sessionId, identity.id, now ?? null]
  )
  if (!rowCount) throw invalidSession()
  return actor
}
export async function revokeAll(
  client: PoolClient,
  userId: string,
  now?: Date
) {
  await client.query(
    `UPDATE private.sessions SET revoked_at=COALESCE($2::timestamptz,clock_timestamp()) WHERE user_id=$1 AND revoked_at IS NULL`,
    [userId, now ?? null]
  )
  await client.query(
    `UPDATE private.refresh_tokens SET used_at=COALESCE($2::timestamptz,clock_timestamp()) WHERE session_id IN (SELECT id FROM private.sessions WHERE user_id=$1) AND used_at IS NULL`,
    [userId, now ?? null]
  )
}
export async function audit(
  client: PoolClient,
  action: string,
  actorId: string | null,
  subjectId: string | null,
  clientId: string | null = null,
  now?: Date
) {
  await client.query(
    `INSERT INTO private.access_events (action,actor_id,subject_id,client_id,created_at) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz,clock_timestamp()))`,
    [action, actorId, subjectId, clientId, now ?? null]
  )
}
export const invalidInvitation = () =>
  new AuthError(
    400,
    'INVITATION_UNAVAILABLE',
    'El código no está disponible. Solicita una nueva invitación a tu profesional.'
  )
export const invalidReset = () =>
  new AuthError(
    400,
    'RESET_UNAVAILABLE',
    'El código no está disponible. Solicita una nueva recuperación asistida.'
  )

export async function lockInvitationRecord(
  client: PoolClient,
  clientId: string,
  now?: Date
) {
  await context(client, 'client_id', clientId)
  const {
    rows: [record],
  } = await client.query<{
    id: string
    professional_id: string
    user_id: string | null
    status: string
  }>(
    'SELECT id,professional_id,user_id,status FROM private.clients WHERE id=$1 FOR UPDATE',
    [clientId]
  )
  if (!record || record.status !== 'active' || record.user_id)
    throw invalidInvitation()
  const {
    rows: [professional],
  } = await client.query<{ user_id: string }>(
    `SELECT p.user_id FROM private.professionals p JOIN private.users u ON u.id=p.user_id WHERE p.id=$1 AND u.status='active'`,
    [record.professional_id]
  )
  if (!professional) throw invalidInvitation()
  await context(client, 'subject_id', professional.user_id)
  const activeProfessional = await client.query(
    "SELECT id FROM private.users WHERE id=$1 AND status='active' FOR SHARE",
    [professional.user_id]
  )
  if (activeProfessional.rowCount !== 1) throw invalidInvitation()
  const {
    rows: [subscription],
  } = await client.query<{ plan: string; status: string; valid: boolean }>(
    `SELECT plan,status,expires_at>COALESCE($2::timestamptz,clock_timestamp()) AS valid FROM private.subscriptions WHERE professional_id=$1 FOR UPDATE`,
    [record.professional_id, now ?? null]
  )
  if (!subscription || subscription.status !== 'active' || !subscription.valid)
    throw invalidInvitation()
  // DEC-005: an active record already reserves its place, even after a downgrade.
  // Invitations and redemption never allocate capacity or reject an existing reservation.
  await context(client, 'client_id', clientId)
  return { ...record, professionalUserId: professional.user_id }
}

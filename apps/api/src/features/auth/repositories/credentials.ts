import type { Pool } from 'pg'
import type { SessionIdentity } from '../types/session.js'
import { AuthError } from '../types/errors.js'
import {
  audit,
  context,
  invalidReset,
  lockActor,
  revokeAll,
  transaction,
} from './lifecycle.js'

const reauthenticationFailed = () =>
  new AuthError(
    403,
    'REAUTHENTICATION_FAILED',
    'No pudimos confirmar tu contraseña actual.'
  )

export async function updateCredentials(
  pool: Pool,
  identity: SessionIdentity,
  username: string,
  digest: string,
  verifyCurrent: (digest: string) => Promise<boolean>,
  now?: Date
) {
  return transaction(pool, async (client) => {
    const actor = await lockActor(client, identity, now)
    if (actor.role !== 'client')
      throw new AuthError(
        403,
        'ROLE_FORBIDDEN',
        'Tu cuenta no tiene acceso a esta área.'
      )
    if (!(await verifyCurrent(actor.password_hash)))
      throw reauthenticationFailed()
    await context(client, 'subject_id', identity.id)
    await client.query(
      'UPDATE private.users SET username=$2,password_hash=$3 WHERE id=$1',
      [identity.id, username, digest]
    )
    // A password change also cancels any outstanding assisted recovery.
    await client.query('DELETE FROM private.password_resets WHERE user_id=$1', [
      identity.id,
    ])
    await revokeAll(client, identity.id, now)
    await audit(
      client,
      'credentials_changed',
      identity.id,
      identity.id,
      identity.clientId ?? null,
      now
    )
  })
}

export async function replacePasswordReset(
  pool: Pool,
  identity: SessionIdentity,
  targetId: string,
  digest: string,
  verifyCurrent: (digest: string) => Promise<boolean>,
  now?: Date
) {
  return transaction(pool, async (client) => {
    // Stable order also serializes two administrators resetting each other.
    for (const id of [...new Set([identity.id, targetId])].sort()) {
      await context(client, 'subject_id', id)
      await client.query(
        'SELECT id FROM private.users WHERE id=$1 FOR UPDATE',
        [id]
      )
    }
    const actor = await lockActor(client, identity, now)
    if (!(await verifyCurrent(actor.password_hash)))
      throw reauthenticationFailed()
    const {
      rows: [target],
    } = await client.query<{ role: string }>(
      "SELECT role FROM private.users WHERE id=$1 AND status='active'",
      [targetId]
    )
    let permitted = false
    if (identity.role === 'professional' && target?.role === 'client') {
      const owned = await client.query(
        'SELECT c.id FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.user_id=$1 AND p.user_id=$2',
        [targetId, identity.id]
      )
      permitted = owned.rowCount === 1
    } else if (
      identity.role === 'admin' &&
      target &&
      ['professional', 'admin'].includes(target.role) &&
      targetId !== identity.id
    ) {
      permitted = true
    }
    if (!permitted)
      throw new AuthError(
        403,
        'RECOVERY_FORBIDDEN',
        'No puedes autorizar esta recuperación.'
      )
    await context(client, 'subject_id', targetId)
    const {
      rows: [reset],
    } = await client.query<{ expiresAt: Date }>(
      `INSERT INTO private.password_resets (user_id,issued_by,token_hash,created_at,expires_at)
       VALUES ($1,$2,$3,COALESCE($4::timestamptz,statement_timestamp()),COALESCE($4::timestamptz,statement_timestamp())+interval '30 minutes')
       ON CONFLICT (user_id) DO UPDATE SET issued_by=EXCLUDED.issued_by,token_hash=EXCLUDED.token_hash,created_at=EXCLUDED.created_at,expires_at=EXCLUDED.expires_at
       RETURNING expires_at AS "expiresAt"`,
      [targetId, identity.id, digest, now ?? null]
    )
    await audit(client, 'reset_issued', identity.id, targetId, null, now)
    return reset.expiresAt.toISOString()
  })
}

export async function consumePasswordReset(
  pool: Pool,
  codeHash: string,
  digest: string,
  now?: Date
) {
  return transaction(pool, async (client) => {
    const {
      rows: [candidate],
    } = await client.query<{ user_id: string }>(
      'SELECT user_id FROM private.password_resets WHERE token_hash=$1',
      [codeHash]
    )
    if (!candidate) throw invalidReset()
    await context(client, 'subject_id', candidate.user_id)
    const { rowCount: active } = await client.query(
      "SELECT id FROM private.users WHERE id=$1 AND status='active' FOR UPDATE",
      [candidate.user_id]
    )
    if (!active) throw invalidReset()
    await context(client, 'subject_id', candidate.user_id)
    const { rowCount } = await client.query(
      'DELETE FROM private.password_resets WHERE user_id=$1 AND token_hash=$2 AND expires_at>COALESCE($3::timestamptz,clock_timestamp())',
      [candidate.user_id, codeHash, now ?? null]
    )
    if (rowCount !== 1) throw invalidReset()
    await client.query(
      'UPDATE private.users SET password_hash=$2 WHERE id=$1',
      [candidate.user_id, digest]
    )
    await revokeAll(client, candidate.user_id, now)
    await audit(
      client,
      'password_reset',
      candidate.user_id,
      candidate.user_id,
      null,
      now
    )
  })
}

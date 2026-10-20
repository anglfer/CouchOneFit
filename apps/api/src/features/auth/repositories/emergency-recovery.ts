import type { Pool } from 'pg'
import { audit, transaction } from './lifecycle.js'
import { AuthError } from '../types/errors.js'
import { randomToken, tokenHash } from '../services/tokens.js'

// Called only by the local custodian command, never exported through HTTP.
export async function issueEmergencyReset(pool: Pool, username: string) {
  const secret = randomToken()
  return transaction(pool, async (client) => {
    const {
      rows: [operator],
    } = await client.query<{ authorized: boolean }>(
      "SELECT rolsuper OR pg_has_role(current_user,'couchone_provision','MEMBER') AS authorized FROM pg_roles WHERE rolname=current_user"
    )
    if (!operator?.authorized)
      throw new AuthError(
        403,
        'CUSTODIAN_REQUIRED',
        'Se requiere una conexión de custodia autorizada.'
      )
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('couchonefit_emergency_admin'))"
    )
    const { rows } = await client.query<{ id: string; username: string }>(
      "SELECT id,username FROM private.users WHERE role='admin' AND status='active' ORDER BY id FOR UPDATE"
    )
    if (rows.length !== 1 || rows[0].username !== username.trim().toLowerCase())
      throw new AuthError(
        403,
        'LAST_ADMIN_REQUIRED',
        'La emergencia se limita al último administrador activo corroborado.'
      )
    const id = rows[0].id
    const {
      rows: [reset],
    } = await client.query<{ expiresAt: Date }>(
      `INSERT INTO private.password_resets (user_id,issued_by,token_hash,created_at,expires_at) VALUES ($1,$1,$2,statement_timestamp(),statement_timestamp()+interval '30 minutes')
       ON CONFLICT (user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,issued_by=EXCLUDED.issued_by,created_at=EXCLUDED.created_at,expires_at=EXCLUDED.expires_at RETURNING expires_at AS "expiresAt"`,
      [id, tokenHash(secret)]
    )
    await audit(client, 'emergency_reset_issued', null, id)
    return { code: secret, expiresAt: reset.expiresAt.toISOString() }
  })
}

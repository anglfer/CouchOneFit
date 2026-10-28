import type { Pool } from 'pg'
import type { SessionIdentity } from '../types/session.js'
import { readAsSubject } from './lifecycle.js'

interface ClientAccessRecord {
  id: string
  userId: string | null
  fullName: string
  goal: string | null
  status: 'active' | 'inactive'
  invitationExpiresAt: Date | null
}
interface RecoveryTarget {
  id: string
  username: string
  role: 'professional' | 'client' | 'admin'
}
export async function ownClientAccess(
  pool: Pool,
  identity: SessionIdentity,
  now?: Date
): Promise<ClientAccessRecord[]> {
  const { rows } = await readAsSubject(pool, identity.id, (client) => client.query<ClientAccessRecord>(
    `SELECT c.id,c.user_id AS "userId",c.full_name AS "fullName",c.goal,c.status,
      i.expires_at AS "invitationExpiresAt" FROM private.clients c
      JOIN private.professionals p ON p.id=c.professional_id
      JOIN private.subscriptions s ON s.professional_id=p.id AND s.status='active'
        AND s.expires_at>COALESCE($2::timestamptz,clock_timestamp())
      LEFT JOIN private.invitations i ON i.client_id=c.id
      WHERE p.user_id=$1 ORDER BY c.created_at DESC,c.id`,
    [identity.id, now ?? null]
  ))
  return rows
}
export async function authorizedRecoveryTargets(
  pool: Pool,
  identity: SessionIdentity
): Promise<RecoveryTarget[]> {
  const { rows } = await readAsSubject(pool, identity.id, (client) => client.query<RecoveryTarget>(
    `SELECT u.id,u.username,u.role FROM private.users u WHERE u.status='active' AND (
      ($1='admin' AND u.role IN ('professional','admin') AND u.id<>$2) OR
      ($1='professional' AND u.role='client' AND EXISTS (SELECT 1 FROM private.clients c
        JOIN private.professionals p ON p.id=c.professional_id WHERE c.user_id=u.id AND p.user_id=$2)))
      ORDER BY u.username`,
    [identity.role, identity.id]
  ))
  return rows
}

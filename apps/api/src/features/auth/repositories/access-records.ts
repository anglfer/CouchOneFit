import type { Pool } from 'pg'
import type { SessionIdentity } from '../types/session.js'
import { readAsSubject } from './lifecycle.js'

interface RecoveryTarget {
  id: string
  username: string
  role: 'professional' | 'client' | 'admin'
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

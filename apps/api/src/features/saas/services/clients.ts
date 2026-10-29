import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { uuid } from '../../auth/validators/lifecycle.js'
import { clientStatusInput } from '../validators/client-status.js'
import { writeClientStatus } from '../repositories/capacity.js'
import { validateClientInitialRecord } from '../../professional/validators/client-record.js'
export { validateClientInitialRecord } from '../../professional/validators/client-record.js'
export type { ClientInitialRecordInput } from '../../professional/validators/client-record.js'

export function createClient(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now?: Date
) {
  return writeClientStatus(
    pool,
    identity,
    validateClientInitialRecord(input, now),
    undefined,
    now
  )
}
export function setClientStatus(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  input: unknown,
  now?: Date
) {
  const body = clientStatusInput(input)
  return writeClientStatus(
    pool,
    identity,
    body,
    uuid(id),
    now
  )
}

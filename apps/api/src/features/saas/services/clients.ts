import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { invalidInput, payload, uuid } from '../../auth/validators/lifecycle.js'
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
  const body = payload(input, ['status'])
  if (body.status !== 'active' && body.status !== 'inactive')
    return invalidInput()
  return writeClientStatus(
    pool,
    identity,
    { status: body.status },
    uuid(id),
    now
  )
}

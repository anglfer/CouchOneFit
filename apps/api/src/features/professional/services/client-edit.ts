import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { uuid } from '../../auth/validators/lifecycle.js'
import { clientEditInput } from '../validators/client-edit.js'
import { updateClientRecord } from '../repositories/client-edit.js'

export async function editClientRecord(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  input: unknown,
  now?: Date
) {
  return {
    client: await updateClientRecord(
      pool,
      identity,
      uuid(id),
      clientEditInput(input),
      now
    )
  }
}

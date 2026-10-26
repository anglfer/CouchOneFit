import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { invalidInput, payload, uuid } from '../../auth/validators/lifecycle.js'
import { writeClientStatus } from '../repositories/capacity.js'
export function createClient(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now?: Date
) {
  const body = payload(input, ['fullName', 'goal'])
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const goal =
    body.goal === undefined || body.goal === null
      ? null
      : typeof body.goal === 'string'
        ? body.goal.trim()
        : invalidInput()
  if (
    fullName.length < 2 ||
    fullName.length > 150 ||
    (goal !== null && (goal.length < 1 || goal.length > 500))
  )
    return invalidInput()
  return writeClientStatus(pool, identity, { fullName, goal }, undefined, now)
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

import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { clientProfile, clientRecord } from '../repositories/profile.js'

export async function readClientRecord(pool: Pool, identity: SessionIdentity, query: unknown) {
  if (query && typeof query === 'object' && Object.keys(query).length)
    throw new AuthError(400, 'INVALID_INPUT', 'Esta consulta no acepta identificadores ni filtros.')
  const record = await clientRecord(pool, identity)
  if (!record) throw new AuthError(401, 'SESSION_REQUIRED', 'Tu sesión venció. Inicia sesión de nuevo.')
  return record
}

export async function readClientProfile(
  pool: Pool,
  identity: SessionIdentity,
) {
  const profile = await clientProfile(pool, identity)
  if (!profile)
    throw new AuthError(
      401,
      'SESSION_REQUIRED',
      'Tu sesión venció. Inicia sesión de nuevo.',
    )
  return profile
}


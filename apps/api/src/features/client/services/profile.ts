import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { clientProfile } from '../repositories/profile.js'

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


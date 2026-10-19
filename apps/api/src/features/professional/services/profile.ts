import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { professionalProfile } from '../repositories/profile.js'

export async function readProfessionalProfile(
  pool: Pool,
  identity: SessionIdentity,
) {
  const profile = await professionalProfile(pool, identity)
  if (!profile)
    throw new AuthError(
      401,
      'SESSION_REQUIRED',
      'Tu sesión venció. Inicia sesión de nuevo.',
    )
  return profile
}

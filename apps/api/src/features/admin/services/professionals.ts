import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'

import { directoryInput } from '../../saas/validators/subscription.js'
import { professionalDirectory } from '../repositories/professionals.js'
export const listProfessionals = (
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now?: Date
) => professionalDirectory(pool, identity, directoryInput(query), now)

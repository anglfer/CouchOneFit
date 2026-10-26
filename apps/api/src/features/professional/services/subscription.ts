import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { professionalSubscription } from '../repositories/subscription.js'
export const readProfessionalSubscription = (
  pool: Pool,
  identity: SessionIdentity,
  now?: Date
) => professionalSubscription(pool, identity, now)

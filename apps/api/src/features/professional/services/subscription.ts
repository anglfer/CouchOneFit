import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { professionalSubscription } from '../repositories/subscription.js'
import {
  writeDowngrade,
  writeSubscriptionPreferences,
} from '../../saas/repositories/subscription-lifecycle.js'
import {
  downgradeInput,
  preferencesInput,
} from '../../saas/validators/subscription-lifecycle.js'
export const readProfessionalSubscription = (
  pool: Pool,
  identity: SessionIdentity,
  now?: Date
) => professionalSubscription(pool, identity, now)
export const updateSubscriptionPreferences = (
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now?: Date
) => writeSubscriptionPreferences(pool, identity, preferencesInput(input), now)
export const downgradeSubscription = (
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now?: Date
) => writeDowngrade(pool, identity, downgradeInput(input), now)

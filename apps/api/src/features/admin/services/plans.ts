import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { savePlan } from '../repositories/plans.js'
import { validatePlanInput } from '../validators/plans.js'
import { uuid } from '../../auth/validators/lifecycle.js'
export const writePlan = (
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  id?: string
) =>
  savePlan(
    pool,
    identity,
    validatePlanInput(input),
    id === undefined ? undefined : uuid(id)
  )

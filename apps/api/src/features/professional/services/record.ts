import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { readPortfolioRecord } from './portfolio.js'
import type { ProfessionalRecord } from '../types/record.js'

export async function readProfessionalRecord(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  query: unknown,
  now?: Date
): Promise<{ record: ProfessionalRecord }> {
  if (query && typeof query === 'object' && Object.keys(query).length)
    throw new AuthError(400, 'INVALID_INPUT', 'Esta consulta no acepta filtros ni identidades adicionales.')

  // Resolve ownership/RLS and the real profile once. Any failure aborts the
  // response; unavailable metadata must never disguise a denial or SQL error.
  const { client } = await readPortfolioRecord(pool, identity, clientId, now)
  return {
    record: {
      profile: client,
      sections: {
        nutritionPlan: { status: 'not_integrated' },
        trainingPlan: { status: 'not_integrated' },
        evaluations: { status: 'not_integrated' },
        progress: { status: 'not_integrated' },
        bodyWeightHistory: { status: 'not_integrated' }
      }
    }
  }
}

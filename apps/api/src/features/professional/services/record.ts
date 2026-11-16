import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { readPortfolioRecord } from './portfolio.js'
import type { ProfessionalRecord } from '../types/record.js'
import { getActivity, getContext } from '../../training/services/training.js'
import { getEvaluations } from '../../evaluations/services/evaluation.js'
import { getEvaluationHistory } from '../../evaluations/services/evolution.js'

export async function readProfessionalRecord(
  pool: Pool,
  identity: SessionIdentity,
  clientId: string,
  query: unknown,
  now?: Date,
): Promise<{ record: ProfessionalRecord }> {
  if (query && typeof query === 'object' && Object.keys(query).length)
    throw new AuthError(
      400,
      'INVALID_INPUT',
      'Esta consulta no acepta filtros ni identidades adicionales.',
    )

  // Resolve ownership/RLS and the real profile once. Any failure aborts the
  // response; unavailable metadata must never disguise a denial or SQL error.
  const { client } = await readPortfolioRecord(pool, identity, clientId, now)
  let trainingPlan: ProfessionalRecord['sections']['trainingPlan']
  try {
    const context = await getContext(
      pool,
      identity,
      clientId,
      {},
      now ?? new Date(),
    )
    // Activity is a complement of the routine: its failure never hides the plan.
    const activity = context.plan
      ? await getActivity(pool, identity, clientId).catch(() => null)
      : null
    trainingPlan = context.plan
      ? {
          status: 'available',
          plan: context.plan,
          activeRevision: context.activeRevision,
          activity,
        }
      : { status: 'empty' }
  } catch (error) {
    if (
      error instanceof AuthError &&
      [400, 401, 403, 404].includes(error.status)
    )
      throw error
    trainingPlan = { status: 'error', code: 'QUERY_FAILED' }
  }
  let evaluations: ProfessionalRecord['sections']['evaluations']
  try {
    const rows = await getEvaluations(pool, identity, clientId)
    evaluations = rows.length
      ? { status: 'available', evaluations: rows }
      : { status: 'empty' }
  } catch (error) {
    if (
      error instanceof AuthError &&
      [400, 401, 403, 404].includes(error.status)
    )
      throw error
    evaluations = { status: 'error', code: 'QUERY_FAILED' }
  }
  let progress: ProfessionalRecord['sections']['progress']
  try {
    const history = await getEvaluationHistory(
      pool,
      identity,
      clientId,
      {},
      now,
    )
    progress = history.samples.length
      ? { status: 'available', history }
      : { status: 'empty', history }
  } catch (error) {
    if (
      error instanceof AuthError &&
      [400, 401, 403, 404].includes(error.status)
    )
      throw error
    progress = { status: 'error', code: 'QUERY_FAILED' }
  }
  return {
    record: {
      profile: client,
      sections: {
        nutritionPlan: { status: 'not_integrated' },
        trainingPlan,
        evaluations,
        progress,
        bodyWeightHistory: { status: 'not_integrated' },
      },
    },
  }
}

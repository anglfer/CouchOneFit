import { assessmentInput } from '../validators/assessment.js'
import { AuthError } from '../../auth/types/errors.js'
import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import * as repository from '../repositories/evaluation.js'
import { clientUuid, evaluationMeasurements } from '../validators/evaluation.js'
import type { Evaluation } from '../types/evaluation.js'

export function createEvaluation(pool: Pool, identity: SessionIdentity, clientId: string, input: unknown, now = new Date()): Promise<Evaluation> {
  if (input && typeof input === 'object' && 'method' in input) {
    const assessment = assessmentInput(input, now.toISOString().slice(0,10))
    const legacy = Object.fromEntries(['weightKg','waistCm','hipCm','measuredBodyFatPercentage','pectoralSkinfoldMm','abdominalSkinfoldMm','tricepsSkinfoldMm','suprailiacSkinfoldMm','thighSkinfoldMm'].map(k=>[k,assessment.measurements[k] ?? null])) as import('../types/evaluation.js').EvaluationMeasurements
    return repository.create(pool, identity, clientUuid(clientId), legacy, now, assessment)
  }
  return repository.create(pool, identity, clientUuid(clientId), evaluationMeasurements(input), now)
}

export function getEvaluations(pool: Pool, identity: SessionIdentity, clientId: string, offset: unknown = 0): Promise<Evaluation[]> {
  if (!/^\d+$/.test(String(offset)) || !Number.isSafeInteger(Number(offset))) throw new AuthError(400, 'INVALID_EVALUATION', 'Página inválida.')
  return repository.list(pool, identity, clientUuid(clientId), Number(offset))
}

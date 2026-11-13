import type { Evaluation } from '../types/evaluation.js'
import {
  EVOLUTION_METRICS,
  type EvolutionMetric,
  type EvolutionPeriod,
  type EvolutionPosition,
  type EvolutionSample,
} from '../types/evolution.js'
import { evolutionTimestamp, isEvolutionDate } from '../validators/evolution.js'

/** Pure projection of persisted inputs only: no profile, plans, calculations or duplicate sources. */
export function evolutionSample(evaluation: Evaluation): EvolutionSample {
  const assessment = evaluation.assessment
  const date = assessment ? assessment.effectiveDate : evaluation.evaluationDate
  if (!isEvolutionDate(date))
    throw new Error('Invalid persisted evaluation date')
  const source = assessment?.measurements ?? evaluation
  const measurements: EvolutionSample['measurements'] = {}
  for (const metric of Object.keys(EVOLUTION_METRICS) as EvolutionMetric[]) {
    const value = (source as Record<string, unknown>)[metric]
    if (typeof value === 'number' && Number.isFinite(value))
      measurements[metric] = value
  }
  return {
    id: evaluation.id,
    clientId: evaluation.clientId,
    date,
    dateBasis: assessment ? 'effective_date' : 'legacy_evaluation_date',
    createdAt: evaluation.createdAt,
    source: 'professional_evaluation',
    method: assessment?.method ?? null,
    provenance: assessment?.provenance ?? null,
    protocol: assessment?.protocol ?? null,
    measurements,
  }
}
export function compareEvolutionPositions(
  a: EvolutionPosition,
  b: EvolutionPosition,
): number {
  const left = [a.date, evolutionTimestamp(a.createdAt), a.id.toLowerCase()]
  const right = [b.date, evolutionTimestamp(b.createdAt), b.id.toLowerCase()]
  for (let i = 0; i < left.length; i++) {
    if (left[i] < right[i]) return -1
    if (left[i] > right[i]) return 1
  }
  return 0
}
export function inEvolutionPeriod(
  date: string,
  period: EvolutionPeriod,
): boolean {
  return (
    (period.from === null || date >= period.from) &&
    (period.to === null || date <= period.to)
  )
}
/** Counts loaded samples only, never the full database or an inferred trend. */
export function evolutionMetricState(
  samples: readonly EvolutionSample[],
  metric: EvolutionMetric,
): { count: number; state: 'empty' | 'single' | 'multiple' } {
  const count = samples.filter(
    (s) => s.measurements[metric] !== undefined,
  ).length
  return {
    count,
    state: count === 0 ? 'empty' : count === 1 ? 'single' : 'multiple',
  }
}

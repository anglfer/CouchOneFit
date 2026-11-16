import type { Assessment } from '../domain/assessment.js'
export const EVALUATION_MEASUREMENT_FIELDS = [
  'weightKg',
  'waistCm',
  'hipCm',
  'measuredBodyFatPercentage',
  'pectoralSkinfoldMm',
  'abdominalSkinfoldMm',
  'tricepsSkinfoldMm',
  'suprailiacSkinfoldMm',
  'thighSkinfoldMm',
] as const

export type EvaluationMeasurementField = (typeof EVALUATION_MEASUREMENT_FIELDS)[number]
export type EvaluationMeasurements = Record<EvaluationMeasurementField, number | null>

export interface Evaluation extends EvaluationMeasurements {
  assessment?: Assessment
  id: string
  clientId: string
  evaluationDate: string
  createdAt: string
}

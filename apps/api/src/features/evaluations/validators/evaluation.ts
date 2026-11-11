import { AuthError } from '../../auth/types/errors.js'
import {
  EVALUATION_MEASUREMENT_FIELDS,
  type EvaluationMeasurementField,
  type EvaluationMeasurements,
} from '../types/evaluation.js'

const ranges: Record<EvaluationMeasurementField, readonly [number, number]> = {
  weightKg: [30, 300],
  waistCm: [40, 250],
  hipCm: [50, 250],
  measuredBodyFatPercentage: [2, 60],
  pectoralSkinfoldMm: [1, 80],
  abdominalSkinfoldMm: [1, 80],
  tricepsSkinfoldMm: [1, 80],
  suprailiacSkinfoldMm: [1, 80],
  thighSkinfoldMm: [1, 80],
}

const invalid = (message = 'Revisa las mediciones de la evaluación.'): never => {
  throw new AuthError(400, 'INVALID_EVALUATION', message)
}

export function evaluationMeasurements(value: unknown): EvaluationMeasurements {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !EVALUATION_MEASUREMENT_FIELDS.includes(key as EvaluationMeasurementField)))
    return invalid('El formulario contiene campos no permitidos.')

  const result = {} as EvaluationMeasurements
  let hasMeasurement = false
  for (const field of EVALUATION_MEASUREMENT_FIELDS) {
    const item = input[field]
    if (item === undefined || item === null) {
      result[field] = null
      continue
    }
    const [minimum, maximum] = ranges[field]
    if (
      typeof item !== 'number' ||
      !Number.isFinite(item) ||
      item < minimum ||
      item > maximum ||
      !Number.isInteger(item * 10)
    ) return invalid()
    result[field] = item
    hasMeasurement = true
  }
  if (!hasMeasurement) return invalid('Registra al menos una medición válida.')
  return result
}

export function clientUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
    return invalid('Identificador de cliente inválido.')
  return value.toLowerCase()
}

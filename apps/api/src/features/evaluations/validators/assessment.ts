import { AuthError } from '../../auth/types/errors.js'
import type { AssessmentInput } from '../domain/assessment.js'
const common = ['weightKg','heightCm']
export const methodFields = {
  perimetros: [...common,'neckCm','waistCm','abdomenUmbilicalCm','hipCm'],
  pliegues: [...common,'tricepsSkinfoldMm','bicepsSkinfoldMm','subscapularSkinfoldMm','suprailiacSkinfoldMm','pectoralSkinfoldMm','abdominalSkinfoldMm','thighSkinfoldMm'],
  bioimpedancia: [...common,'measuredBodyFatPercentage','muscleMassKg','waterLitres','visceralFatIndex'],
} as const
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function fail(message: string, field?: string): never {
  throw new AuthError(400, 'INVALID_EVALUATION', message, field ? { [field]: message } : undefined)
}
export function assessmentInput(value: unknown, today: string): AssessmentInput {
  if (!object(value)) return fail('Evaluación inválida.')
  if (Object.keys(value).some(k => !['method','effectiveDate','equation','measurements','segmental'].includes(k))) return fail('El formulario contiene campos no permitidos.')
  if (!['perimetros','pliegues','bioimpedancia'].includes(String(value.method))) return fail('Selecciona un método válido.', 'method')
  const method = value.method as AssessmentInput['method']
  if (!['male','female','not_applicable'].includes(String(value.equation))) return fail('Selecciona la ecuación o No aplica.', 'equation')
  const date = value.effectiveDate ?? null
  if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date > today)) return fail('Fecha efectiva inválida o futura.', 'effectiveDate')
  if (!object(value.measurements)) return fail('Indica las mediciones.')
  const measurements: Record<string,number> = {}
  for (const [key, n] of Object.entries(value.measurements)) {
    if (!(methodFields[method] as readonly string[]).includes(key)) return fail('Medición no permitida para este método.',key)
    if (n === null || n === undefined) continue
    let min = Number.MIN_VALUE, max = Number.MAX_VALUE
    if (key === 'weightKg') [min,max]=[30,300]
    else if (key === 'heightCm') [min,max]=[100,250]
    else if (key === 'waistCm') [min,max]=[40,250]
    else if (key === 'hipCm') [min,max]=[50,250]
    else if (key === 'measuredBodyFatPercentage') [min,max]=[2,60]
    else if (key.endsWith('SkinfoldMm')) [min,max]=[1,80]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || !Number.isInteger(n*10)) return fail('Medición fuera de rango o con más de un decimal.',key)
    measurements[key]=n
  }
  if (!Object.keys(measurements).some(k => !common.includes(k))) return fail('Registra al menos una medición del método.')
  if (measurements.weightKg && (measurements.muscleMassKg > measurements.weightKg || measurements.waterLitres > measurements.weightKg)) return fail('La masa muscular o el agua no pueden superar el peso.')
  let segmental: AssessmentInput['segmental']
  if (value.segmental != null) {
    const s=value.segmental
    if (method !== 'bioimpedancia' || !object(s) || Object.keys(s).some(k=>!['type','unit','values'].includes(k)) || !['muscle_mass','fat_mass'].includes(String(s.type)) || s.unit !== 'kg' || !object(s.values)) return fail('Los segmentos requieren tipo de masa y unidad kg homogéneos.')
    const values: NonNullable<AssessmentInput['segmental']>['values']={}
    for (const [k,n] of Object.entries(s.values)) {
      if (!['leftArm','rightArm','trunk','leftLeg','rightLeg'].includes(k) || typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || !Number.isInteger(n*10) || (measurements.weightKg && n > measurements.weightKg)) return fail('Valor segmental inválido.')
      values[k as keyof typeof values]=n
    }
    segmental={type:s.type as NonNullable<AssessmentInput['segmental']>['type'],unit:'kg',values}
  }
  return {method,effectiveDate:date as string|null,equation:value.equation as AssessmentInput['equation'],measurements,...(segmental ? {segmental} : {})}
}

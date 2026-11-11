/** Pure, versioned arithmetic. Navy/JP3 deliberately unavailable pending source verification. */
export type AssessmentMethod = 'perimetros' | 'pliegues' | 'bioimpedancia'
export type Equation = 'male' | 'female' | 'not_applicable'
export interface AssessmentInput {
  method: AssessmentMethod
  effectiveDate: string | null
  equation: Equation
  measurements: Record<string, number>
  segmental?: { type: 'muscle_mass' | 'fat_mass'; unit: 'kg'; values: Partial<Record<'leftArm' | 'rightArm' | 'trunk' | 'leftLeg' | 'rightLeg', number>> }
}
export interface Assessment extends AssessmentInput {
  protocol: string
  ownerId: string
  ageYears: number | null
  birthDate: string | null
  version: 'composition-arithmetic-v1'
  calculationStatus: 'available' | 'partial' | 'pending_verification'
  provenance: 'device_reported' | 'manual_measurements'
  results: Record<string, number>
}
export function ageAt(birthDate: string | null, effectiveDate: string): number | null {
  if (!birthDate || birthDate > effectiveDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const [ey, em, ed] = effectiveDate.split('-').map(Number)
  return ey - y - (em < m || (em === m && ed < d) ? 1 : 0)
}
export function calculate(input: AssessmentInput): Record<string, number> {
  const m = input.measurements
  const results: Record<string, number> = {}
  if (Object.values(m).some((v) => !Number.isFinite(v) || v <= 0)) throw new Error('Invalid measurements')
  if (input.method === 'perimetros') {
    if (m.waistCm && m.hipCm) results.waistHipRatio = m.waistCm / m.hipCm
    if (m.waistCm && m.heightCm) results.waistHeightRatio = m.waistCm / m.heightCm
  }
  if (input.method === 'bioimpedancia') {
    if (m.measuredBodyFatPercentage) {
      if (m.measuredBodyFatPercentage >= 100) throw new Error('Invalid body fat percentage')
      results.bodyFatPercentage = m.measuredBodyFatPercentage
      if (m.weightKg) {
        results.fatMassKg = m.weightKg * m.measuredBodyFatPercentage / 100
        results.fatFreeMassKg = m.weightKg - results.fatMassKg
      }
    }
    // Approximation: 1 litre water ≈ 1 kilogram. Never infer muscle from FFM.
    if (m.waterLitres && m.weightKg) {
      if (m.waterLitres > m.weightKg) throw new Error('Water exceeds body mass')
      results.approximateWaterPercentage = m.waterLitres / m.weightKg * 100
    }
  }
  if (Object.values(results).some((v) => !Number.isFinite(v))) throw new Error('Invalid result')
  return results
}

import type { AssessmentMethod, Assessment } from '../domain/assessment.js'

export const EVOLUTION_METRICS = {
  weightKg: { label: 'Peso corporal', unit: 'kg', decimalPlaces: 1 },
  heightCm: { label: 'Estatura', unit: 'cm', decimalPlaces: 1 },
  waistCm: { label: 'Cintura', unit: 'cm', decimalPlaces: 1 },
  hipCm: { label: 'Cadera', unit: 'cm', decimalPlaces: 1 },
  neckCm: { label: 'Cuello', unit: 'cm', decimalPlaces: 1 },
  abdomenUmbilicalCm: {
    label: 'Abdomen umbilical',
    unit: 'cm',
    decimalPlaces: 1,
  },
  measuredBodyFatPercentage: {
    label: 'Grasa corporal medida',
    unit: '%',
    decimalPlaces: 1,
  },
  muscleMassKg: {
    label: 'Masa muscular informada',
    unit: 'kg',
    decimalPlaces: 1,
  },
  waterLitres: {
    label: 'Agua corporal informada',
    unit: 'L',
    decimalPlaces: 1,
  },
  visceralFatIndex: {
    label: 'Grasa visceral (índice del equipo)',
    unit: 'índice',
    decimalPlaces: 1,
  },
  pectoralSkinfoldMm: {
    label: 'Pliegue pectoral',
    unit: 'mm',
    decimalPlaces: 1,
  },
  abdominalSkinfoldMm: {
    label: 'Pliegue abdominal',
    unit: 'mm',
    decimalPlaces: 1,
  },
  tricepsSkinfoldMm: {
    label: 'Pliegue tricipital',
    unit: 'mm',
    decimalPlaces: 1,
  },
  bicepsSkinfoldMm: {
    label: 'Pliegue bicipital',
    unit: 'mm',
    decimalPlaces: 1,
  },
  subscapularSkinfoldMm: {
    label: 'Pliegue subescapular',
    unit: 'mm',
    decimalPlaces: 1,
  },
  suprailiacSkinfoldMm: {
    label: 'Pliegue suprailiaco',
    unit: 'mm',
    decimalPlaces: 1,
  },
  thighSkinfoldMm: {
    label: 'Pliegue de muslo anterior',
    unit: 'mm',
    decimalPlaces: 1,
  },
} as const
export type EvolutionMetric = keyof typeof EVOLUTION_METRICS
export type EvolutionMethodFilter = AssessmentMethod | 'legacy' | null
export interface EvolutionPeriod {
  from: string | null
  to: string | null
}
export interface EvolutionPosition {
  date: string
  createdAt: string
  id: string
}
export interface EvolutionQuery extends EvolutionPeriod {
  method: EvolutionMethodFilter
  pageSize: number
  after: EvolutionPosition | null
}
/** Trusted subject and authorized client, never an identity read from query parameters. */
export interface EvolutionScope {
  subjectId: string
  clientId: string
}
export interface EvolutionSample extends EvolutionPosition {
  clientId: string
  dateBasis: 'effective_date' | 'legacy_evaluation_date'
  source: 'professional_evaluation'
  method: AssessmentMethod | null
  provenance: Assessment['provenance'] | null
  protocol: string | null
  measurements: Partial<Record<EvolutionMetric, number>>
}
export interface EvolutionPage {
  clientId: string
  period: EvolutionPeriod
  method: EvolutionMethodFilter
  order: 'asc'
  metricDefinitions: typeof EVOLUTION_METRICS
  samples: EvolutionSample[]
  pageInfo: { pageSize: number; hasMore: boolean; nextCursor: string | null }
}
/** Professional record evolution; bodyWeightHistory remains separate for HU-037. */
export type EvolutionSection =
  | { status: 'empty'; history: EvolutionPage }
  | { status: 'available'; history: EvolutionPage }
  | { status: 'error'; code: 'QUERY_FAILED' }

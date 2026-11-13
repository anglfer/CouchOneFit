import type {
  TrainingActivity,
  TrainingVersion,
} from '../../training/types/training.js'
import type { EvolutionSection } from '../../evaluations/types/evolution.js'
import type { Evaluation } from '../../evaluations/types/evaluation.js'

export interface ClientBaseRecord {
  id: string
  fullName: string
  goal: string | null
  status: 'active' | 'inactive'
  version: number
  birthDate: string | null
  heightCm: number | null
  baseWeightKg: number | null
  baseBodyFatPercentage: number | null
  waistCm: number | null
  hipCm: number | null
}

// This envelope defines availability, not the data contracts of future modules.
// Only not_integrated is emitted until an authorized real reader is integrated.
export type RecordSection =
  | { status: 'not_integrated' }
  | { status: 'empty' }
  | { status: 'error'; code: 'QUERY_FAILED' }

export type EvaluationSection =
  | { status: 'empty' }
  | { status: 'available'; evaluations: Evaluation[] }
  | { status: 'error'; code: 'QUERY_FAILED' }

export interface ProfessionalRecord {
  profile: ClientBaseRecord
  sections: {
    nutritionPlan: RecordSection
    trainingPlan:
      | RecordSection
      | {
          status: 'available'
          plan: TrainingVersion
          activeRevision: number
          activity: TrainingActivity | null
        }
    evaluations: EvaluationSection
    progress: EvolutionSection
    bodyWeightHistory: RecordSection
  }
}

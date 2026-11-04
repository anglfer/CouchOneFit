import type { ClientBaseRecord } from './portfolio';
import type { TrainingVersion } from '../../training/types/training';

// Availability only; module-specific data require their own integrated contract.
export type RecordSection =
  | { status: 'not_integrated' }
  | { status: 'empty' }
  | { status: 'error'; code: 'QUERY_FAILED' };

export interface ProfessionalRecord {
  profile: ClientBaseRecord;
  sections: {
    nutritionPlan: RecordSection;
    trainingPlan:
      | RecordSection
      | { status: 'available'; plan: TrainingVersion; activeRevision: number };
    evaluations: RecordSection;
    progress: RecordSection;
    bodyWeightHistory: RecordSection;
  };
}

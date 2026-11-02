import type { ClientBaseRecord } from './portfolio';

// Availability only; module-specific data require their own integrated contract.
export type RecordSection =
  | { status: 'not_integrated' }
  | { status: 'empty' }
  | { status: 'error'; code: 'QUERY_FAILED' };

export interface ProfessionalRecord {
  profile: ClientBaseRecord;
  sections: {
    nutritionPlan: RecordSection;
    trainingPlan: RecordSection;
    evaluations: RecordSection;
    progress: RecordSection;
    bodyWeightHistory: RecordSection;
  };
}

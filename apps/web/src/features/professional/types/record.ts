import type { ClientBaseRecord } from './portfolio';
import type { TrainingVersion } from '../../training/types/training';
import type { EvolutionSection } from '../../evaluations/types/evolution';
import type { EvaluationSection } from '../../evaluations/types/evaluation';

// Availability only; module-specific data require their own integrated contract.
export type RecordSection =
  | { status: 'not_integrated' }
  | { status: 'empty' }
  | { status: 'error'; code: 'QUERY_FAILED' };

/** Recent activity of the client, sent with the active routine. */
export interface TrainingActivity {
  lastSession: string | null;
  sessionsLast7: number;
  sessionsLast30: number;
  setsLast30: number;
}

export interface ProfessionalRecord {
  profile: ClientBaseRecord;
  sections: {
    nutritionPlan: RecordSection;
    trainingPlan:
      | RecordSection
      | {
          status: 'available';
          plan: TrainingVersion;
          activeRevision: number;
          activity?: TrainingActivity | null;
        };
    evaluations: EvaluationSection;
    progress: EvolutionSection | { status: 'not_integrated' };
    bodyWeightHistory: RecordSection;
  };
}

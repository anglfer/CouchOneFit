export const COMPLIANCE = ['completed', 'partial', 'not_completed', 'not_applicable'] as const;
export type Compliance = (typeof COMPLIANCE)[number];
/** Explicit states of an applicable day (DEC-008); absence is "no data", never a failure. */
export type AdherenceState = 'completed' | 'partial' | 'not_completed';

export interface CheckInValues {
  bodyWeightKg: number | null;
  sleepHours: number | null;
  stress: number | null;
  energy: number | null;
  hunger: number | null;
  nutritionCompliance: Compliance | null;
  comment: string | null;
}

export interface CheckIn extends CheckInValues {
  id: string;
  localDate: string;
  timeZone: string;
  revision: number;
  nutritionVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** HU-037 event: the body weight of a check-in, the only source of daily weight. */
export interface BodyWeightEntry {
  checkInId: string;
  localDate: string;
  timeZone: string;
  weightKg: number;
  unit: 'kg';
  source: 'check_in';
  revision: number;
  recordedAt: string;
}

export interface FollowUpSessionSet {
  setId: string;
  ordinal: number;
  prescribedReps: number;
  prescribedRepsMax: number | null;
  targetLoadKg: number | null;
  state: 'performed' | 'not_performed' | null;
  reps: number | null;
  loadKg: number | null;
  unit: 'kg' | 'bodyweight';
  rpe: number | null;
  rir: number | null;
}

export interface FollowUpSessionExercise {
  exerciseId: string;
  name: string;
  loadMode: 'external' | 'bodyweight';
  sets: FollowUpSessionSet[];
}

export interface FollowUpSession {
  id: string;
  localDate: string;
  timeZone: string;
  status: 'draft' | 'finalized';
  versionId: string;
  versionNumber: number;
  routineName: string;
  dayName: string;
  performedSets: number;
  totalSets: number;
  exercises: FollowUpSessionExercise[];
}

export interface SharedMeasurement {
  id: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  bodyFatPercentage: number | null;
  source: 'professional_evaluation';
  method: 'perimetros' | 'pliegues' | 'bioimpedancia' | null;
}

export interface AdherenceSummary {
  applicableDays: number;
  recordedDays: number;
  completed: number;
  partial: number;
  notCompleted: number;
  /** Observed over days with an explicit state; null when none (not "0 %"). */
  observedPercent: number | null;
  coveragePercent: number | null;
}

export interface Visibility {
  measurements: boolean;
  adherence: boolean;
  revision: number;
}

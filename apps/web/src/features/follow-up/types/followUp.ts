export type Compliance =
  'completed' | 'partial' | 'not_completed' | 'not_applicable';

export interface CheckIn {
  id: string;
  localDate: string;
  timeZone: string;
  revision: number;
  bodyWeightKg: number | null;
  sleepHours: number | null;
  stress: number | null;
  energy: number | null;
  hunger: number | null;
  nutritionCompliance: Compliance | null;
  nutritionVersionId: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** HU-037: body weight registered by the client in its check-in. */
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

export interface AdherenceSummary {
  applicableDays: number;
  recordedDays: number;
  completed: number;
  partial: number;
  notCompleted: number;
  observedPercent: number | null;
  coveragePercent: number | null;
}

export interface Visibility {
  measurements: boolean;
  adherence: boolean;
  revision: number;
}

export interface FollowUp {
  clientId: string;
  from: string;
  to: string;
  today: string;
  timeZone: string;
  checkIns: CheckIn[];
  bodyWeight: BodyWeightEntry[];
  sessions: FollowUpSession[];
  adherence: { training: AdherenceSummary; nutrition: AdherenceSummary };
  visibility: Visibility;
}

export interface PortfolioFollowUpSummary {
  days: number;
  activeClients: number;
  adherence: { training: AdherenceSummary; nutrition: AdherenceSummary };
}

export type SetKind =
  'warmup' | 'working' | 'top' | 'backoff' | 'drop' | 'failure';
export interface PrescribedSet {
  id: string;
  kind: SetKind;
  reps: number;
  repsMax: number | null;
  rpe: number | null;
  rir: number | null;
  targetLoadKg: number | null;
}
export interface TrainingExercise {
  id: string;
  catalogId: string | null;
  name: string;
  instructions: string;
  guidance: string[];
  images: string[];
  loadMode: 'external' | 'bodyweight';
  restSeconds: number | null;
  sets: PrescribedSet[];
}
export interface TrainingDay {
  id: string;
  name: string;
  kind: 'training' | 'rest';
  date: string | null;
  exercises: TrainingExercise[];
}
export interface Prescription {
  name: string;
  schedule: 'weekly' | 'cycle' | 'calendar';
  startDate: string;
  days: TrainingDay[];
}
export interface TrainingVersion extends Prescription {
  id: string;
  planId: string;
  clientId: string | null;
  number: number;
  revision: number;
  published: boolean;
  createdAt: string;
}
export interface SetResult {
  setId: string;
  state: 'performed' | 'not_performed';
  reps: number;
  loadKg: number | null;
  rpe: number | null;
  rir: number | null;
}
export interface TrainingSession {
  id: string;
  localDate: string;
  timeZone: string;
  versionId: string;
  dayId: string;
  revision: number;
  status: 'draft' | 'finalized';
  results: SetResult[];
  createdAt: string;
  updatedAt: string;
}
export interface TrainingContext {
  clientId: string;
  localDate: string;
  today: string;
  timeZone: string;
  canWrite: boolean;
  activeRevision: number;
  plan: TrainingVersion | null;
  dayId: string | null;
  session: TrainingSession | null;
}

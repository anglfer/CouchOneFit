import { sessionMutation, sessionRequest } from '../../auth/services/session';
import {
  submitWrite,
  type WriteOutcome,
} from '../../../services/offline/writes';
import type {
  AdherenceSummary,
  BodyWeightEntry,
  CheckIn,
  FollowUp,
  FollowUpSession,
  FollowUpSessionExercise,
  FollowUpSessionSet,
  PortfolioFollowUpSummary,
  Visibility,
} from '../types/followUp';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const date = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const nullable = (value: unknown, check: (v: unknown) => boolean) =>
  value === null || check(value);
const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);
const scale = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;

export const COMPLIANCE_LABEL: Record<string, string> = {
  completed: 'Cumplido',
  partial: 'Parcial',
  not_completed: 'No cumplido',
  not_applicable: 'No aplica',
};

export function isCheckIn(value: unknown): value is CheckIn {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    date(value.localDate) &&
    Number.isInteger(value.revision) &&
    nullable(value.bodyWeightKg, finite) &&
    nullable(value.sleepHours, finite) &&
    nullable(value.stress, scale) &&
    nullable(value.energy, scale) &&
    nullable(value.hunger, scale) &&
    nullable(value.nutritionCompliance, (v) => String(v) in COMPLIANCE_LABEL) &&
    nullable(value.comment, (v) => typeof v === 'string')
  );
}

export function isWeightEntry(value: unknown): value is BodyWeightEntry {
  return (
    object(value) &&
    typeof value.checkInId === 'string' &&
    date(value.localDate) &&
    typeof value.timeZone === 'string' &&
    value.timeZone.length > 0 &&
    finite(value.weightKg) &&
    value.unit === 'kg' &&
    value.source === 'check_in'
  );
}

const isSessionSet = (value: unknown): value is FollowUpSessionSet =>
  object(value) &&
  typeof value.setId === 'string' &&
  Number.isInteger(value.ordinal) &&
  (value.ordinal as number) >= 1 &&
  Number.isInteger(value.prescribedReps) &&
  nullable(value.prescribedRepsMax, Number.isInteger) &&
  nullable(value.targetLoadKg, finite) &&
  nullable(value.state, (v) => v === 'performed' || v === 'not_performed') &&
  nullable(value.reps, Number.isInteger) &&
  nullable(value.loadKg, finite) &&
  (value.unit === 'kg' || value.unit === 'bodyweight') &&
  nullable(value.rpe, finite) &&
  nullable(value.rir, Number.isInteger);

const isSessionExercise = (value: unknown): value is FollowUpSessionExercise =>
  object(value) &&
  typeof value.exerciseId === 'string' &&
  typeof value.name === 'string' &&
  (value.loadMode === 'external' || value.loadMode === 'bodyweight') &&
  Array.isArray(value.sets) &&
  value.sets.every(isSessionSet);

const isSession = (value: unknown): value is FollowUpSession =>
  object(value) &&
  typeof value.id === 'string' &&
  date(value.localDate) &&
  typeof value.timeZone === 'string' &&
  (value.status === 'draft' || value.status === 'finalized') &&
  typeof value.versionId === 'string' &&
  Number.isInteger(value.versionNumber) &&
  typeof value.routineName === 'string' &&
  typeof value.dayName === 'string' &&
  Number.isInteger(value.performedSets) &&
  Number.isInteger(value.totalSets) &&
  Array.isArray(value.exercises) &&
  value.exercises.every(isSessionExercise);

const isAdherence = (value: unknown): value is AdherenceSummary =>
  object(value) &&
  [
    'applicableDays',
    'recordedDays',
    'completed',
    'partial',
    'notCompleted',
  ].every((key) => Number.isInteger(value[key])) &&
  nullable(value.observedPercent, finite) &&
  nullable(value.coveragePercent, finite);

const isVisibility = (value: unknown): value is Visibility =>
  object(value) &&
  typeof value.measurements === 'boolean' &&
  typeof value.adherence === 'boolean' &&
  Number.isInteger(value.revision);

export async function fetchFollowUp(
  clientId: string,
  range: { days: number } | { from: string; to: string }
): Promise<FollowUp> {
  const query =
    'days' in range
      ? `days=${range.days}`
      : `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  const value = await sessionRequest<unknown>(
    `/api/clients/${encodeURIComponent(clientId)}/follow-up?${query}`
  );
  // Another portfolio's payload or a malformed one is never shown as data.
  if (
    !object(value) ||
    value.clientId !== clientId ||
    !date(value.from) ||
    !date(value.to) ||
    !date(value.today) ||
    typeof value.timeZone !== 'string' ||
    !Array.isArray(value.checkIns) ||
    !value.checkIns.every(isCheckIn) ||
    !Array.isArray(value.bodyWeight) ||
    !value.bodyWeight.every(isWeightEntry) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isSession) ||
    !object(value.adherence) ||
    !isAdherence(value.adherence.training) ||
    !isAdherence(value.adherence.nutrition) ||
    !isVisibility(value.visibility)
  )
    throw new Error('No pudimos interpretar el seguimiento.');
  return value as unknown as FollowUp;
}

export async function fetchPortfolioSummary(): Promise<PortfolioFollowUpSummary> {
  const value = await sessionRequest<unknown>('/api/follow-up/summary');
  if (
    !object(value) ||
    !Number.isInteger(value.days) ||
    !Number.isInteger(value.activeClients) ||
    !object(value.adherence) ||
    !isAdherence(value.adherence.training) ||
    !isAdherence(value.adherence.nutrition)
  )
    throw new Error('No pudimos interpretar el resumen de adherencia.');
  return value as unknown as PortfolioFollowUpSummary;
}

export async function updateVisibility(
  clientId: string,
  next: Omit<Visibility, 'revision'>,
  revision: number
): Promise<Visibility> {
  const value = await sessionMutation<unknown>(
    `/api/clients/${encodeURIComponent(clientId)}/visibility`,
    { ...next, revision },
    'PATCH',
    { 'Idempotency-Key': crypto.randomUUID() }
  );
  if (!object(value) || !isVisibility(value.visibility))
    throw new Error('No pudimos confirmar el cambio.');
  return value.visibility;
}

export async function submitVisibility(
  clientId: string,
  next: Omit<Visibility, 'revision'>,
  revision: number,
  clientName?: string | null
): Promise<WriteOutcome<Visibility>> {
  return submitWrite(
    {
      kind: 'followup.visibility',
      method: 'PATCH',
      endpoint: `/api/clients/${encodeURIComponent(clientId)}/visibility`,
      readEndpoint: `/api/clients/${encodeURIComponent(clientId)}/follow-up?days=28`,
      body: { ...next, revision },
      label: clientName
        ? `Actualizar información compartida: ${clientName}`
        : 'Actualizar información compartida',
      clientId,
      clientName: clientName ?? null,
    },
    async (headers) => {
      const value = await sessionMutation<unknown>(
        `/api/clients/${encodeURIComponent(clientId)}/visibility`,
        { ...next, revision },
        'PATCH',
        headers
      );
      if (!object(value) || !isVisibility(value.visibility))
        throw new Error('No pudimos confirmar el cambio.');
      return value.visibility;
    }
  );
}

export const shiftDate = (value: string, days: number) =>
  new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);

/** "83 %" or a dash: a missing denominator is never shown as 0 %. */
export const percentLabel = (value: number | null) =>
  value === null ? '—' : `${value} %`;

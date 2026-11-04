import { sessionMutation, sessionRequest } from '../../auth/services/session';
import { isConnectionFailure } from '../../../services/offline/connection';
import {
  enqueue,
  getOperations,
  updateOperation,
  type OperationSpec,
} from '../../../services/offline/outbox';
import { flushOutbox } from '../../../services/offline/sync';
import type {
  PrescribedSet,
  Prescription,
  TrainingSession,
  TrainingVersion,
} from '../types/training';

export interface CatalogExercise {
  id: string;
  name: string;
  bodyPart: string;
  muscles: string[];
  equipment: string[];
  guidance: string[];
  images: string[];
  selectable: boolean;
}
export interface VersionsResponse {
  versions: TrainingVersion[];
  activeVersionId: string | null;
  activeRevision: number;
  timeZone: string | null;
  clientRevision: number | null;
}
export const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const nullableNumber = (v: unknown) => v === null || typeof v === 'number';
export function isVersion(v: unknown): v is TrainingVersion {
  return (
    object(v) &&
    typeof v.id === 'string' &&
    typeof v.planId === 'string' &&
    (v.clientId === null || typeof v.clientId === 'string') &&
    Number.isInteger(v.number) &&
    Number.isInteger(v.revision) &&
    typeof v.published === 'boolean' &&
    typeof v.name === 'string' &&
    ['weekly', 'cycle', 'calendar'].includes(String(v.schedule)) &&
    typeof v.startDate === 'string' &&
    Array.isArray(v.days) &&
    v.days.every(
      (d) =>
        object(d) &&
        typeof d.id === 'string' &&
        typeof d.name === 'string' &&
        ['rest', 'training'].includes(String(d.kind)) &&
        (d.date === null || typeof d.date === 'string') &&
        Array.isArray(d.exercises) &&
        d.exercises.every(
          (e) =>
            object(e) &&
            typeof e.id === 'string' &&
            (e.catalogId === null || typeof e.catalogId === 'string') &&
            typeof e.name === 'string' &&
            typeof e.instructions === 'string' &&
            strings(e.guidance) &&
            strings(e.images) &&
            ['bodyweight', 'external'].includes(String(e.loadMode)) &&
            nullableNumber(e.restSeconds) &&
            Array.isArray(e.sets) &&
            e.sets.every(
              (s) =>
                object(s) &&
                typeof s.id === 'string' &&
                typeof s.reps === 'number' &&
                nullableNumber(s.repsMax) &&
                nullableNumber(s.rpe) &&
                nullableNumber(s.rir) &&
                nullableNumber(s.targetLoadKg)
            )
        )
    )
  );
}
export async function readVersions(base: string): Promise<VersionsResponse> {
  const value = await sessionRequest<unknown>(base);
  if (
    !object(value) ||
    !Array.isArray(value.versions) ||
    !value.versions.every(isVersion) ||
    typeof value.activeRevision !== 'number' ||
    (value.activeVersionId !== null &&
      typeof value.activeVersionId !== 'string') ||
    (value.timeZone !== null && typeof value.timeZone !== 'string') ||
    (value.clientRevision !== null && typeof value.clientRevision !== 'number')
  )
    throw new Error('No pudimos interpretar las rutinas.');
  return value as unknown as VersionsResponse;
}
export async function readCatalog(query: URLSearchParams) {
  const value = await sessionRequest<unknown>(
    `/api/training/exercises?${query}`
  );
  if (
    !object(value) ||
    !Array.isArray(value.exercises) ||
    !value.exercises.every(
      (e) =>
        object(e) &&
        typeof e.id === 'string' &&
        typeof e.name === 'string' &&
        typeof e.bodyPart === 'string' &&
        strings(e.muscles) &&
        strings(e.equipment) &&
        strings(e.guidance) &&
        strings(e.images) &&
        typeof e.selectable === 'boolean'
    ) ||
    !object(value.filters) ||
    !strings(value.filters.muscles) ||
    !strings(value.filters.equipment) ||
    (value.nextOffset !== null && typeof value.nextOffset !== 'number')
  )
    throw new Error('El catálogo no está disponible.');
  return value as unknown as {
    exercises: CatalogExercise[];
    filters: { muscles: string[]; equipment: string[] };
    nextOffset: number | null;
  };
}
export const documentOf = (v: Prescription): Prescription => ({
  name: v.name,
  schedule: v.schedule,
  startDate: v.startDate,
  days: structuredClone(v.days),
});
export function clonePrescription(v: Prescription): Prescription {
  const copy = documentOf(v);
  for (const day of copy.days) {
    day.id = crypto.randomUUID();
    for (const exercise of day.exercises) {
      exercise.id = crypto.randomUUID();
      for (const set of exercise.sets) set.id = crypto.randomUUID();
    }
  }
  return copy;
}
export function emptyPrescription(): Prescription {
  return {
    name: 'Nueva rutina',
    schedule: 'weekly',
    startDate: new Date().toLocaleDateString('en-CA'),
    days: [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ].map((name) => ({
      id: crypto.randomUUID(),
      name,
      kind: 'rest',
      date: null,
      exercises: [],
    })),
  };
}
export async function trainingWrite(
  spec: Omit<OperationSpec, 'id'>
): Promise<{ queued: boolean; result?: unknown }> {
  const related = getOperations().filter(
    (op) => op.entityKey === spec.entityKey
  );
  const last = related.at(-1);
  if (
    last &&
    last.state === 'pending' &&
    last.attempts === 0 &&
    object(spec.body.prescription) &&
    object(last.body.prescription)
  ) {
    await updateOperation(last.id, {
      body: { ...last.body, prescription: spec.body.prescription },
    });
    return { queued: true };
  }
  const id = crypto.randomUUID(),
    dependencies = related.map((op) => op.id);
  if (!dependencies.length && navigator.onLine !== false) {
    try {
      return {
        queued: false,
        result: await sessionMutation(spec.endpoint, spec.body, spec.method, {
          'Idempotency-Key': id,
        }),
      };
    } catch (error) {
      if (!isConnectionFailure(error)) throw error;
      const operation = await enqueue({ ...spec, id, dependsOn: dependencies });
      if (!operation) throw error;
      // The server may have committed before a lost response: never merge this payload.
      await updateOperation(id, { attempts: 1 });
      return { queued: true };
    }
  }
  const operation = await enqueue({ ...spec, id, dependsOn: dependencies });
  if (!operation)
    throw new Error('No pudimos guardar el cambio en este dispositivo.');
  if (navigator.onLine !== false) void flushOutbox();
  return { queued: true };
}
export function setTarget(set: PrescribedSet): string {
  return [
    set.repsMax === null
      ? `${set.reps} reps`
      : `${set.reps}–${set.repsMax} reps`,
    set.rpe !== null && `RPE ${set.rpe}`,
    set.rir !== null && `RIR ${set.rir}`,
    set.targetLoadKg !== null && `${set.targetLoadKg} kg`,
  ]
    .filter(Boolean)
    .join(' · ');
}
const isSession = (s: unknown): s is TrainingSession =>
  object(s) &&
  typeof s.id === 'string' &&
  typeof s.localDate === 'string' &&
  typeof s.versionId === 'string' &&
  typeof s.dayId === 'string' &&
  (s.status === 'draft' || s.status === 'finalized') &&
  Array.isArray(s.results) &&
  s.results.every(
    (r) =>
      object(r) &&
      typeof r.setId === 'string' &&
      (r.state === 'performed' || r.state === 'not_performed') &&
      typeof r.reps === 'number' &&
      nullableNumber(r.loadKg) &&
      nullableNumber(r.rpe) &&
      nullableNumber(r.rir)
  );
export async function readSessions(clientId: string, offset: number) {
  const value = await sessionRequest<unknown>(
    `/api/clients/${encodeURIComponent(clientId)}/training-sessions?offset=${offset}`
  );
  if (
    !object(value) ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isSession) ||
    (value.nextOffset !== null && typeof value.nextOffset !== 'number')
  )
    throw new Error('No pudimos interpretar los registros.');
  return value as unknown as {
    sessions: TrainingSession[];
    nextOffset: number | null;
  };
}

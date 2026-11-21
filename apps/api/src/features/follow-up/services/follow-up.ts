import type { Pool, PoolClient } from 'pg';
import type { SessionIdentity } from '../../auth/types/session.js';
import { mutate, read, historical, session as trainingSession, version as trainingVersion } from '../../training/repositories/training.js';
import { calendarDistance, localDate, scheduledDay, shiftDate } from '../../training/services/calendar.js';
import type { TrainingVersion } from '../../training/types/training.js';
import { sessionState, summarize } from '../domain/adherence.js';
import * as repository from '../repositories/follow-up.js';
import type { AdherenceState, BodyWeightEntry, CheckIn, FollowUpSession } from '../types/follow-up.js';
import * as validate from '../validators/follow-up.js';

const EXPLICIT = ['completed', 'partial', 'not_completed'];
const range = (from: string, to: string) => Array.from({ length: calendarDistance(to, from) + 1 }, (_, i) => shiftDate(from, i));

export const weightEntry = (c: CheckIn): BodyWeightEntry => ({
  checkInId: c.id,
  localDate: c.localDate,
  timeZone: c.timeZone,
  weightKg: c.bodyWeightKg!,
  unit: 'kg',
  source: 'check_in',
  revision: c.revision,
  recordedAt: c.updatedAt,
});

function windowError(today: string, date: string) {
  const distance = calendarDistance(today, date);
  if (distance < 0 || distance > 2) validate.invalid('Solo puedes registrar hoy y las dos fechas anteriores.');
}

/** What applies to a date: the nutrition plan in force and the scheduled training. */
async function dayContext(c: PoolClient, clientId: string, date: string) {
  const nutritionId = repository.inForce(await repository.activations(c, 'nutrition_activations', clientId), date);
  const nutrition = { applicable: nutritionId !== null, planName: nutritionId ? await repository.nutritionName(c, nutritionId) : null };
  // Training is context for the check-in, never a requirement: its failure leaves it null.
  const training = await (async () => {
    const plan = await historical(c, clientId, date);
    const day = plan ? scheduledDay(plan, date) : null;
    const done = await trainingSession(c, clientId, date);
    return day ? { kind: day.kind, dayName: day.name, sessionStatus: done?.status ?? null } : null;
  })().catch(() => null);
  return { nutritionId, nutrition, training };
}

export function getCheckInContext(pool: Pool, identity: SessionIdentity, query: unknown, now: Date) {
  const q = validate.object(query, ['date']);
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, null);
    const today = localDate(now, s.timeZone);
    const date = q.date === undefined ? today : validate.date(q.date);
    windowError(today, date);
    const recent = await repository.between(c, s.clientId, shiftDate(today, -2), today);
    const { nutrition, training } = await dayContext(c, s.clientId, date);
    return {
      clientId: s.clientId,
      today,
      timeZone: s.timeZone,
      canWrite: s.canWrite,
      localDate: date,
      dates: [0, -1, -2].map((n) => {
        const day = shiftDate(today, n);
        return { localDate: day, recorded: recent.some((r) => r.localDate === day) };
      }),
      checkIn: recent.find((r) => r.localDate === date) ?? null,
      nutrition,
      training,
    };
  });
}

export async function saveCheckIn(pool: Pool, identity: SessionIdentity, key: unknown, body: unknown, now: Date) {
  const input = validate.checkIn(body);
  return mutate(pool, identity, validate.uuid(key), 'check-in', body, now, async (c) => {
    const s = await repository.scope(c, identity, null, true);
    const [previous] = await repository.between(c, s.clientId, input.localDate, input.localDate);
    // The window follows the zone snapshot of an existing check-in, like a training session.
    windowError(localDate(now, previous?.timeZone ?? s.timeZone), input.localDate);
    if (previous ? previous.id !== input.id || previous.revision !== input.revision : input.revision !== 0) return repository.conflict();
    const { nutritionId } = await dayContext(c, s.clientId, input.localDate);
    const compliance = input.values.nutritionCompliance;
    if (compliance === 'not_applicable' && nutritionId)
      return validate.invalid('Ese día tenías un plan alimenticio vigente: indica si lo cumpliste.');
    if (compliance && compliance !== 'not_applicable' && !nutritionId)
      return validate.invalid('Ese día no tenías un plan alimenticio vigente.');
    const linked = compliance && EXPLICIT.includes(compliance) ? nutritionId : null;
    return { checkIn: await repository.save(c, { ...s, timeZone: previous?.timeZone ?? s.timeZone }, input.id, input.localDate, input.values, linked, previous ?? null, now) };
  });
}

export function getOwnCheckIns(pool: Pool, identity: SessionIdentity, query: unknown) {
  const q = validate.object(query, ['offset']);
  const offset = validate.offset(q.offset);
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, null);
    return repository.page(c, s.clientId, offset);
  });
}

async function adherenceDays(
  c: PoolClient,
  clientId: string,
  from: string,
  to: string,
  checkIns: CheckIn[],
  versions: Map<string, TrainingVersion>,
): Promise<{ training: (AdherenceState | null)[]; nutrition: (AdherenceState | null)[] }> {
  if (to < from) return { training: [], nutrition: [] };
  const dates = range(from, to);
  const trainingActivations = await repository.activations(c, 'training_activations', clientId);
  const nutritionActivations = await repository.activations(c, 'nutrition_activations', clientId);
  const sessions = new Map((await repository.sessionsBetween(c, clientId, from, to)).map((s) => [s.localDate, s]));
  const training: (AdherenceState | null)[] = [];
  const nutrition: (AdherenceState | null)[] = [];
  for (const date of dates) {
    const versionId = repository.inForce(trainingActivations, date);
    if (versionId) {
      const plan = versions.get(versionId) ?? (await trainingVersion(c, versionId));
      versions.set(versionId, plan);
      const done = sessions.get(date);
      // A recorded session proves the day applied even if the schedule changed later.
      if (done || scheduledDay(plan, date)?.kind === 'training') training.push(done ? sessionState(done.status, done.performed, done.recorded) : null);
    }
    if (repository.inForce(nutritionActivations, date)) {
      const state = checkIns.find((r) => r.localDate === date)?.nutritionCompliance;
      nutrition.push(state && EXPLICIT.includes(state) ? (state as AdherenceState) : null);
    }
  }
  return { training, nutrition };
}

/** Training and nutrition adherence of a period, computed apart (no global score). */
async function adherence(
  c: PoolClient,
  clientId: string,
  from: string,
  to: string,
  checkIns: CheckIn[],
  versions = new Map<string, TrainingVersion>(),
) {
  const days = await adherenceDays(c, clientId, from, to, checkIns, versions);
  return { training: summarize(days.training), nutrition: summarize(days.nutrition) };
}

async function buildSessions(
  c: PoolClient,
  clientId: string,
  from: string,
  to: string,
  versions: Map<string, TrainingVersion>,
): Promise<FollowUpSession[]> {
  const rawSessions = await repository.sessionDetailsBetween(c, clientId, from, to);
  const result: FollowUpSession[] = [];
  for (const s of rawSessions) {
    const plan = versions.get(s.versionId) ?? (await trainingVersion(c, s.versionId));
    versions.set(s.versionId, plan);
    const day = plan.days.find((d) => d.id === s.dayId);
    const bySet = new Map(s.results.map((r) => [r.setId, r]));
    const exercises = (day?.exercises ?? []).map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      loadMode: exercise.loadMode,
      sets: exercise.sets.map((set, index) => {
        const res = bySet.get(set.id);
        return {
          setId: set.id,
          ordinal: index + 1,
          prescribedReps: set.reps,
          prescribedRepsMax: set.repsMax ?? null,
          targetLoadKg: set.targetLoadKg ?? null,
          state: res?.state ?? null,
          reps: res?.reps ?? null,
          loadKg: res?.loadKg ?? null,
          unit: (exercise.loadMode === 'bodyweight' ? 'bodyweight' : 'kg') as 'kg' | 'bodyweight',
          rpe: res?.rpe ?? null,
          rir: res?.rir ?? null,
        };
      }),
    }));
    const totalSets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
    const performedSets = s.results.filter((r) => r.state === 'performed').length;
    result.push({
      id: s.id,
      localDate: s.localDate,
      timeZone: s.timeZone,
      status: s.status,
      versionId: s.versionId,
      versionNumber: plan.number,
      routineName: plan.name,
      dayName: day?.name ?? 'Entrenamiento',
      performedSets,
      totalSets,
      exercises,
    });
  }
  return result;
}

function period(query: unknown, today: string) {
  const q = validate.object(query, ['from', 'to', 'days']);
  if (q.days !== undefined) {
    if (q.from !== undefined || q.to !== undefined)
      validate.invalid('Usa un periodo en días o un rango de fechas, no ambos.');
    const days = validate.daysParam(q.days);
    return { from: shiftDate(today, 1 - days), to: today };
  }
  const to = q.to === undefined ? today : validate.date(q.to);
  const from = q.from === undefined ? shiftDate(to, -27) : validate.date(q.from);
  const span = calendarDistance(to, from);
  if (span < 0 || span > 365) validate.invalid('El periodo debe tener entre 1 y 366 días.');
  return { from, to };
}

/** HU-033: check-ins, sessions, body weight and adherence of one client of the portfolio. */
export function getFollowUp(pool: Pool, identity: SessionIdentity, clientId: string, query: unknown, now: Date) {
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, clientId);
    const today = localDate(now, s.timeZone);
    const { from, to } = period(query, today);
    const checkIns = await repository.between(c, s.clientId, from, to);
    const versions = new Map<string, TrainingVersion>();
    return {
      clientId: s.clientId,
      from,
      to,
      today,
      timeZone: s.timeZone,
      checkIns,
      bodyWeight: checkIns.filter((r) => r.bodyWeightKg !== null).map(weightEntry),
      sessions: await buildSessions(c, s.clientId, from, to, versions),
      adherence: await adherence(c, s.clientId, from, to < today ? to : today, checkIns, versions),
      visibility: await repository.visibility(c, s.clientId),
    };
  });
}

/** HU-034: 7-day portfolio adherence reused directly from DEC-008 logic, excluding inactive clients. */
export function getPortfolioSummary(pool: Pool, identity: SessionIdentity, now: Date) {
  return read(pool, identity, async (c) => {
    const clients = await repository.activePortfolioClients(c, identity);
    const versions = new Map<string, TrainingVersion>();
    const allTraining: (AdherenceState | null)[] = [];
    const allNutrition: (AdherenceState | null)[] = [];
    for (const client of clients) {
      const to = localDate(now, client.timeZone);
      const from = shiftDate(to, -6);
      const checkIns = await repository.between(c, client.clientId, from, to);
      const days = await adherenceDays(c, client.clientId, from, to, checkIns, versions);
      allTraining.push(...days.training);
      allNutrition.push(...days.nutrition);
    }
    return {
      days: 7,
      activeClients: clients.length,
      adherence: {
        training: summarize(allTraining),
        nutrition: summarize(allNutrition),
      },
    };
  });
}

/** Record section: latest body weights from check-ins (HU-037 connected to HU-019). */
export function getBodyWeightHistory(pool: Pool, identity: SessionIdentity, clientId: string) {
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, clientId);
    return (await repository.latestWeights(c, s.clientId, 10)).map(weightEntry);
  });
}

export async function changeVisibility(pool: Pool, identity: SessionIdentity, clientId: string, key: unknown, body: unknown, now: Date) {
  const input = validate.visibility(body);
  return mutate(pool, identity, validate.uuid(key), `visibility:${clientId}`, body, now, async (c) => {
    const s = await repository.scope(c, identity, clientId, true);
    return { visibility: await repository.setVisibility(c, identity, s.clientId, input, input.revision, now) };
  });
}

/**
 * HU-036 aggregate: the client always sees what it entered (check-ins and
 * weight); categories produced by the professional are omitted unless shared.
 */
export function getOwnProgress(pool: Pool, identity: SessionIdentity, query: unknown, now: Date) {
  const q = validate.object(query, ['days']);
  const days = validate.daysParam(q.days, 28);
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, null);
    const today = localDate(now, s.timeZone);
    const shared = await repository.visibility(c, s.clientId);
    const from = shiftDate(today, 1 - days);
    const checkIns = await repository.between(c, s.clientId, from, today);
    return {
      today,
      visibility: { measurements: shared.measurements, adherence: shared.adherence },
      ...(shared.measurements ? { measurements: await repository.measurements(c, s.clientId) } : {}),
      ...(shared.adherence ? { adherence: { from, to: today, ...(await adherence(c, s.clientId, from, today, checkIns)) } } : {}),
    };
  });
}

/** Dedicated resource: 403 without payload when the category is not shared. */
export function getOwnMeasurements(pool: Pool, identity: SessionIdentity) {
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, null);
    if (!(await repository.visibility(c, s.clientId)).measurements) return repository.denied();
    return { measurements: await repository.measurements(c, s.clientId) };
  });
}

/** Dedicated resource: 403 without payload when adherence is not shared. */
export function getOwnAdherence(pool: Pool, identity: SessionIdentity, query: unknown, now: Date) {
  const q = validate.object(query, ['days']);
  const days = validate.daysParam(q.days, 28);
  return read(pool, identity, async (c) => {
    const s = await repository.scope(c, identity, null);
    if (!(await repository.visibility(c, s.clientId)).adherence) return repository.denied();
    const today = localDate(now, s.timeZone);
    const from = shiftDate(today, 1 - days);
    const checkIns = await repository.between(c, s.clientId, from, today);
    return { from, to: today, ...(await adherence(c, s.clientId, from, today, checkIns)) };
  });
}

import type { AdherenceState, AdherenceSummary } from '../types/follow-up.js';

const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((100 * part) / whole);

/**
 * DEC-008: one entry per applicable day (rest and days without plan are left
 * out by the caller); null = applicable without explicit state. completed
 * weighs 1, partial 0.5 and not_completed 0. No global score is computed.
 */
export function summarize(days: (AdherenceState | null)[]): AdherenceSummary {
  const count = (state: AdherenceState) => days.filter((d) => d === state).length;
  const completed = count('completed'),
    partial = count('partial'),
    notCompleted = count('not_completed');
  const recordedDays = completed + partial + notCompleted;
  return {
    applicableDays: days.length,
    recordedDays,
    completed,
    partial,
    notCompleted,
    observedPercent: percent(completed + partial / 2, recordedDays),
    coveragePercent: percent(recordedDays, days.length),
  };
}

/** Finalized session state from its set results; a draft is no data. */
export function sessionState(status: string, performed: number, recorded: number): AdherenceState | null {
  if (status !== 'finalized' || recorded === 0) return null;
  return performed === recorded ? 'completed' : performed > 0 ? 'partial' : 'not_completed';
}

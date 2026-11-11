import { sessionRequest } from '../../auth/services/session';
import type { ProfessionalRecord } from '../types/record';
import { isVersion } from '../../training/services/training';
import { isEvaluation } from '../../evaluations/types/evaluation';

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export async function fetchProfessionalRecord(
  clientId: string
): Promise<ProfessionalRecord> {
  const payload = await sessionRequest<{ record: unknown }>(
    `/api/clients/${encodeURIComponent(clientId)}/record`
  );
  const record = payload.record;
  if (
    !object(record) ||
    !object(record.profile) ||
    record.profile.id !== clientId ||
    typeof record.profile.fullName !== 'string' ||
    !object(record.sections)
  )
    throw new Error('Invalid record response');
  for (const key of [
    'nutritionPlan',
    'trainingPlan',
    'evaluations',
    'progress',
    'bodyWeightHistory',
  ]) {
    const section = record.sections[key];
    if (
      key === 'evaluations' &&
      object(section) &&
      section.status === 'available'
    ) {
      if (
        !Array.isArray(section.evaluations) ||
        section.evaluations.length > 20 ||
        !section.evaluations.every((item) => isEvaluation(item, clientId))
      )
        throw new Error('Invalid evaluation section');
      continue;
    }
    if (
      key === 'trainingPlan' &&
      object(section) &&
      section.status === 'available'
    ) {
      if (
        !isVersion(section.plan) ||
        section.plan.clientId !== clientId ||
        typeof section.activeRevision !== 'number'
      )
        throw new Error('Invalid training section');
      // Optional complement: a malformed summary is dropped, never trusted.
      const activity = section.activity;
      if (
        !object(activity) ||
        !(
          activity.lastSession === null ||
          typeof activity.lastSession === 'string'
        ) ||
        !['sessionsLast7', 'sessionsLast30', 'setsLast30'].every((field) =>
          Number.isInteger(activity[field])
        )
      )
        section.activity = null;
      continue;
    }
    if (
      !object(section) ||
      !(key === 'evaluations'
        ? ['empty', 'error'].includes(String(section.status))
        : ['not_integrated', 'empty', 'error'].includes(
            String(section.status)
          )) ||
      (section.status === 'error' && section.code !== 'QUERY_FAILED')
    )
      throw new Error('Invalid record section');
  }
  return record as unknown as ProfessionalRecord;
}

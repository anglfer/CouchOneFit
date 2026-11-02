import { sessionRequest } from '../../auth/services/session';
import type { ProfessionalRecord } from '../types/record';

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
      !object(section) ||
      !['not_integrated', 'empty', 'error'].includes(String(section.status)) ||
      (section.status === 'error' && section.code !== 'QUERY_FAILED')
    )
      throw new Error('Invalid record section');
  }
  return record as unknown as ProfessionalRecord;
}

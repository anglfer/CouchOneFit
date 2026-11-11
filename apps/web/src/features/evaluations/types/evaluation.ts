import type { Assessment } from './assessment';
export const EVALUATION_FIELDS = [
  ['weightKg', 'Peso', 'kg', 30, 300],
  ['waistCm', 'Cintura', 'cm', 40, 250],
  ['hipCm', 'Cadera', 'cm', 50, 250],
  ['measuredBodyFatPercentage', 'Grasa corporal medida', '%', 2, 60],
  ['pectoralSkinfoldMm', 'Pliegue pectoral', 'mm', 1, 80],
  ['abdominalSkinfoldMm', 'Pliegue abdominal', 'mm', 1, 80],
  ['tricepsSkinfoldMm', 'Pliegue tricipital', 'mm', 1, 80],
  ['suprailiacSkinfoldMm', 'Pliegue suprailiaco', 'mm', 1, 80],
  ['thighSkinfoldMm', 'Pliegue de muslo', 'mm', 1, 80],
] as const;

export type EvaluationField = (typeof EVALUATION_FIELDS)[number][0];
export type EvaluationMeasurements = Partial<Record<EvaluationField, number>>;
export interface Evaluation extends Record<EvaluationField, number | null> {
  assessment?: Assessment;
  id: string;
  clientId: string;
  evaluationDate: string;
  createdAt: string;
}

export function isEvaluation(
  value: unknown,
  clientId?: string
): value is Evaluation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string' ||
    typeof item.clientId !== 'string' ||
    (clientId !== undefined && item.clientId !== clientId) ||
    typeof item.evaluationDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(item.evaluationDate) ||
    typeof item.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(item.createdAt))
  )
    return false;
  if (item.assessment !== undefined) {
    const a = item.assessment;
    if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
    const snapshot = a as Record<string, unknown>;
    if (
      !['perimetros', 'pliegues', 'bioimpedancia'].includes(
        String(snapshot.method)
      ) ||
      typeof snapshot.effectiveDate !== 'string' ||
      typeof snapshot.version !== 'string' ||
      !['available', 'partial', 'pending_verification'].includes(
        String(snapshot.calculationStatus)
      )
    )
      return false;
    for (const key of ['measurements', 'results']) {
      const values = snapshot[key];
      if (
        !values ||
        typeof values !== 'object' ||
        Array.isArray(values) ||
        Object.values(values).some(
          (v) => typeof v !== 'number' || !Number.isFinite(v)
        )
      )
        return false;
    }
  }
  return EVALUATION_FIELDS.every(
    ([field]) =>
      item[field] === null ||
      (typeof item[field] === 'number' && Number.isFinite(item[field]))
  );
}

export type EvaluationSection =
  | { status: 'empty' }
  | { status: 'available'; evaluations: Evaluation[] }
  | { status: 'error'; code: 'QUERY_FAILED' };

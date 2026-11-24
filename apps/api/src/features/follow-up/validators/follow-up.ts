import { AuthError } from '../../auth/types/errors.js';
import { COMPLIANCE, type CheckInValues, type Compliance } from '../types/follow-up.js';

export const invalid = (message = 'Revisa los datos del check-in.'): never => {
  throw new AuthError(400, 'INVALID_CHECK_IN', message);
};

export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key)))
    return invalid('El formulario contiene campos no permitidos.');
  return record;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) return invalid('Identificador inválido.');
  return value.toLowerCase();
}

// The header is a client-integration error, not a bad record identifier.
export function idempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value))
    return invalid('Falta la clave de idempotencia (Idempotency-Key) o no es válida.');
  return value.toLowerCase();
}

export function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('Fecha inválida.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalid('Fecha inválida.');
  return value;
}

export function integer(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) return invalid();
  return value as number;
}

/** Absent or null means "not reported", never zero (DEC-006). Strings are not coerced. */
function optional(value: unknown, minimum: number, maximum: number, step: number, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || Math.abs(value / step - Math.round(value / step)) > 1e-7)
    return invalid(`${label} debe estar entre ${minimum} y ${maximum}${step < 1 ? ` en pasos de ${step}` : ''}.`);
  return value;
}

export const offset = (value: unknown) =>
  value === undefined ? 0 : typeof value === 'string' && /^\d{1,6}$/.test(value) ? Number(value) : invalid();

export function daysParam(value: unknown, fallback = 28): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d{1,3}$/.test(value))
    return invalid('El periodo debe tener entre 1 y 366 días.');
  const days = Number(value);
  if (days < 1 || days > 366)
    return invalid('El periodo debe tener entre 1 y 366 días.');
  return days;
}

export function checkIn(body: unknown): { id: string; localDate: string; revision: number; values: CheckInValues } {
  const input = object(body, ['id', 'localDate', 'revision', 'bodyWeightKg', 'sleepHours', 'stress', 'energy', 'hunger', 'nutritionCompliance', 'comment']);
  const compliance = input.nutritionCompliance;
  if (compliance !== undefined && compliance !== null && !COMPLIANCE.includes(compliance as Compliance))
    return invalid('Cumplimiento alimenticio inválido.');
  const comment = input.comment;
  if (comment !== undefined && comment !== null && typeof comment !== 'string') return invalid();
  const text = typeof comment === 'string' && comment.trim() ? comment.trim() : null;
  if (text && text.length > 500) return invalid('El comentario admite hasta 500 caracteres.');
  const values: CheckInValues = {
    bodyWeightKg: optional(input.bodyWeightKg, 30, 300, 0.1, 'El peso corporal (kg)'),
    sleepHours: optional(input.sleepHours, 0, 24, 0.5, 'El sueño (horas)'),
    stress: optional(input.stress, 1, 5, 1, 'El estrés'),
    energy: optional(input.energy, 1, 5, 1, 'La energía'),
    hunger: optional(input.hunger, 1, 5, 1, 'El hambre'),
    nutritionCompliance: (compliance ?? null) as Compliance | null,
    comment: text,
  };
  const hasExplicitCompliance =
    values.nutritionCompliance !== null &&
    values.nutritionCompliance !== 'not_applicable';
  const hasMetricOrComment = [
    values.bodyWeightKg,
    values.sleepHours,
    values.stress,
    values.energy,
    values.hunger,
    values.comment,
  ].some((value) => value !== null);
  if (!hasMetricOrComment && !hasExplicitCompliance)
    return invalid('Registra al menos un dato real: peso, sueño, estrés, energía, hambre, alimentación o comentario.');
  return { id: uuid(input.id), localDate: date(input.localDate), revision: integer(input.revision, 0, 2147483646), values };
}

export function visibility(body: unknown) {
  const input = object(body, ['measurements', 'adherence', 'revision']);
  if (typeof input.measurements !== 'boolean' || typeof input.adherence !== 'boolean') return invalid('Indica qué información compartir.');
  return { measurements: input.measurements, adherence: input.adherence, revision: integer(input.revision, 0, 2147483646) };
}

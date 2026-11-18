import { AuthError } from '../../auth/types/errors.js';
import type { NutritionDocument, NutritionMeal, NutritionItem } from '../types/nutrition.js';

export const invalid = (message = 'Revisa los parámetros del plan nutricional.'): never => {
  throw new AuthError(400, 'INVALID_NUTRITION', message);
};

export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) {
    return invalid('El formulario contiene campos no permitidos.');
  }
  return record;
}

export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return invalid('Identificador inválido.');
  }
  return value.toLowerCase();
}

export function text(value: unknown, maximum = 500, required = false): string {
  if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim())) {
    return invalid();
  }
  return value.trim();
}

export function number(value: unknown, minimum: number, maximum: number, step = 1): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    Math.abs(value / step - Math.round(value / step)) > 1e-7
  ) {
    return invalid();
  }
  return value;
}

export function optional(value: unknown, minimum: number, maximum: number, step = 1): number | null {
  return value === undefined || value === null ? null : number(value, minimum, maximum, step);
}

export function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid();
  return value;
}

export function nutritionDocument(value: unknown): NutritionDocument {
  const input = object(value, [
    'name',
    'meals',
    'caloriesTarget',
    'proteinTargetG',
    'carbsTargetG',
    'fatTargetG',
    'revision',
  ]);
  const ids = new Set<string>();

  const uniqueId = (raw: unknown) => {
    const id = uuid(raw);
    if (ids.has(id)) return invalid('Cada comida y alimento requiere un identificador distinto.');
    ids.add(id);
    return id;
  };

  const meals = array(input.meals, 12).map((rawMeal) => {
    const m = object(rawMeal, ['id', 'name', 'instructions', 'items']);
    const items = array(m.items, 30).map((rawItem) => {
      const i = object(rawItem, ['id', 'name', 'quantity', 'unit', 'instructions']);
      return {
        id: uniqueId(i.id),
        name: text(i.name, 150, true),
        quantity: number(i.quantity, 0, 10000, 0.1),
        unit: text(i.unit, 50, true),
        instructions: i.instructions === null || i.instructions === undefined ? null : text(i.instructions, 1000),
      } as NutritionItem;
    });

    return {
      id: uniqueId(m.id),
      name: text(m.name, 100, true),
      instructions: m.instructions === null || m.instructions === undefined ? null : text(m.instructions, 2000),
      items,
    } as NutritionMeal;
  });

  return {
    name: text(input.name, 150, true),
    meals,
    caloriesTarget: optional(input.caloriesTarget, 0, 10000),
    proteinTargetG: optional(input.proteinTargetG, 0, 1000),
    carbsTargetG: optional(input.carbsTargetG, 0, 1000),
    fatTargetG: optional(input.fatTargetG, 0, 1000),
  };
}

export function validateActivation(value: unknown): { expectedActiveRevision: number } {
  if (value === undefined || value === null || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return { expectedActiveRevision: 0 };
  }
  const input = object(value, ['expectedActiveRevision']);
  return {
    expectedActiveRevision:
      input.expectedActiveRevision === undefined ? 0 : number(input.expectedActiveRevision, 0, 1000000),
  };
}
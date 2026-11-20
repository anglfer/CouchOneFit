import { AuthError } from '../../auth/types/errors.js';
import type {
  NutritionActivityLevel,
  NutritionBmrFormula,
  NutritionDayTargets,
  NutritionDocument,
  NutritionExperience,
  NutritionGoal,
  NutritionItem,
  NutritionMacroPreference,
  NutritionMeal,
  NutritionMealCategory,
  NutritionNeatLevel,
  NutritionPace,
  NutritionPeriWorkout,
  NutritionSex,
  NutritionSuggestionInput,
  NutritionSuggestionMeta,
} from '../types/nutrition.js';

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

export function optionalText(value: unknown, maximum = 500): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = text(value, maximum, false);
  return trimmed ? trimmed : null;
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

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fieldLabel: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return invalid(`Valor no válido para ${fieldLabel}.`);
  }
  return value as T;
}

function booleanField(value: unknown, fieldLabel: string): boolean {
  if (typeof value !== 'boolean') {
    return invalid(`Valor no válido para ${fieldLabel}.`);
  }
  return value;
}

const MEAL_CATEGORIES: readonly NutritionMealCategory[] = [
  'breakfast',
  'morning_snack',
  'lunch',
  'pre_workout',
  'post_workout',
  'afternoon_snack',
  'dinner',
  'pre_bed',
  'other',
];

const SEX_VALUES: readonly NutritionSex[] = ['male', 'female'];
const GOAL_VALUES: readonly NutritionGoal[] = ['fat_loss', 'muscle_gain', 'recomposition', 'maintenance'];
const PACE_VALUES: readonly NutritionPace[] = ['slow', 'normal', 'fast'];
const EXPERIENCE_VALUES: readonly NutritionExperience[] = ['beginner', 'intermediate', 'advanced'];
const ACTIVITY_VALUES: readonly NutritionActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'very_active',
];
const NEAT_VALUES: readonly NutritionNeatLevel[] = ['low', 'medium', 'high'];
const PREFERENCE_VALUES: readonly NutritionMacroPreference[] = [
  'balanced',
  'higher_carbs',
  'higher_fat',
];
const FORMULA_VALUES: readonly NutritionBmrFormula[] = ['mifflin', 'katch_mcardle'];

function validateDayTargets(value: unknown): NutritionDayTargets | null {
  if (value === undefined || value === null) return null;
  const input = object(value, ['caloriesTarget', 'proteinTargetG', 'carbsTargetG', 'fatTargetG']);
  return {
    caloriesTarget: number(input.caloriesTarget, 0, 15000),
    proteinTargetG: number(input.proteinTargetG, 0, 1000),
    carbsTargetG: number(input.carbsTargetG, 0, 1500),
    fatTargetG: number(input.fatTargetG, 0, 1000),
  };
}

function validatePeriWorkout(value: unknown): NutritionPeriWorkout | null {
  if (value === undefined || value === null) return null;
  const input = object(value, [
    'preCarbsG',
    'preProteinG',
    'preFatG',
    'postCarbsG',
    'postProteinG',
    'postFatG',
    'intraCarbsG',
    'notes',
  ]);
  return {
    preCarbsG: number(input.preCarbsG, 0, 1000),
    preProteinG: number(input.preProteinG, 0, 500),
    preFatG: number(input.preFatG, 0, 200),
    postCarbsG: number(input.postCarbsG, 0, 1000),
    postProteinG: number(input.postProteinG, 0, 500),
    postFatG: number(input.postFatG, 0, 200),
    intraCarbsG: number(input.intraCarbsG, 0, 500),
    notes: optionalText(input.notes, 1000),
  };
}

function validateSuggestionMeta(value: unknown): NutritionSuggestionMeta | null {
  if (value === undefined || value === null) return null;
  const input = object(value, [
    'engineVersion',
    'formula',
    'goal',
    'pace',
    'bmr',
    'tdee',
    'adjustmentPct',
    'baselineWeightKg',
    'baselineBodyFatPct',
    'generatedAt',
    'modifiedByProfessional',
    'restrictions',
  ]);
  return {
    engineVersion: text(input.engineVersion, 50, true),
    formula: oneOf(input.formula, FORMULA_VALUES, 'fórmula'),
    goal: oneOf(input.goal, GOAL_VALUES, 'objetivo'),
    pace: oneOf(input.pace, PACE_VALUES, 'ritmo'),
    bmr: number(input.bmr, 400, 6000),
    tdee: number(input.tdee, 500, 10000),
    adjustmentPct: number(input.adjustmentPct, -50, 50, 0.1),
    baselineWeightKg: number(input.baselineWeightKg, 20, 400, 0.1),
    baselineBodyFatPct: optional(input.baselineBodyFatPct, 2, 75, 0.1),
    generatedAt: text(input.generatedAt, 40, true),
    modifiedByProfessional: booleanField(input.modifiedByProfessional, 'edición profesional'),
    restrictions: input.restrictions === undefined ? [] : array(input.restrictions, 10).map((r) => text(r, 60, true)),
  };
}

export function nutritionDocument(value: unknown): NutritionDocument {
  const input = object(value, [
    'name',
    'meals',
    'caloriesTarget',
    'proteinTargetG',
    'carbsTargetG',
    'fatTargetG',
    'generalInstructions',
    'fiberTargetG',
    'hydrationTargetMl',
    'restDayTargets',
    'periWorkout',
    'suggestionMeta',
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
    const m = object(rawMeal, [
      'id',
      'name',
      'instructions',
      'scheduleTime',
      'category',
      'targetCalories',
      'targetProteinG',
      'targetCarbsG',
      'targetFatG',
      'items',
    ]);
    const items = array(m.items, 30).map((rawItem) => {
      const i = object(rawItem, [
        'id',
        'name',
        'quantity',
        'unit',
        'instructions',
        'foodGroup',
        'substitutes',
        'calories',
        'proteinG',
        'carbsG',
        'fatG',
      ]);
      return {
        id: uniqueId(i.id),
        name: text(i.name, 150, true),
        quantity: number(i.quantity, 0, 10000, 0.1),
        unit: text(i.unit, 50, true),
        instructions: optionalText(i.instructions, 1000),
        foodGroup: optionalText(i.foodGroup, 60),
        substitutes: optionalText(i.substitutes, 500),
        calories: optional(i.calories, 0, 10000, 0.1),
        proteinG: optional(i.proteinG, 0, 1000, 0.1),
        carbsG: optional(i.carbsG, 0, 1500, 0.1),
        fatG: optional(i.fatG, 0, 1000, 0.1),
      } as NutritionItem;
    });

    const category =
      m.category === undefined || m.category === null
        ? null
        : oneOf(m.category, MEAL_CATEGORIES, 'categoría de comida');

    return {
      id: uniqueId(m.id),
      name: text(m.name, 100, true),
      instructions: optionalText(m.instructions, 2000),
      scheduleTime: optionalText(m.scheduleTime, 40),
      category,
      targetCalories: optional(m.targetCalories, 0, 10000),
      targetProteinG: optional(m.targetProteinG, 0, 500),
      targetCarbsG: optional(m.targetCarbsG, 0, 1000),
      targetFatG: optional(m.targetFatG, 0, 500),
      items,
    } as NutritionMeal;
  });

  return {
    name: text(input.name, 150, true),
    meals,
    caloriesTarget: optional(input.caloriesTarget, 0, 15000),
    proteinTargetG: optional(input.proteinTargetG, 0, 1000),
    carbsTargetG: optional(input.carbsTargetG, 0, 1500),
    fatTargetG: optional(input.fatTargetG, 0, 1000),
    generalInstructions: optionalText(input.generalInstructions, 3000),
    fiberTargetG: optional(input.fiberTargetG, 0, 150),
    hydrationTargetMl: optional(input.hydrationTargetMl, 0, 10000),
    restDayTargets: validateDayTargets(input.restDayTargets),
    periWorkout: validatePeriWorkout(input.periWorkout),
    suggestionMeta: validateSuggestionMeta(input.suggestionMeta),
  };
}

export function validateSuggestionInput(value: unknown): NutritionSuggestionInput {
  const input = object(value, [
    'sex',
    'ageYears',
    'weightKg',
    'heightCm',
    'bodyFatPct',
    'formula',
    'activityLevel',
    'neatLevel',
    'experience',
    'goal',
    'pace',
    'trainingDaysPerWeek',
    'sessionDurationMin',
    'macroPreference',
    'enableCarbCycling',
    'restrictions',
    'customAdjustmentPct',
    'customProteinPerKg',
  ]);

  const formula = oneOf(input.formula, FORMULA_VALUES, 'fórmula');
  const bodyFatPct = optional(input.bodyFatPct, 3, 65, 0.1);
  if (formula === 'katch_mcardle' && bodyFatPct === null) {
    return invalid('La fórmula Katch-McArdle requiere capturar el porcentaje de grasa corporal.');
  }

  const rawRestrictions =
    input.restrictions === undefined ? [] : array(input.restrictions, 10);
  const restrictions = rawRestrictions.map((r) => text(r, 60, true));

  return {
    sex: oneOf(input.sex, SEX_VALUES, 'sexo de cálculo'),
    ageYears: number(input.ageYears, 16, 100),
    weightKg: number(input.weightKg, 30, 300, 0.1),
    heightCm: number(input.heightCm, 100, 250, 0.1),
    bodyFatPct,
    formula,
    activityLevel: oneOf(input.activityLevel, ACTIVITY_VALUES, 'nivel de actividad'),
    neatLevel: oneOf(input.neatLevel, NEAT_VALUES, 'nivel de actividad diaria (NEAT)'),
    experience: oneOf(input.experience, EXPERIENCE_VALUES, 'experiencia'),
    goal: oneOf(input.goal, GOAL_VALUES, 'objetivo'),
    pace: oneOf(input.pace, PACE_VALUES, 'ritmo'),
    trainingDaysPerWeek: number(input.trainingDaysPerWeek, 1, 7),
    sessionDurationMin: number(input.sessionDurationMin, 20, 180),
    macroPreference: oneOf(input.macroPreference, PREFERENCE_VALUES, 'preferencia de macros'),
    enableCarbCycling: booleanField(input.enableCarbCycling, 'ciclado de carbohidratos'),
    restrictions,
    customAdjustmentPct: optional(input.customAdjustmentPct, -35, 35, 0.1),
    customProteinPerKg: optional(input.customProteinPerKg, 0.8, 3.5, 0.1),
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

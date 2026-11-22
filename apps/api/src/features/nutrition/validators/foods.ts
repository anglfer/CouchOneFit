import type { NutritionMealCategory } from '../types/nutrition.js';
import {
  FOOD_GROUPS,
  FOOD_RESTRICTIONS,
  type FoodIngredient,
  type ProfessionalFoodInput,
} from '../types/foods.js';
import { array, invalid, number, object, optionalText, text } from './nutrition.js';

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

const FIELDS = [
  'name',
  'group',
  'kind',
  'basis',
  'defaultUnit',
  'defaultQuantity',
  'calories',
  'proteinG',
  'carbsG',
  'fatG',
  'preparation',
  'substitutes',
  'ingredients',
  'servings',
  'suitableFor',
  'mealCategories',
];

const round1 = (value: number) => Math.round(value * 10) / 10;

function pick<T extends string>(value: unknown, allowed: readonly T[], message: string): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : invalid(message);
}

function set<T extends string>(value: unknown, allowed: readonly T[], message: string): T[] {
  if (value === undefined || value === null) return [];
  const list = array(value, allowed.length).map((entry) => pick(entry, allowed, message));
  return [...new Set(list)];
}

function ingredient(value: unknown): FoodIngredient {
  const i = object(value, ['name', 'quantity', 'unit', 'calories', 'proteinG', 'carbsG', 'fatG']);
  return {
    name: text(i.name, 150, true),
    quantity: number(i.quantity, 0.1, 10000, 0.1),
    unit: text(i.unit, 50, true),
    calories: number(i.calories, 0, 10000, 0.1),
    proteinG: number(i.proteinG, 0, 1000, 0.1),
    carbsG: number(i.carbsG, 0, 1500, 0.1),
    fatG: number(i.fatG, 0, 1000, 0.1),
  };
}

/** Valida un alimento o receta propia. Las recetas calculan sus macros por porción en el servidor. */
export function validateFood(value: unknown): ProfessionalFoodInput {
  return parseFood(object(value, FIELDS));
}

export function validateFoodUpdate(value: unknown): { food: ProfessionalFoodInput; revision: number } {
  const f = object(value, [...FIELDS, 'revision']);
  return { food: parseFood(f), revision: number(f.revision, 1, 2147483647, 1) };
}

function parseFood(f: Record<string, unknown>): ProfessionalFoodInput {
  const kind = pick(f.kind, ['food', 'recipe'] as const, 'Elige si es un alimento o una receta.');
  const common = {
    name: text(f.name, 120, true),
    group: pick(f.group, FOOD_GROUPS, 'Elige un grupo de alimentos válido.'),
    kind,
    preparation: optionalText(f.preparation, 2000),
    substitutes: optionalText(f.substitutes, 300),
    suitableFor: set(f.suitableFor, FOOD_RESTRICTIONS, 'Restricción alimentaria no válida.'),
    mealCategories: set(f.mealCategories, MEAL_CATEGORIES, 'Tiempo de comida no válido.'),
  };

  if (kind === 'recipe') {
    const ingredients = array(f.ingredients, 40).map(ingredient);
    if (ingredients.length === 0) return invalid('Agrega al menos un ingrediente a la receta.');
    const servings = number(f.servings, 1, 50, 1);
    const per = (key: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
      round1(ingredients.reduce((sum, item) => sum + item[key], 0) / servings);
    const macros = { calories: per('calories'), proteinG: per('proteinG'), carbsG: per('carbsG'), fatG: per('fatG') };
    if (macros.calories > 5000 || Math.max(macros.proteinG, macros.carbsG, macros.fatG) > 500)
      return invalid('Cada porción supera los límites; aumenta el número de porciones.');
    return {
      ...common,
      ...macros,
      basis: 'per_unit',
      defaultUnit: 'porción',
      defaultQuantity: 1,
      ingredients,
      servings,
    };
  }

  if (f.ingredients != null || f.servings != null) return invalid('Solo las recetas llevan ingredientes y porciones.');
  const basis = pick(f.basis, ['per_100', 'per_unit'] as const, 'Indica si los valores son por 100 g/ml o por pieza.');
  const per100 = basis === 'per_100';
  const food = {
    ...common,
    basis,
    defaultUnit: text(f.defaultUnit, 20, true),
    defaultQuantity: number(f.defaultQuantity, 0.1, 5000, 0.1),
    calories: number(f.calories, 0, per100 ? 900 : 5000, 0.1),
    proteinG: number(f.proteinG, 0, per100 ? 100 : 500, 0.1),
    carbsG: number(f.carbsG, 0, per100 ? 100 : 500, 0.1),
    fatG: number(f.fatG, 0, per100 ? 100 : 500, 0.1),
    ingredients: null,
    servings: null,
  };
  if (per100 && food.proteinG + food.carbsG + food.fatG > 100)
    return invalid('En 100 g, proteína + carbohidratos + grasa no pueden sumar más de 100 g.');
  return food;
}

export function validateRevision(value: unknown): number {
  return number(object(value, ['revision']).revision, 1, 2147483647, 1);
}

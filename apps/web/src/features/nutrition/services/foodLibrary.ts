import { sessionMutation, sessionRequest } from '../../auth/services/session';
import type { OwnFood, OwnFoodInput } from '../types/foodLibrary';
import { setOwnFoods, type CatalogFood } from '../utils/foodCatalog';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v: unknown) => v === null || typeof v === 'string';
const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isList = (v: unknown) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

function isOwnFood(v: unknown): v is OwnFood {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.group === 'string' &&
    (v.kind === 'food' || v.kind === 'recipe') &&
    (v.basis === 'per_100' || v.basis === 'per_unit') &&
    typeof v.defaultUnit === 'string' &&
    ['defaultQuantity', 'calories', 'proteinG', 'carbsG', 'fatG', 'revision']
      .map((key) => v[key])
      .every(isNumber) &&
    isText(v.preparation) &&
    isText(v.substitutes) &&
    (v.ingredients === null ||
      (Array.isArray(v.ingredients) &&
        v.ingredients.every(
          (i) =>
            isRecord(i) &&
            typeof i.name === 'string' &&
            typeof i.unit === 'string' &&
            ['quantity', 'calories', 'proteinG', 'carbsG', 'fatG'].every((k) =>
              isNumber(i[k])
            )
        ))) &&
    (v.servings === null || isNumber(v.servings)) &&
    isList(v.suitableFor) &&
    isList(v.mealCategories)
  );
}

function parse(v: unknown): OwnFood {
  if (!isOwnFood(v)) throw new Error('El alimento llegó incompleto.');
  return v;
}

/** The shape the plan editor, picker and suggestions already understand. */
export const toCatalogFood = (food: OwnFood): CatalogFood => ({
  id: `own:${food.id}`,
  name: food.name,
  group: food.group,
  synonyms: [],
  defaultUnit: food.defaultUnit,
  defaultQuantity: food.defaultQuantity,
  basis: food.basis,
  calories: food.calories,
  proteinG: food.proteinG,
  carbsG: food.carbsG,
  fatG: food.fatG,
  preparationHint: food.preparation ?? '',
  defaultSubstitutes: food.substitutes ?? '',
  own: {
    kind: food.kind,
    suitableFor: food.suitableFor,
    mealCategories: food.mealCategories,
  },
});

/** Reads the library (cached for offline reading) and makes it available to the plan editor. */
export async function readOwnFoods(): Promise<OwnFood[]> {
  const body = await sessionRequest<unknown>('/api/nutrition/foods');
  if (!isRecord(body) || !Array.isArray(body.foods))
    throw new Error('Tu biblioteca de alimentos llegó incompleta.');
  const foods = body.foods.map(parse);
  setOwnFoods(foods.map(toCatalogFood));
  return foods;
}

export const createOwnFood = async (input: OwnFoodInput) =>
  parse(await sessionMutation<unknown>('/api/nutrition/foods', input));

export const updateOwnFood = async (food: OwnFood, input: OwnFoodInput) =>
  parse(
    await sessionMutation<unknown>(
      `/api/nutrition/foods/${encodeURIComponent(food.id)}`,
      { ...input, revision: food.revision },
      'PATCH'
    )
  );

export const archiveOwnFood = (food: OwnFood) =>
  sessionMutation(
    `/api/nutrition/foods/${encodeURIComponent(food.id)}/archive`,
    { revision: food.revision }
  );

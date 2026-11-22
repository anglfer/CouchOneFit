import type { OwnFood, OwnFoodInput } from '../types/foodLibrary';
import type { NutritionMealCategory } from '../types/nutrition';
import type { CatalogFood, FoodGroup, FoodRestriction } from './foodCatalog';

export interface Row {
  key: string;
  name: string;
  unit: string;
  /** Last valid quantity; macros below belong to it and scale with it. */
  quantity: number;
  quantityText: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  manual: boolean;
}

export interface FoodDraft {
  kind: 'food' | 'recipe';
  name: string;
  group: FoodGroup;
  basis: 'per_100' | 'per_unit';
  defaultUnit: string;
  defaultQuantity: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  preparation: string;
  substitutes: string;
  servings: string;
  ingredients: Row[];
  suitableFor: FoodRestriction[];
  mealCategories: NutritionMealCategory[];
}

export type Macro = 'calories' | 'proteinG' | 'carbsG' | 'fatG';
export const MACROS: [Macro, string][] = [
  ['calories', 'Energía (kcal)'],
  ['proteinG', 'Proteína (g)'],
  ['carbsG', 'Carbohidratos (g)'],
  ['fatG', 'Grasa (g)'],
];

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const parse = (s: string) =>
  s.trim() === '' ? NaN : Number(s.replace(',', '.'));

export const row = (
  item: Omit<Row, 'key' | 'quantityText' | 'manual'>,
  manual = false
): Row => ({
  ...item,
  key: crypto.randomUUID(),
  quantityText: String(item.quantity),
  manual,
});

export function emptyDraft(kind: FoodDraft['kind'] = 'food'): FoodDraft {
  return {
    kind,
    name: '',
    group: 'Proteínas',
    basis: 'per_100',
    defaultUnit: 'g',
    defaultQuantity: '100',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    preparation: '',
    substitutes: '',
    servings: '1',
    ingredients: [],
    suitableFor: [],
    mealCategories: [],
  };
}

export function draftFromOwn(food: OwnFood): FoodDraft {
  return {
    ...emptyDraft(food.kind),
    name: food.name,
    group: food.group,
    basis: food.basis,
    defaultUnit: food.defaultUnit,
    defaultQuantity: String(food.defaultQuantity),
    calories: String(food.calories),
    proteinG: String(food.proteinG),
    carbsG: String(food.carbsG),
    fatG: String(food.fatG),
    preparation: food.preparation ?? '',
    substitutes: food.substitutes ?? '',
    servings: String(food.servings ?? 1),
    ingredients: (food.ingredients ?? []).map((i) => row(i)),
    suitableFor: [...food.suitableFor],
    mealCategories: [...food.mealCategories],
  };
}

/** Starts an own copy of a curated food, e.g. to adjust it to a brand. */
export function draftFromCatalog(food: CatalogFood): FoodDraft {
  return {
    ...emptyDraft('food'),
    name: food.name,
    group: food.group,
    basis: food.basis,
    defaultUnit: food.defaultUnit,
    defaultQuantity: String(food.defaultQuantity),
    calories: String(food.calories),
    proteinG: String(food.proteinG),
    carbsG: String(food.carbsG),
    fatG: String(food.fatG),
    preparation: food.preparationHint,
    substitutes: food.defaultSubstitutes,
  };
}

/** Same arithmetic as the API: whole-recipe totals divided by the portions it yields. */
export function perPortion(d: FoodDraft) {
  const servings = parse(d.servings);
  const sum = (m: Macro) => d.ingredients.reduce((t, r) => t + r[m], 0);
  return Number.isInteger(servings) && servings >= 1
    ? {
        calories: round1(sum('calories') / servings),
        proteinG: round1(sum('proteinG') / servings),
        carbsG: round1(sum('carbsG') / servings),
        fatG: round1(sum('fatG') / servings),
      }
    : null;
}

export function toInput(d: FoodDraft): OwnFoodInput | string {
  const name = d.name.trim();
  if (!name) return 'Escribe el nombre del alimento.';
  const common = {
    name,
    group: d.group,
    kind: d.kind,
    preparation: d.preparation.trim() || null,
    substitutes: d.substitutes.trim() || null,
    suitableFor: d.suitableFor,
    mealCategories: d.mealCategories,
  };
  if (d.kind === 'recipe') {
    const portion = perPortion(d);
    if (d.ingredients.length === 0)
      return 'Agrega al menos un ingrediente a la receta.';
    if (d.ingredients.some((r) => !r.name.trim() || !(r.quantity > 0)))
      return 'Cada ingrediente necesita nombre y una cantidad mayor que cero.';
    if (!portion || parse(d.servings) > 50)
      return 'Indica cuántas porciones rinde la receta (1 a 50).';
    return {
      ...common,
      ...portion,
      basis: 'per_unit',
      defaultUnit: 'porción',
      defaultQuantity: 1,
      servings: parse(d.servings),
      ingredients: d.ingredients.map((r) => ({
        name: r.name.trim(),
        quantity: round1(r.quantity),
        unit: r.unit.trim() || 'g',
        calories: round1(r.calories),
        proteinG: round1(r.proteinG),
        carbsG: round1(r.carbsG),
        fatG: round1(r.fatG),
      })),
    };
  }
  const values = Object.fromEntries(
    MACROS.map(([m]) => [m, parse(d[m])])
  ) as Record<Macro, number>;
  if (Object.values(values).some((v) => !(v >= 0)))
    return 'Completa energía, proteína, carbohidratos y grasa (0 o más).';
  const per100 = d.basis === 'per_100';
  if (per100 && values.proteinG + values.carbsG + values.fatG > 100)
    return 'En 100 g, proteína + carbohidratos + grasa no pueden sumar más de 100 g.';
  if (values.calories > (per100 ? 900 : 5000))
    return per100
      ? 'Ningún alimento pasa de 900 kcal por 100 g; revisa la energía.'
      : 'La energía por pieza no puede pasar de 5000 kcal.';
  const quantity = parse(d.defaultQuantity);
  if (!(quantity > 0 && quantity <= 5000))
    return 'La porción habitual debe ser mayor que cero.';
  if (!d.defaultUnit.trim()) return 'Indica la unidad.';
  return {
    ...common,
    ...values,
    basis: d.basis,
    defaultUnit: d.defaultUnit.trim(),
    defaultQuantity: round1(quantity),
    ingredients: null,
    servings: null,
  };
}

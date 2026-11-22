import type {
  NutritionItem,
  NutritionMeal,
  NutritionMealCategory,
} from '../types/nutrition';
import {
  allFoods,
  createItemFromCatalogFood,
  type CatalogFood,
  type FoodRestriction,
} from './foodCatalog';

type Macro = 'proteinG' | 'carbsG' | 'fatG';

// Base plate per meal type: one food drives each macro, extras stay fixed.
const PLATES: Record<
  NutritionMealCategory,
  {
    proteinG: string;
    carbsG: string | null;
    fatG: string | null;
    extras: [string, number][];
  }
> = {
  breakfast: {
    proteinG: 'egg-whites',
    carbsG: 'oats',
    fatG: 'peanut-butter',
    extras: [['strawberries', 100]],
  },
  morning_snack: {
    proteinG: 'greek-yogurt',
    carbsG: 'apple',
    fatG: 'almonds',
    extras: [],
  },
  lunch: {
    proteinG: 'chicken-breast',
    carbsG: 'white-rice',
    fatG: 'avocado',
    extras: [['broccoli', 150]],
  },
  pre_workout: {
    proteinG: 'whey-protein',
    carbsG: 'banana',
    fatG: null,
    extras: [],
  },
  post_workout: {
    proteinG: 'lean-beef',
    carbsG: 'potato',
    fatG: null,
    extras: [['green-beans', 120]],
  },
  afternoon_snack: {
    proteinG: 'cottage-cheese',
    carbsG: 'rice-cakes',
    fatG: 'almonds',
    extras: [],
  },
  dinner: {
    proteinG: 'white-fish',
    carbsG: 'corn-tortilla',
    fatG: 'olive-oil',
    extras: [['spinach', 80]],
  },
  pre_bed: {
    proteinG: 'cottage-cheese',
    carbsG: null,
    fatG: 'walnuts',
    extras: [],
  },
  other: {
    proteinG: 'turkey-breast',
    carbsG: 'sweet-potato',
    fatG: 'avocado',
    extras: [['zucchini', 150]],
  },
};

const FALLBACK: Record<Macro, string[]> = {
  proteinG: ['plant-protein', 'egg-whites', 'tofu-firm'],
  carbsG: ['white-rice', 'potato', 'oats'],
  fatG: ['avocado', 'almonds', 'olive-oil'],
};

const MEAT = [
  'chicken-breast',
  'turkey-breast',
  'lean-beef',
  'pork-tenderloin',
  'ham-turkey',
  'machaca',
];
const FISH = ['tuna', 'salmon', 'white-fish', 'shrimp', 'sardines'];
const EGG = ['whole-egg', 'egg-whites'];
const DAIRY_EXTRA = ['whey-protein', 'casein-protein'];
const GLUTEN = [
  'whole-wheat-bread',
  'sourdough-bread',
  'pasta-cooked',
  'bagel',
  'seitan',
];

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Restriction label fragment → the code a professional ticks on their own food.
const RESTRICTION_CODES: [string, FoodRestriction][] = [
  ['vegano', 'vegan'],
  ['vegetariano', 'vegetarian'],
  ['lacteo', 'dairy_free'],
  ['pescado', 'fish_free'],
  ['gluten', 'gluten_free'],
];

export function isBlocked(food: CatalogFood, restrictions: readonly string[]) {
  const r = restrictions.map(norm);
  if (food.own) {
    // Own foods are only as safe as the professional marked them; vegan covers the rest.
    const fits = new Set<FoodRestriction>(food.own.suitableFor);
    if (fits.has('vegan'))
      ['vegetarian', 'dairy_free', 'fish_free'].forEach((c) =>
        fits.add(c as FoodRestriction)
      );
    return RESTRICTION_CODES.some(
      ([label, code]) => r.some((x) => x.includes(label)) && !fits.has(code)
    );
  }
  const dairy = food.group === 'Lácteos' || DAIRY_EXTRA.includes(food.id);
  if (r.some((x) => x.includes('vegano')))
    return (
      MEAT.includes(food.id) ||
      FISH.includes(food.id) ||
      EGG.includes(food.id) ||
      dairy ||
      food.id === 'honey'
    );
  return (
    (r.some((x) => x.includes('vegetariano')) &&
      (MEAT.includes(food.id) || FISH.includes(food.id))) ||
    (r.some((x) => x.includes('pescado')) && FISH.includes(food.id)) ||
    (r.some((x) => x.includes('lacteo')) && dairy) ||
    (r.some((x) => x.includes('gluten')) && GLUTEN.includes(food.id))
  );
}

const byId = (id: string) => allFoods().find((f) => f.id === id) ?? null;

// Share of the food's energy that comes from the macro.
const share = (f: CatalogFood, m: Macro) =>
  f.calories > 0 ? (f[m] * (m === 'fatG' ? 9 : 4)) / f.calories : 0;

const MACROS: Macro[] = ['proteinG', 'carbsG', 'fatG'];
const dominant = (f: CatalogFood) =>
  MACROS.reduce((best, m) => (share(f, m) > share(f, best) ? m : best));

/**
 * An own food the professional marked for this meal takes the slot of its main
 * macro. Plain foods must match the slot's group (a vegetable never replaces
 * rice); recipes are whole dishes and only need the main macro.
 */
function preferred(
  base: CatalogFood,
  macro: Macro,
  category: NutritionMealCategory,
  restrictions: readonly string[]
) {
  return allFoods().find(
    (f) =>
      f.own?.mealCategories.includes(category) &&
      dominant(f) === macro &&
      (f.own.kind === 'recipe' || f.group === base.group) &&
      !isBlocked(f, restrictions)
  );
}

function pick(
  id: string,
  macro: Macro,
  restrictions: readonly string[],
  category: NutritionMealCategory
) {
  const base = byId(id);
  if (!base) return null;
  const own = preferred(base, macro, category, restrictions);
  if (own) return own;
  if (!isBlocked(base, restrictions)) return base;
  const sameGroup = allFoods()
    .filter(
      (f) =>
        f.group === base.group && f[macro] > 0 && !isBlocked(f, restrictions)
    )
    .sort((a, b) => share(b, macro) - share(a, macro));
  return (
    sameGroup[0] ??
    FALLBACK[macro]
      .map(byId)
      .find((f): f is CatalogFood => !!f && !isBlocked(f, restrictions)) ??
    null
  );
}

// Quantity unit of a catalog food (1 g for per_100, 1 piece for per_unit).
const perQty = (f: CatalogFood, m: Macro) =>
  f.basis === 'per_100' ? f[m] / 100 : f[m];

const roundQty = (f: CatalogFood, q: number) =>
  f.basis === 'per_unit'
    ? ['pza', 'rebanada'].includes(f.defaultUnit)
      ? Math.round(q)
      : Math.round(q * 2) / 2
    : q >= 20
      ? Math.round(q / 5) * 5
      : Math.round(q);

/**
 * Proposes catalog foods whose portions reach the meal's macro guide.
 * Returns null when the meal has no guide to aim at. The professional
 * always reviews the result before saving.
 */
export function suggestMealItems(
  meal: Pick<
    NutritionMeal,
    'category' | 'targetProteinG' | 'targetCarbsG' | 'targetFatG'
  >,
  restrictions: readonly string[] = []
): NutritionItem[] | null {
  const target: Record<Macro, number> = {
    proteinG: meal.targetProteinG ?? 0,
    carbsG: meal.targetCarbsG ?? 0,
    fatG: meal.targetFatG ?? 0,
  };
  if (target.proteinG + target.carbsG + target.fatG <= 0) return null;
  const category = meal.category ?? 'other';
  const plate = PLATES[category] ?? PLATES.other;

  const fixed = plate.extras
    .map(([id, qty]) => [byId(id), qty] as const)
    .filter(
      (e): e is readonly [CatalogFood, number] =>
        !!e[0] && !isBlocked(e[0], restrictions)
    );
  const slots = (['proteinG', 'carbsG', 'fatG'] as const)
    .filter((m) => plate[m] && target[m] > 0)
    .map((m) => ({
      macro: m,
      food: pick(plate[m]!, m, restrictions, category),
      qty: 0,
    }))
    .filter(
      (s): s is { macro: Macro; food: CatalogFood; qty: number } =>
        !!s.food && perQty(s.food, s.macro) > 0
    );

  // Gauss-Seidel: each slot covers what the rest of the plate leaves for its macro.
  for (let i = 0; i < 30; i++)
    for (const s of slots) {
      const others =
        fixed.reduce((sum, [f, q]) => sum + perQty(f, s.macro) * q, 0) +
        slots.reduce(
          (sum, o) => (o === s ? sum : sum + perQty(o.food, s.macro) * o.qty),
          0
        );
      s.qty = Math.min(
        s.food.defaultQuantity * 4,
        Math.max(0, (target[s.macro] - others) / perQty(s.food, s.macro))
      );
    }

  return [
    ...slots
      .map((s) => [s.food, roundQty(s.food, s.qty)] as const)
      .filter(([f, q]) => q >= (f.basis === 'per_unit' ? 0.5 : 5)),
    ...fixed,
  ].map(([f, q]) => createItemFromCatalogFood(f, q));
}

import type { NutritionMealCategory } from './nutrition.js';

export const FOOD_GROUPS = [
  'Proteínas',
  'Carbohidratos',
  'Grasas saludables',
  'Verduras',
  'Frutas',
  'Lácteos',
  'Legumbres',
  'Bebidas y suplementos',
] as const;

export const FOOD_RESTRICTIONS = ['vegan', 'vegetarian', 'dairy_free', 'fish_free', 'gluten_free'] as const;

export type FoodGroup = (typeof FOOD_GROUPS)[number];
export type FoodRestriction = (typeof FOOD_RESTRICTIONS)[number];

export interface FoodIngredient {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Datos que el profesional captura; en una receta, los macros salen de sus ingredientes. */
export interface ProfessionalFoodInput {
  name: string;
  group: FoodGroup;
  kind: 'food' | 'recipe';
  basis: 'per_100' | 'per_unit';
  defaultUnit: string;
  defaultQuantity: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  preparation: string | null;
  substitutes: string | null;
  ingredients: FoodIngredient[] | null;
  servings: number | null;
  suitableFor: FoodRestriction[];
  mealCategories: NutritionMealCategory[];
}

export interface ProfessionalFood extends ProfessionalFoodInput {
  id: string;
  revision: number;
  updatedAt: string;
}

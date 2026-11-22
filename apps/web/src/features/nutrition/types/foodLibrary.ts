import type { FoodGroup, FoodRestriction } from '../utils/foodCatalog';
import type { NutritionMealCategory } from './nutrition';

export interface FoodIngredient {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** What the professional captures. For a recipe the API derives the portion macros from its ingredients. */
export interface OwnFoodInput {
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

export interface OwnFood extends OwnFoodInput {
  id: string;
  revision: number;
  updatedAt: string;
}

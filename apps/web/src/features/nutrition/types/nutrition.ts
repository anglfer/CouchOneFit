export interface NutritionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  instructions: string | null;
}

export interface NutritionMeal {
  id: string;
  name: string;
  instructions: string | null;
  items: NutritionItem[];
}

export interface NutritionDocument {
  name: string;
  meals: NutritionMeal[];
  caloriesTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}

export interface NutritionVersion extends NutritionDocument {
  id: string;
  planId: string;
  clientId: string | null;
  number: number;
  revision: number;
  published: boolean;
  createdAt: string;
}

export interface NutritionVersionsResponse {
  versions: NutritionVersion[];
  activeVersionId: string | null;
  activeRevision: number;
  canWrite: boolean;
}
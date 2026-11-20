export type NutritionMealCategory =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'pre_workout'
  | 'post_workout'
  | 'afternoon_snack'
  | 'dinner'
  | 'pre_bed'
  | 'other';

export interface NutritionDayTargets {
  caloriesTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

export interface NutritionPeriWorkout {
  preCarbsG: number;
  preProteinG: number;
  preFatG: number;
  postCarbsG: number;
  postProteinG: number;
  postFatG: number;
  intraCarbsG: number;
  notes: string | null;
}

export type NutritionSex = 'male' | 'female';
export type NutritionGoal = 'fat_loss' | 'muscle_gain' | 'recomposition' | 'maintenance';
export type NutritionPace = 'slow' | 'normal' | 'fast';
export type NutritionExperience = 'beginner' | 'intermediate' | 'advanced';
export type NutritionActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';
export type NutritionNeatLevel = 'low' | 'medium' | 'high';
export type NutritionMacroPreference = 'balanced' | 'higher_carbs' | 'higher_fat';
export type NutritionBmrFormula = 'mifflin' | 'katch_mcardle';

export interface NutritionSuggestionMeta {
  engineVersion: string;
  formula: NutritionBmrFormula;
  goal: NutritionGoal;
  pace: NutritionPace;
  bmr: number;
  tdee: number;
  adjustmentPct: number;
  baselineWeightKg: number;
  baselineBodyFatPct: number | null;
  generatedAt: string;
  modifiedByProfessional: boolean;
  restrictions?: string[];
}

export interface NutritionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  instructions: string | null;
  foodGroup?: string | null;
  substitutes?: string | null;
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface NutritionMeal {
  id: string;
  name: string;
  instructions: string | null;
  scheduleTime?: string | null;
  category?: NutritionMealCategory | null;
  targetCalories?: number | null;
  targetProteinG?: number | null;
  targetCarbsG?: number | null;
  targetFatG?: number | null;
  items: NutritionItem[];
}

export interface NutritionDocument {
  name: string;
  meals: NutritionMeal[];
  caloriesTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  generalInstructions?: string | null;
  fiberTargetG?: number | null;
  hydrationTargetMl?: number | null;
  restDayTargets?: NutritionDayTargets | null;
  periWorkout?: NutritionPeriWorkout | null;
  suggestionMeta?: NutritionSuggestionMeta | null;
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

export interface NutritionSuggestionInput {
  sex: NutritionSex;
  ageYears: number;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number | null;
  formula: NutritionBmrFormula;
  activityLevel: NutritionActivityLevel;
  neatLevel: NutritionNeatLevel;
  experience: NutritionExperience;
  goal: NutritionGoal;
  pace: NutritionPace;
  trainingDaysPerWeek: number;
  sessionDurationMin: number;
  macroPreference: NutritionMacroPreference;
  enableCarbCycling: boolean;
  restrictions: string[];
  customAdjustmentPct?: number | null;
  customProteinPerKg?: number | null;
}

export interface NutritionSuggestedMealTemplate {
  name: string;
  category: NutritionMealCategory;
  scheduleTime: string;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  instructions: string;
}

export interface NutritionSuggestionResult {
  engineVersion: string;
  generatedAt: string;
  formulaUsed: NutritionBmrFormula;
  bmr: number;
  activityMultiplier: number;
  tdee: number;
  leanBodyMassKg: number | null;
  leanBodyMassLbs: number | null;
  ffmi: number | null;
  recommendedPhase: {
    goal: NutritionGoal;
    reason: string;
  } | null;
  adjustmentPct: number;
  safetyStatus: 'ok' | 'limited' | 'review_required';
  safetyNotice: string | null;
  trainingDayTargets: NutritionDayTargets;
  restDayTargets: NutritionDayTargets | null;
  weeklyAverageCalories: number;
  proteinPerKg: number;
  fatPercentage: number;
  fiberTargetG: number;
  fiberContextualG: number;
  hydrationTargetMl: number;
  hydrationReferenceTotalMl: number;
  hydrationReferenceBeveragesMl: number;
  mealDistribution: {
    mealsPerDay: number;
    proteinPerMealG: number;
    intervalHours: string;
    leucineThresholdG: number;
    leucineNote: string;
    preBedProteinG: number;
    preBedSources: string[];
    preBedNote: string;
  };
  periWorkout: NutritionPeriWorkout;
  hydrationPeriWorkout: {
    preMinMl: number;
    preMaxMl: number;
    intraMinMl: number;
    intraMaxMl: number;
    postPerKgMinMl: number;
    postPerKgMaxMl: number;
  };
  generalGuidanceSummary: string;
  suggestedMeals: NutritionSuggestedMealTemplate[];
  meta: NutritionSuggestionMeta;
}

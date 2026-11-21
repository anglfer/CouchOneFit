import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activityMultiplier,
  allocateMacrosSafely,
  calculateBmr,
  calculateFiberTargetG,
  calculateMealDistribution,
  generateNutritionSuggestion,
  limitDeficitSafety,
  splitCarbCycling,
} from '../src/features/nutrition/domain/suggestion-engine.js';
import { nutritionDocument, validateSuggestionInput } from '../src/features/nutrition/validators/nutrition.js';
import type { NutritionSuggestionInput } from '../src/features/nutrition/types/nutrition.js';

const baseInput = (overrides: Partial<NutritionSuggestionInput> = {}): NutritionSuggestionInput => ({
  sex: 'male',
  ageYears: 28,
  weightKg: 78,
  heightCm: 178,
  bodyFatPct: 16,
  formula: 'mifflin',
  activityLevel: 'moderate',
  neatLevel: 'medium',
  experience: 'intermediate',
  goal: 'fat_loss',
  pace: 'normal',
  trainingDaysPerWeek: 4,
  sessionDurationMin: 60,
  macroPreference: 'balanced',
  enableCarbCycling: false,
  restrictions: [],
  ...overrides,
});

test('HU-025 calcula BMR Mifflin-St Jeor, Katch-McArdle y multiplicador actividad x NEAT', () => {
  assert.equal(calculateBmr('mifflin', 'male', 80, 180, 30, null), 1780);
  assert.equal(calculateBmr('mifflin', 'female', 60, 165, 25, null), 1345);
  assert.equal(calculateBmr('katch_mcardle', 'male', 80, 180, 30, 20), 1752);

  assert.equal(activityMultiplier('sedentary', 'low'), 1.2);
  assert.equal(activityMultiplier('sedentary', 'medium'), 1.25);
  assert.equal(activityMultiplier('light', 'low'), 1.375);
  assert.equal(activityMultiplier('moderate', 'medium'), 1.6);
  assert.equal(activityMultiplier('very_active', 'high'), 1.9);
});

test('HU-025 garantiza consistencia calórica exacta P*4 + C*4 + G*9 y guardarraíles de seguridad', () => {
  const suggestion = generateNutritionSuggestion(baseInput(), new Date('2026-11-19T12:00:00Z'));
  const t = suggestion.trainingDayTargets;
  assert.equal(t.proteinTargetG * 4 + t.carbsTargetG * 4 + t.fatTargetG * 9, t.caloriesTarget);
  assert.ok(suggestion.fatPercentage >= 20 && suggestion.fatPercentage <= 35);
  assert.ok(suggestion.leanBodyMassKg !== null && suggestion.ffmi !== null);
  assert.equal(suggestion.meta.modifiedByProfessional, false);

  // Déficit extremo queda limitado por piso de seguridad (1200 mujer, >= 50g carbos)
  const safety = limitDeficitSafety('female', 22, 1650, 900, 110, false);
  assert.equal(safety.status, 'limited');
  assert.ok(safety.calories >= 1200);
  assert.ok(safety.notice);

  const safeAllocation = allocateMacrosSafely(safety.calories, 110, 25);
  assert.equal(
    safeAllocation.proteinTargetG * 4 + safeAllocation.carbsTargetG * 4 + safeAllocation.fatTargetG * 9,
    safeAllocation.caloriesTarget,
  );
  assert.ok(safeAllocation.carbsTargetG >= 50);
});

test('HU-025 soporta fallback sin % grasa corporal y carb cycling con promedio semanal coherente', () => {
  const noBf = generateNutritionSuggestion(
    baseInput({ bodyFatPct: null, goal: 'recomposition', enableCarbCycling: true }),
    new Date('2026-11-19T12:00:00Z'),
  );
  assert.equal(noBf.leanBodyMassKg, null);
  assert.equal(noBf.ffmi, null);
  assert.equal(noBf.recommendedPhase, null);
  assert.ok(noBf.restDayTargets !== null);
  assert.ok(noBf.restDayTargets.carbsTargetG < noBf.trainingDayTargets.carbsTargetG);
  assert.equal(noBf.restDayTargets.proteinTargetG, noBf.trainingDayTargets.proteinTargetG);

  const cycled = splitCarbCycling(
    { caloriesTarget: 2200, proteinTargetG: 160, carbsTargetG: 255, fatTargetG: 60 },
    4,
  );
  const weekly = Math.round((cycled.training.caloriesTarget * 4 + cycled.rest.caloriesTarget * 3) / 7);
  assert.ok(Math.abs(weekly - 2200) <= 10);
});

test('HU-025 calcula fibra, hidratación, leucina, restricciones veganas y peri-entreno acotado', () => {
  assert.equal(calculateFiberTargetG(160), 25);
  assert.equal(calculateFiberTargetG(300), 45);

  const dist = calculateMealDistribution(150, 'fat_loss', 'intermediate', 75, ['Vegano']);
  assert.equal(dist.mealsPerDay, 5);
  assert.equal(dist.leucineThresholdG, 3.4);
  assert.ok(dist.preBedSources.some((s) => s.toLowerCase().includes('tofu')));

  const suggestion = generateNutritionSuggestion(
    baseInput({
      weightKg: 62,
      bodyFatPct: 24,
      sex: 'female',
      goal: 'fat_loss',
      pace: 'fast',
      sessionDurationMin: 75,
      restrictions: ['Sin lácteos'],
    }),
  );
  assert.ok(
    suggestion.periWorkout.preProteinG + suggestion.periWorkout.postProteinG <=
      suggestion.trainingDayTargets.proteinTargetG,
  );
  assert.ok(
    suggestion.periWorkout.preCarbsG +
      suggestion.periWorkout.intraCarbsG +
      suggestion.periWorkout.postCarbsG <=
      suggestion.trainingDayTargets.carbsTargetG,
  );
  assert.equal(suggestion.suggestedMeals.length, suggestion.mealDistribution.mealsPerDay);
});

test('HU-025 y documento nutricional rechazan entradas inválidas o campos desconocidos', () => {
  assert.throws(
    () =>
      validateSuggestionInput({
        ...baseInput(),
        formula: 'katch_mcardle',
        bodyFatPct: null,
      }),
    /Katch-McArdle/,
  );

  assert.throws(
    () =>
      validateSuggestionInput({
        ...baseInput(),
        ageYears: 14,
      }),
  );

  assert.throws(
    () =>
      validateSuggestionInput({
        ...baseInput(),
        extraField: 'hack',
      }),
  );

  const validDoc = nutritionDocument({
    name: 'Plan completo',
    caloriesTarget: 2200,
    proteinTargetG: 165,
    carbsTargetG: 245,
    fatTargetG: 62,
    generalInstructions: 'Regla 80/20',
    fiberTargetG: 35,
    hydrationTargetMl: 2500,
    restDayTargets: {
      caloriesTarget: 2000,
      proteinTargetG: 165,
      carbsTargetG: 195,
      fatTargetG: 62,
    },
    periWorkout: {
      preCarbsG: 45,
      preProteinG: 35,
      preFatG: 10,
      postCarbsG: 60,
      postProteinG: 35,
      postFatG: 10,
      intraCarbsG: 0,
      notes: 'Hidratación constante.',
    },
    meals: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Desayuno',
        scheduleTime: '08:00',
        category: 'breakfast',
        targetCalories: 550,
        targetProteinG: 40,
        targetCarbsG: 60,
        targetFatG: 16,
        instructions: 'Tomar agua al despertar',
        items: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Avena',
            quantity: 60,
            unit: 'g',
            instructions: 'En seco',
            foodGroup: 'Carbohidratos',
            substitutes: 'o 2 rebanadas de pan integral',
            calories: 233,
            proteinG: 8.1,
            carbsG: 40.2,
            fatG: 4.1,
          },
        ],
      },
    ],
  });
  assert.equal(validDoc.meals[0].items[0].substitutes, 'o 2 rebanadas de pan integral');
});

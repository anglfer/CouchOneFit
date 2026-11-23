import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let catalog;
let nutrition;
let validate;
let recordService;
let filler;

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  nutrition = await vite.ssrLoadModule(
    '/src/features/nutrition/services/nutrition.ts'
  );
  catalog = await vite.ssrLoadModule(
    '/src/features/nutrition/utils/foodCatalog.ts'
  );
  ({ validateNutritionDocument: validate } = await vite.ssrLoadModule(
    '/src/features/nutrition/utils/validation.ts'
  ));
  filler = await vite.ssrLoadModule(
    '/src/features/nutrition/utils/mealFiller.ts'
  );
  recordService = await vite.ssrLoadModule(
    '/src/features/professional/services/record.ts'
  );
});

after(async () => {
  await vite?.close();
});

test('un plan nuevo permite empezar por la selección de alimentos', () => {
  const plan = nutrition.emptyNutritionDocument();
  assert.deepEqual(
    plan.meals.map((meal) => meal.items.length),
    [0, 0, 0]
  );
  assert.equal(validate(plan).valid, false);
});

test('el catálogo encuentra alimentos sin acentos, por sinónimo y por grupo', () => {
  assert(
    catalog.findFoods('atun', 'Proteínas').some(({ name }) => name === 'Atún')
  );
  assert(catalog.findFoods('elote').some(({ name }) => name === 'Maíz'));
  assert.deepEqual(catalog.findFoods('atun', 'Frutas'), []);
});

test('las cantidades se prescriben manualmente y se conservan al guardar el documento', () => {
  const meal = nutrition.emptyMeal('Desayuno');
  const plan = { ...nutrition.emptyNutritionDocument(), meals: [meal] };
  const item = { ...nutrition.emptyItem(), name: 'Avena', unit: 'g' };
  meal.items = [item];
  assert(validate(plan).errors.meals[meal.id].items[item.id].quantity);
  item.quantity = 35.5;
  item.instructions = 'En seco';
  assert.equal(validate(plan).valid, true);
  const copy = nutrition.cloneNutritionDocument(plan);
  assert.notEqual(copy.meals[0].items[0].id, item.id);
  assert.equal(copy.meals[0].items[0].quantity, 35.5);
  assert.equal(copy.meals[0].items[0].instructions, 'En seco');
});

test('catálogo escala macros por porción e instancia plantillas listas de comida', () => {
  const chicken = catalog.findFoods('pollo', 'Proteínas')[0];
  assert(chicken);
  const scaled = catalog.calculateFoodMacros(chicken, 200);
  assert.equal(scaled.calories, 220);
  assert.equal(scaled.proteinG, 46);

  const templateMeal = catalog.instantiateMealTemplate(
    catalog.MEAL_TEMPLATES[0]
  );
  assert(templateMeal.items.length >= 3);
  assert(templateMeal.targetCalories > 0);
  assert(templateMeal.items[0].substitutes);

  const doc = { ...nutrition.emptyNutritionDocument(), meals: [templateMeal] };
  const summary = catalog.summarizeDocumentMacros(doc);
  assert.equal(summary.itemsWithMacros, templateMeal.items.length);
  assert.equal(summary.calories, templateMeal.targetCalories);
});

test('validador e isNutritionVersion soportan campos enriquecidos de HU-024/025 y payloads heredados', () => {
  const meal = catalog.instantiateMealTemplate(catalog.MEAL_TEMPLATES[2]);
  const enriched = {
    ...nutrition.emptyNutritionDocument(),
    caloriesTarget: 2200,
    proteinTargetG: 165,
    carbsTargetG: 245,
    fatTargetG: 62,
    fiberTargetG: 35,
    hydrationTargetMl: 2500,
    generalInstructions: 'Regla 80/20',
    restDayTargets: {
      caloriesTarget: 1950,
      proteinTargetG: 165,
      carbsTargetG: 185,
      fatTargetG: 61,
    },
    periWorkout: {
      preCarbsG: 45,
      preProteinG: 30,
      preFatG: 10,
      postCarbsG: 60,
      postProteinG: 35,
      postFatG: 10,
      intraCarbsG: 0,
      notes: 'Antes de entrenar',
    },
    meals: [meal],
  };

  assert.equal(validate(enriched).valid, true);

  const copy = nutrition.cloneNutritionDocument(enriched);
  assert.deepEqual(copy.restDayTargets, enriched.restDayTargets);
  assert.equal(copy.hydrationTargetMl, 2500);

  const invalidRest = {
    ...enriched,
    restDayTargets: {
      caloriesTarget: 25000,
      proteinTargetG: 165,
      carbsTargetG: 185,
      fatTargetG: 61,
    },
  };
  assert.equal(validate(invalidRest).valid, false);

  const legacyVersion = {
    id: '11111111-1111-4111-8111-111111111111',
    planId: '22222222-2222-4222-8222-222222222222',
    clientId: '33333333-3333-4333-8333-333333333333',
    number: 1,
    revision: 1,
    published: true,
    createdAt: '2026-11-18T12:00:00.000Z',
    name: 'Plan V1',
    caloriesTarget: null,
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    meals: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Comida 1',
        instructions: null,
        items: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            name: 'Avena',
            quantity: 50,
            unit: 'g',
            instructions: null,
          },
        ],
      },
    ],
  };
  assert.equal(nutrition.isNutritionVersion(legacyVersion), true);
});

test('fetchProfessionalRecord acepta nutritionPlan disponible, vacío y not_integrated pero rechaza otra cartera', async () => {
  const clientId = '33333333-3333-4333-8333-333333333333';
  const originalFetch = globalThis.fetch;
  let mockBody;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(mockBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const baseProfile = {
    id: clientId,
    version: 1,
    fullName: 'Ana Prueba',
    goal: null,
    status: 'active',
    birthDate: null,
    heightCm: null,
    baseWeightKg: null,
    baseBodyFatPercentage: null,
    waistCm: null,
    hipCm: null,
  };
  const baseSections = {
    trainingPlan: { status: 'empty' },
    evaluations: { status: 'empty' },
    progress: { status: 'not_integrated' },
    bodyWeightHistory: { status: 'not_integrated' },
  };

  try {
    mockBody = {
      record: {
        profile: baseProfile,
        sections: {
          ...baseSections,
          nutritionPlan: {
            status: 'available',
            activeRevision: 1,
            plan: {
              id: '11111111-1111-4111-8111-111111111111',
              planId: '22222222-2222-4222-8222-222222222222',
              clientId,
              number: 1,
              revision: 1,
              published: true,
              createdAt: '2026-11-19T12:00:00.000Z',
              name: 'Plan activo',
              caloriesTarget: 2100,
              proteinTargetG: 150,
              carbsTargetG: 220,
              fatTargetG: 65,
              meals: [],
            },
          },
        },
      },
    };
    const validRecord = await recordService.fetchProfessionalRecord(clientId);
    assert.equal(validRecord.sections.nutritionPlan.status, 'available');

    mockBody.record.sections.nutritionPlan.plan.clientId =
      '99999999-9999-4999-8999-999999999999';
    await assert.rejects(
      () => recordService.fetchProfessionalRecord(clientId),
      /Invalid nutrition section/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('el motor llena una comida cerca de su guía y respeta restricciones', () => {
  const meal = {
    category: 'lunch',
    targetProteinG: 40,
    targetCarbsG: 60,
    targetFatG: 15,
  };
  const items = filler.suggestMealItems(meal);
  const total = catalog.summarizeItemsMacros(items);
  assert.ok(Math.abs(total.proteinG - 40) <= 6, `P ${total.proteinG}`);
  assert.ok(Math.abs(total.carbsG - 60) <= 8, `C ${total.carbsG}`);
  assert.ok(Math.abs(total.fatG - 15) <= 5, `G ${total.fatG}`);

  const vegan = filler.suggestMealItems(meal, ['Vegano', 'Sin gluten']);
  const animal = /pollo|pavo|res|pescado|huevo|claras|yogur|queso|whey/i;
  assert.ok(vegan.length >= 3);
  assert.ok(
    vegan.every((i) => !animal.test(i.name)),
    vegan.map((i) => i.name).join()
  );
  assert.equal(filler.suggestMealItems({ category: 'lunch' }), null);
});

test('validador, cloneNutritionDocument e isNutritionVersion soportan recetas con ingredientes y pasos de hasta 2000 caracteres', () => {
  const longSteps =
    `1. Licuar todo.\n2. ${'Cocinar a fuego bajo. '.repeat(60)}`.slice(0, 1500);
  const meal = nutrition.emptyMeal('Desayuno');
  meal.items = [
    {
      ...nutrition.emptyItem('recipe'),
      name: 'Hotcakes de avena',
      quantity: 1,
      unit: 'porción',
      instructions: longSteps,
      recipeIngredients: [
        { name: 'Avena', quantity: 40, unit: 'g' },
        { name: 'Claras de huevo', quantity: 100, unit: 'g' },
      ],
    },
  ];
  const doc = { ...nutrition.emptyNutritionDocument(), meals: [meal] };
  assert.equal(validate(doc).valid, true);

  const cloned = nutrition.cloneNutritionDocument(doc);
  assert.equal(cloned.meals[0].items[0].kind, 'recipe');
  assert.deepEqual(cloned.meals[0].items[0].recipeIngredients, [
    { name: 'Avena', quantity: 40, unit: 'g' },
    { name: 'Claras de huevo', quantity: 100, unit: 'g' },
  ]);

  const invalidMeal = nutrition.emptyMeal('Comida');
  invalidMeal.items = [
    {
      ...nutrition.emptyItem('recipe'),
      name: 'Bowl',
      quantity: 1,
      unit: 'porción',
      recipeIngredients: [{ name: '', quantity: 0, unit: 'g' }],
    },
  ];
  const invalidRes = validate({
    ...nutrition.emptyNutritionDocument(),
    meals: [invalidMeal],
  });
  assert.equal(invalidRes.valid, false);
  assert(
    invalidRes.errors.meals[invalidMeal.id].items[invalidMeal.items[0].id]
      .recipeIngredients
  );

  const recipeVersion = {
    id: '11111111-1111-4111-8111-111111111111',
    planId: '22222222-2222-4222-8222-222222222222',
    clientId: '33333333-3333-4333-8333-333333333333',
    number: 2,
    revision: 1,
    published: true,
    createdAt: '2026-11-23T12:00:00.000Z',
    name: 'Plan con recetas',
    caloriesTarget: null,
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    meals: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Desayuno',
        instructions: null,
        items: meal.items,
      },
    ],
  };
  assert.equal(nutrition.isNutritionVersion(recipeVersion), true);
});

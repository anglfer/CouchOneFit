import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let dom,
  vite,
  catalog,
  filler,
  library,
  Page,
  Picker,
  confirm,
  root,
  createRoot;
let requests, foods;

const own = (extra = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Tortilla de nopal',
  group: 'Carbohidratos',
  kind: 'food',
  basis: 'per_unit',
  defaultUnit: 'pza',
  defaultQuantity: 2,
  calories: 35,
  proteinG: 1.5,
  carbsG: 6.5,
  fatG: 0.4,
  preparation: 'En comal',
  substitutes: null,
  ingredients: null,
  servings: null,
  suitableFor: [],
  mealCategories: ['breakfast'],
  revision: 3,
  updatedAt: '2026-11-21T10:00:00.000Z',
  ...extra,
});
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 5));
  });
const text = () => document.getElementById('root').textContent;
const button = (label) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === label
  );
const breakfast = {
  category: 'breakfast',
  targetProteinG: 30,
  targetCarbsG: 45,
  targetFatG: 12,
};

before(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/app/alimentos',
  });
  for (const key of ['window', 'document', 'navigator', 'localStorage'])
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // La página consulta el estado de conexión de la PWA (services/pwa.ts).
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  createRoot = (await import('react-dom/client')).createRoot;
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [
      {
        name: 'test-service-worker',
        resolveId(id) {
          if (id === 'virtual:pwa-register') return '\0test-pwa';
        },
        load(id) {
          if (id === '\0test-pwa')
            return 'export const registerSW = () => () => {};';
        },
      },
    ],
  });
  const load = (path) => vite.ssrLoadModule(path);
  catalog = await load('/src/features/nutrition/utils/foodCatalog.ts');
  filler = await load('/src/features/nutrition/utils/mealFiller.ts');
  library = await load('/src/features/nutrition/services/foodLibrary.ts');
  Page = (await load('/src/features/nutrition/pages/FoodLibraryPage.tsx'))
    .default;
  Picker = (
    await load('/src/features/nutrition/components/FoodPickerModal.tsx')
  ).default;
  confirm = await load('/src/services/confirm.ts');
  const store = await load('/src/services/offline/store.ts');
  store.setOfflineStore(store.createMemoryStore());
  await (await load('/src/services/offline/readCache.ts')).noteAccount('pro-a');
  globalThis.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    requests.push([method, String(url), options.body]);
    if (String(url).includes('/csrf')) return json({ csrfToken: 'csrf' });
    if (String(url) === '/api/nutrition/foods' && method === 'GET')
      return json({ foods });
    if (String(url) === '/api/nutrition/foods' && method === 'POST')
      return json({ ...own(), ...JSON.parse(options.body), revision: 1 }, 201);
    if (String(url).endsWith('/archive')) return json({ archived: true });
    return json({ error: { code: 'UNEXPECTED' } }, 500);
  };
});

beforeEach(() => {
  requests = [];
  foods = [own()];
  catalog.setOwnFoods([]);
});

after(async () => {
  if (root) await act(async () => root.unmount());
  confirm.setConfirmHandler(null);
  catalog.setOwnFoods([]);
  await vite?.close();
  dom?.window.close();
});

test('los alimentos propios se buscan primero y reescalan al cambiar la cantidad', () => {
  catalog.setOwnFoods([library.toCatalogFood(own())]);
  const [first] = catalog.findFoods('nopal');
  assert.equal(first.id, `own:${own().id}`);
  assert.equal(first.own.kind, 'food');
  assert.equal(
    catalog.findCatalogMatch({ name: 'Tortilla de nopal', unit: 'pza' }).id,
    first.id
  );
  assert.equal(catalog.calculateFoodMacros(first, 4).calories, 140);
});

test('«Sugerir alimentos» prefiere el alimento propio solo en sus tiempos y respeta restricciones', () => {
  const names = (meal, r = []) =>
    filler.suggestMealItems(meal, r).map((item) => item.name);
  assert(!names(breakfast).includes('Tortilla de nopal'));

  catalog.setOwnFoods([library.toCatalogFood(own())]);
  assert(names(breakfast).includes('Tortilla de nopal'));
  assert(!names(breakfast).includes('Avena'));
  assert(
    !names({ ...breakfast, category: 'lunch' }).includes('Tortilla de nopal')
  );
  // Not marked gluten free: a restricted plan falls back to the base food.
  assert(!names(breakfast, ['Sin gluten']).includes('Tortilla de nopal'));

  catalog.setOwnFoods([
    library.toCatalogFood(own({ suitableFor: ['vegan', 'gluten_free'] })),
  ]);
  assert(
    names(breakfast, ['Sin gluten', 'Vegetariano']).includes(
      'Tortilla de nopal'
    )
  );

  // A recipe is a whole dish: it takes its main macro's slot whatever its group.
  catalog.setOwnFoods([
    library.toCatalogFood(
      own({
        name: 'Tacos de pollo',
        group: 'Proteínas',
        kind: 'recipe',
        defaultUnit: 'porción',
        defaultQuantity: 1,
        calories: 320,
        proteinG: 35,
        carbsG: 20,
        fatG: 11,
        mealCategories: ['dinner'],
      })
    ),
  ]);
  const dinner = names({ ...breakfast, category: 'dinner' });
  assert(dinner.includes('Tacos de pollo'));
  assert(!dinner.includes('Pescado blanco'));
});

test('la página lista la biblioteca, copia del catálogo base y archiva con confirmación', async () => {
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Page)));
  await settle();
  assert.match(text(), /Mis alimentos \(1\)/);
  assert.match(text(), /Tortilla de nopalPreferido en Desayuno/);
  // Reading the library also feeds the plan editor's catalog.
  assert.equal(catalog.findFoods('nopal')[0].own.kind, 'food');

  await act(async () => button('Catálogo base (95)').click());
  const copy = [...document.querySelectorAll('tr')]
    .find((row) => row.textContent.startsWith('Pechuga de pollo'))
    .querySelector('button');
  await act(async () => copy.click());
  assert.equal(document.querySelector('form input').value, 'Pechuga de pollo');
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      )
  );
  await settle();
  const [, , body] = requests.find(
    ([method, url]) => method === 'POST' && url === '/api/nutrition/foods'
  );
  assert.deepEqual(
    (({ name, kind, basis, defaultUnit, proteinG, ingredients }) => ({
      name,
      kind,
      basis,
      defaultUnit,
      proteinG,
      ingredients,
    }))(JSON.parse(body)),
    {
      name: 'Pechuga de pollo',
      kind: 'food',
      basis: 'per_100',
      defaultUnit: 'g',
      proteinG: 23,
      ingredients: null,
    }
  );
  assert.match(text(), /Guardaste «Pechuga de pollo»/);

  confirm.setConfirmHandler(async () => true);
  await act(async () => button('Archivar').click());
  await settle();
  const archive = requests.find(([, url]) => url.endsWith('/archive'));
  assert.equal(archive[1], `/api/nutrition/foods/${own().id}/archive`);
  assert.deepEqual(JSON.parse(archive[2]), { revision: 3 });
});

test('sin conexión, guardar y archivar alimentos propios se ven deshabilitados con «Requiere conexión»', async () => {
  if (root) await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Page)));
  await settle();
  await act(async () => window.dispatchEvent(new window.Event('offline')));
  assert.match(
    text(),
    /Requiere conexión: guardar o archivar alimentos propios/
  );
  assert.equal(button('Archivar').disabled, true);
  await act(async () => window.dispatchEvent(new window.Event('online')));
  assert.doesNotMatch(text(), /Requiere conexión/);
  assert.equal(button('Archivar').disabled, false);
});

test('separa Mis alimentos y Mis recetas y escala ingredientes de recetas al prescribir o sugerir', async () => {
  const recipe = own({
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Hotcakes de avena',
    group: 'Carbohidratos',
    kind: 'recipe',
    basis: 'per_unit',
    defaultUnit: 'porción',
    defaultQuantity: 1,
    calories: 208,
    proteinG: 17.8,
    carbsG: 27.3,
    fatG: 3,
    preparation: '1. Licuar.\n2. Cocinar en sartén.',
    servings: 2,
    ingredients: [
      {
        name: 'Avena',
        quantity: 80,
        unit: 'g',
        calories: 311,
        proteinG: 13.5,
        carbsG: 53,
        fatG: 5.5,
      },
      {
        name: 'Claras de huevo',
        quantity: 200,
        unit: 'g',
        calories: 104,
        proteinG: 22,
        carbsG: 1.5,
        fatG: 0.4,
      },
    ],
    mealCategories: ['breakfast'],
  });
  foods = [own(), recipe];

  if (root) await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Page)));
  await settle();

  assert.match(text(), /Mis alimentos \(1\)/);
  assert.match(text(), /Mis recetas \(1\)/);
  assert.doesNotMatch(text(), /Hotcakes de avena/);

  await act(async () => button('Mis recetas (1)').click());
  assert.match(text(), /Hotcakes de avena/);
  assert.match(text(), /2 ingredientes \(Avena, Claras de huevo\)/);

  const catalogRecipe = library.toCatalogFood(recipe);
  catalog.setOwnFoods([catalogRecipe]);
  const onePortion = catalog.createItemFromCatalogFood(catalogRecipe, 1);
  assert.equal(onePortion.kind, 'recipe');
  assert.equal(onePortion.instructions, '1. Licuar.\n2. Cocinar en sartén.');
  assert.deepEqual(onePortion.recipeIngredients, [
    { name: 'Avena', quantity: 40, unit: 'g' },
    { name: 'Claras de huevo', quantity: 100, unit: 'g' },
  ]);

  const twoPortions = catalog.createItemFromCatalogFood(catalogRecipe, 2);
  assert.deepEqual(twoPortions.recipeIngredients, [
    { name: 'Avena', quantity: 80, unit: 'g' },
    { name: 'Claras de huevo', quantity: 200, unit: 'g' },
  ]);

  const suggested = filler.suggestMealItems(breakfast);
  const suggestedRecipe = suggested.find((i) => i.name === 'Hotcakes de avena');
  assert(suggestedRecipe);
  assert.equal(suggestedRecipe.kind, 'recipe');
  assert(Array.isArray(suggestedRecipe.recipeIngredients));
  assert.equal(suggestedRecipe.recipeIngredients.length, 2);

  assert.equal(catalog.formatMealItemsCount([]), '0 alimentos');
  assert.equal(
    catalog.formatMealItemsCount([{ kind: 'recipe' }, { kind: 'food' }]),
    '1 receta · 1 alimento'
  );
  assert.equal(
    catalog.formatMealItemsCount([{ kind: 'recipe' }, { kind: 'recipe' }]),
    '2 recetas'
  );
});

test('FoodPickerModal muestra filtros Todos/Alimentos/Recetas, etiqueta todas las tarjetas y permite agregar receta libre', async () => {
  if (root) await act(async () => root.unmount());
  root = createRoot(document.getElementById('root'));

  let addedManualRecipe = 0;
  catalog.setOwnFoods([]);
  await act(async () =>
    root.render(
      React.createElement(Picker, {
        mealName: 'Desayuno',
        onAddItem() {},
        onAddManual() {},
        onAddManualRecipe() {
          addedManualRecipe += 1;
        },
        onClose() {},
      })
    )
  );
  await settle();

  assert.match(text(), /Todos \(95\)/);
  assert.match(text(), /Alimentos \(95\)/);
  assert.match(text(), /Recetas \(0\)/);
  assert.equal(
    document.querySelectorAll('.nutrition-food-card .nutrition-kind-badge')
      .length,
    95
  );

  await act(async () => button('Recetas (0)').click());
  assert.match(text(), /Aún no tienes recetas guardadas en tu biblioteca/);
  await act(async () => button('Agregar receta libre a esta comida').click());
  assert.equal(addedManualRecipe, 1);

  const recipe = own({
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Omelette de espinaca',
    group: 'Proteínas',
    kind: 'recipe',
    basis: 'per_unit',
    defaultUnit: 'porción',
    defaultQuantity: 1,
    calories: 240,
    proteinG: 22,
    carbsG: 4,
    fatG: 14,
    preparation: '1. Batir huevos.\n2. Cocinar con espinaca.',
    servings: 1,
    ingredients: [
      {
        name: 'Huevo entero',
        quantity: 2,
        unit: 'pza',
        calories: 140,
        proteinG: 12,
        carbsG: 1,
        fatG: 10,
      },
    ],
  });
  catalog.setOwnFoods([library.toCatalogFood(recipe)]);

  await act(async () =>
    root.render(
      React.createElement(Picker, {
        mealName: 'Desayuno',
        onAddItem() {},
        onAddManual() {},
        onAddManualRecipe() {},
        onClose() {},
      })
    )
  );
  await settle();

  assert.match(text(), /Todos \(96\)/);
  assert.match(text(), /Alimentos \(95\)/);
  assert.match(text(), /Recetas \(1\)/);
  await act(async () => button('Recetas (1)').click());
  assert.match(text(), /Omelette de espinaca/);
  assert.match(text(), /1 ingrediente: Huevo entero/);
});

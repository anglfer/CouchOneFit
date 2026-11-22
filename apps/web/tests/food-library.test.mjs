import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let dom, vite, catalog, filler, library, Page, confirm, root, createRoot;
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
  createRoot = (await import('react-dom/client')).createRoot;
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const load = (path) => vite.ssrLoadModule(path);
  catalog = await load('/src/features/nutrition/utils/foodCatalog.ts');
  filler = await load('/src/features/nutrition/utils/mealFiller.ts');
  library = await load('/src/features/nutrition/services/foodLibrary.ts');
  Page = (await load('/src/features/nutrition/pages/FoodLibraryPage.tsx'))
    .default;
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

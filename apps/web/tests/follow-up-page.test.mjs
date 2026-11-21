import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const clientId = '33333333-3333-4333-8333-333333333333';
let dom,
  vite,
  Page,
  Home,
  root,
  createRoot,
  store,
  cache,
  requests,
  visibility,
  nextPayload,
  handler;

const summary = (extra = {}) => ({
  applicableDays: 0,
  recordedDays: 0,
  completed: 0,
  partial: 0,
  notCompleted: 0,
  observedPercent: null,
  coveragePercent: null,
  ...extra,
});
const checkIn = (localDate, extra = {}) => ({
  id: `44444444-4444-4444-8444-44444444444${localDate.slice(-1)}`,
  localDate,
  timeZone: 'America/Mexico_City',
  revision: 1,
  bodyWeightKg: null,
  sleepHours: null,
  stress: null,
  energy: null,
  hunger: null,
  nutritionCompliance: null,
  nutritionVersionId: null,
  comment: null,
  createdAt: `${localDate}T14:00:00.000Z`,
  updatedAt: `${localDate}T14:00:00.000Z`,
  ...extra,
});
const makePayload = (extra = {}) => {
  const checkIns = extra.checkIns ?? [
    checkIn('2026-11-19', {
      bodyWeightKg: 70.8,
      sleepHours: 7.5,
      stress: 2,
      energy: 4,
      nutritionCompliance: 'partial',
      comment: 'Dormí bien',
      revision: 2,
    }),
    checkIn('2026-11-17', { bodyWeightKg: 71.6, energy: 3 }),
  ];
  return {
    clientId,
    from: '2026-10-24',
    to: '2026-11-20',
    today: '2026-11-20',
    timeZone: 'America/Mexico_City',
    checkIns,
    bodyWeight: checkIns
      .filter((c) => c.bodyWeightKg !== null)
      .map((c) => ({
        checkInId: c.id,
        localDate: c.localDate,
        timeZone: c.timeZone,
        weightKg: c.bodyWeightKg,
        unit: 'kg',
        source: 'check_in',
        revision: c.revision,
        recordedAt: c.updatedAt,
      })),
    sessions: extra.sessions ?? [],
    adherence: {
      training: summary(),
      nutrition: summary({
        applicableDays: 3,
        recordedDays: 1,
        partial: 1,
        observedPercent: 50,
        coveragePercent: 33,
      }),
    },
    visibility,
    ...extra,
  };
};
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

before(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: `http://localhost/app/clientes/${clientId}/seguimiento`,
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
  ])
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
  Page = (
    await vite.ssrLoadModule('/src/features/follow-up/pages/ClientFollowUp.tsx')
  ).default;
  Home = (
    await vite.ssrLoadModule(
      '/src/features/professional/components/ProfessionalHome.tsx'
    )
  ).default;
  store = await vite.ssrLoadModule('/src/services/offline/store.ts');
  cache = await vite.ssrLoadModule('/src/services/offline/readCache.ts');
  store.setOfflineStore(store.createMemoryStore());
  await cache.noteAccount('pro-a');
  globalThis.fetch = async (url, options = {}) => {
    requests.push([options.method ?? 'GET', String(url), options.body]);
    if (handler) return handler(String(url), options);
    if (String(url).includes('/csrf')) return json({ csrfToken: 'csrf' });
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      visibility = {
        measurements: body.measurements,
        adherence: body.adherence,
        revision: body.revision + 1,
      };
      return json({ visibility });
    }
    return json(nextPayload());
  };
});

beforeEach(() => {
  requests = [];
  handler = null;
  visibility = { measurements: false, adherence: false, revision: 0 };
  nextPayload = () => makePayload();
  root = createRoot(document.getElementById('root'));
});

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
    root = null;
  }
});

after(async () => {
  if (root) await act(async () => root.unmount());
  await vite?.close();
  dom?.window.close();
});

test('la página muestra datos reales, sin dato ≠ 0 %, gráfica accesible y detalle de sesiones', async () => {
  nextPayload = () =>
    makePayload({
      sessions: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          localDate: '2026-11-19',
          timeZone: 'America/Mexico_City',
          status: 'finalized',
          versionId: '66666666-6666-4666-8666-666666666666',
          versionNumber: 2,
          routineName: 'Fuerza Base',
          dayName: 'Pierna A',
          performedSets: 1,
          totalSets: 2,
          exercises: [
            {
              exerciseId: '77777777-7777-4777-8777-777777777777',
              name: 'Sentadilla',
              loadMode: 'external',
              sets: [
                {
                  setId: '88888888-8888-4888-8888-888888888881',
                  ordinal: 1,
                  prescribedReps: 8,
                  prescribedRepsMax: 10,
                  targetLoadKg: 60,
                  state: 'performed',
                  reps: 9,
                  loadKg: 62.5,
                  unit: 'kg',
                  rpe: 8,
                  rir: 2,
                },
                {
                  setId: '88888888-8888-4888-8888-888888888882',
                  ordinal: 2,
                  prescribedReps: 8,
                  prescribedRepsMax: 10,
                  targetLoadKg: 60,
                  state: 'not_performed',
                  reps: 0,
                  loadKg: null,
                  unit: 'kg',
                  rpe: null,
                  rir: null,
                },
              ],
            },
          ],
        },
      ],
    });
  await act(async () => root.render(React.createElement(Page, { clientId })));
  await settle();
  const page = text();
  assert.match(page, /Adherencia al entrenamiento—Sin días con plan/);
  assert.match(page, /Adherencia a la alimentación50 %Cobertura 33 %/);
  assert.match(page, /−0\.8 kg|-0\.8 kg/);
  assert.match(page, /Dormí bien/);
  assert.match(page, /Corregido/);
  assert.match(page, /Fuerza Base v2/);
  assert.match(page, /62\.5 kg/);
  assert.match(page, /No realizada/);
  assert.equal(
    document.querySelectorAll('[aria-label="Check-ins del periodo"] tbody tr')
      .length,
    2
  );
  assert.equal(
    document.querySelectorAll('[data-followup-sessions] tbody tr').length,
    2
  );
  const svg = document.querySelector('svg[role="group"]');
  assert.ok(svg.getAttribute('aria-label').includes('2 registros'));
  assert.equal(
    svg.querySelector('polyline').getAttribute('stroke'),
    'var(--ws-primary)'
  );
  const points = [...svg.querySelectorAll('[role="button"][tabindex="0"]')];
  assert.equal(points.length, 2);
  await act(async () => points[0].focus());
  assert.match(text(), /rev\. 1/);
  assert.ok(
    requests.some(([, url]) =>
      url.includes(`/api/clients/${clientId}/follow-up?days=28`)
    )
  );
});

test('un solo peso muestra lectura explícita y los filtros validan y consultan ?days o ?from=&to=', async () => {
  nextPayload = () =>
    makePayload({
      checkIns: [checkIn('2026-11-19', { bodyWeightKg: 70.8 })],
    });
  await act(async () => root.render(React.createElement(Page, { clientId })));
  await settle();
  assert.match(text(), /Una sola medición: 70\.8 kg/);
  assert.equal(document.querySelector('svg[role="group"]'), null);
  const btn7 = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === '7 días'
  );
  await act(async () => btn7.click());
  await settle();
  assert.ok(
    requests.some(([, url]) =>
      url.includes(`/api/clients/${clientId}/follow-up?days=7`)
    )
  );
  const inputs = [...document.querySelectorAll('input[type="date"]')];
  const setDate = async (input, value) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  };
  await setDate(inputs[0], '2026-11-10');
  await setDate(inputs[1], '2026-11-01');
  const applyBtn = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Aplicar'
  );
  await act(async () => applyBtn.click());
  assert.match(text(), /no puede ser posterior/);
  const countBefore = requests.length;
  await setDate(inputs[0], '2026-11-01');
  await setDate(inputs[1], '2026-11-15');
  await act(async () => applyBtn.click());
  await settle();
  assert.ok(requests.length > countBefore);
  assert.ok(
    requests
      .at(-1)[1]
      .includes(
        `/api/clients/${clientId}/follow-up?from=2026-11-01&to=2026-11-15`
      )
  );
});

test('compartir medidas envía revisión y maneja conflicto 409 con recarga sincronizada', async () => {
  await act(async () => root.render(React.createElement(Page, { clientId })));
  await settle();
  const save = () =>
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Guardar'
    );
  assert.equal(save().disabled, true);
  await act(async () =>
    document.querySelector('input[type="checkbox"]').click()
  );
  assert.equal(save().disabled, false);
  await act(async () => save().click());
  await settle();
  const patch = requests.find(([method]) => method === 'PATCH');
  assert.deepEqual(JSON.parse(patch[2]), {
    measurements: true,
    adherence: false,
    revision: 0,
  });
  assert.match(text(), /verá el cambio en su próxima consulta/);
  assert.equal(visibility.revision, 1);

  handler = (url, opts) => {
    if (url.includes('/csrf')) return json({ csrfToken: 'csrf' });
    if (opts.method === 'PATCH') {
      return json(
        { error: { code: 'CHECK_IN_CONFLICT', message: 'Conflicto' } },
        409
      );
    }
    visibility = { measurements: false, adherence: true, revision: 2 };
    return json(makePayload());
  };
  await act(async () =>
    document.querySelectorAll('input[type="checkbox"]')[1].click()
  );
  await act(async () => save().click());
  await settle();
  assert.match(text(), /Otra sesión cambió esta configuración/);
  const reloadBtn = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Actualizar configuración'
  );
  assert.ok(reloadBtn);
  await act(async () => reloadBtn.click());
  await settle();
  const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
  assert.equal(boxes[0].checked, false);
  assert.equal(boxes[1].checked, true);
});

test('ProfessionalHome ordena recientes por lastCheckInAt, muestra sin check-in hoy (solo activos) y maneja fallo de adherencia sin ceros falsos', async () => {
  let failSummary = true;
  handler = (url) => {
    if (url === '/api/training/clients') {
      return json({
        clients: [
          {
            id: 'c-old',
            fullName: 'Ana Antigua',
            status: 'active',
            activeRoutine: 'Fuerza',
            hasDraft: false,
            lastSession: '2026-11-19',
            sessionsLast7: 2,
            lastCheckIn: '2026-11-19',
            lastCheckInAt: '2026-11-19T10:00:00.000Z',
            checkInToday: false,
            checkInRecent: true,
          },
          {
            id: 'c-new',
            fullName: 'Zoe Reciente',
            status: 'active',
            activeRoutine: 'Fuerza',
            hasDraft: false,
            lastSession: '2026-11-20',
            sessionsLast7: 1,
            lastCheckIn: '2026-11-20',
            lastCheckInAt: '2026-11-20T12:00:00.000Z',
            checkInToday: true,
            checkInRecent: true,
          },
          {
            id: 'c-inactive',
            fullName: 'Luis Inactivo',
            status: 'inactive',
            activeRoutine: null,
            hasDraft: false,
            lastSession: null,
            sessionsLast7: 0,
            lastCheckIn: null,
            lastCheckInAt: null,
            checkInToday: false,
            checkInRecent: false,
          },
        ],
      });
    }
    if (url === '/api/follow-up/summary') {
      if (failSummary) {
        return json({ error: { code: 'QUERY_FAILED', message: 'Error' } }, 500);
      }
      return json({
        days: 7,
        activeClients: 2,
        adherence: {
          training: summary({
            applicableDays: 4,
            recordedDays: 4,
            completed: 4,
            observedPercent: 100,
            coveragePercent: 100,
          }),
          nutrition: summary({
            applicableDays: 0,
            recordedDays: 0,
            observedPercent: null,
            coveragePercent: null,
          }),
        },
      });
    }
    return json({});
  };
  await act(async () =>
    root.render(
      React.createElement(Home, {
        fullName: 'Coach Test',
        subscription: {
          status: 'active',
          planName: 'Pro',
          limit: 30,
          isUnlimited: false,
          used: 2,
          remaining: 28,
          excess: 0,
          expiresAt: '2026-12-20T00:00:00.000Z',
        },
      })
    )
  );
  await settle();
  const body = text();
  assert.match(body, /Clientes activos2 \/ 30/);
  assert.match(body, /No pudimos consultar los indicadores de adherencia/);
  assert.doesNotMatch(body, /Adherencia entrenamiento \(7 d\)/);
  assert.doesNotMatch(body, /Luis Inactivo/);
  assert.ok(body.indexOf('Zoe Reciente') < body.indexOf('Ana Antigua'));

  const pendingBtn = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Sin check-in hoy'
  );
  await act(async () => pendingBtn.click());
  assert.match(text(), /no indica revisión pendiente/);
  assert.match(text(), /Ana Antigua/);
  assert.doesNotMatch(text(), /Luis Inactivo/);

  failSummary = false;
  const retryAdh = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === 'Reintentar adherencia'
  );
  await act(async () => retryAdh.click());
  await settle();
  assert.match(text(), /Adherencia entrenamiento \(7 d\)100 %/);
  assert.match(
    text(),
    /Adherencia alimentación \(7 d\)—Sin días con plan en 7 días/
  );
});

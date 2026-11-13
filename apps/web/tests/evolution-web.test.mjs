import assert from 'node:assert/strict';
import { before, after, beforeEach, afterEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
let vite,
  dom,
  root,
  createRoot,
  Section,
  Chart,
  Summary,
  utils,
  service,
  cache,
  store,
  sync,
  outbox,
  fields,
  requests,
  responder;
const clientId = '11111111-1111-4111-8111-111111111111',
  otherId = '22222222-2222-4222-8222-222222222222';
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const sample = (n, measurements = { weightKg: 80.1 }, extra = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  clientId,
  date: '2026-11-01',
  dateBasis: 'legacy_evaluation_date',
  createdAt: `2026-11-01T12:00:00.${String(n).padStart(6, '0')}Z`,
  source: 'professional_evaluation',
  method: null,
  provenance: null,
  protocol: null,
  measurements,
  ...extra,
});
const page = (samples = [], extra = {}) => ({
  clientId,
  period: { from: null, to: null },
  method: null,
  order: 'asc',
  metricDefinitions: Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [
      k,
      { label: v[0], unit: v[1], decimalPlaces: 1 },
    ])
  ),
  samples,
  pageInfo: { pageSize: 20, hasMore: false, nextCursor: null },
  ...extra,
});
const settle = async () => {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
};
const render = async (el) => {
  await act(async () => root.render(el));
  await settle();
};
const section = (extra = {}) =>
  React.createElement(Section, {
    clientId,
    accountId: 'pro-a',
    initialStatus: 'available',
    ...extra,
  });
const button = (text) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === text);
const click = async (text) => {
  assert.ok(button(text), text);
  await act(async () => button(text).click());
  await settle();
};
const select = async (index, value) => {
  await act(async () => {
    const el = document.querySelectorAll('select')[index];
    el.value = value;
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await settle();
};
before(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/app/clientes/' + clientId + '/evaluacion',
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
  const load = (p) => vite.ssrLoadModule('/src/' + p + '.ts');
  Section = (
    await vite.ssrLoadModule(
      '/src/features/evaluations/components/EvolutionSection.tsx'
    )
  ).default;
  Chart = (
    await vite.ssrLoadModule(
      '/src/features/evaluations/components/EvolutionChart.tsx'
    )
  ).default;
  Summary = (
    await vite.ssrLoadModule(
      '/src/features/evaluations/components/EvolutionSummary.tsx'
    )
  ).default;
  utils = await load('features/evaluations/utils/evolution');
  service = await load('features/evaluations/services/evolution');
  cache = await load('services/offline/readCache');
  store = await load('services/offline/store');
  sync = await load('services/offline/sync');
  outbox = await load('services/offline/outbox');
  fields = (await load('features/evaluations/types/assessment'))
    .measurementFields;
});
beforeEach(async () => {
  store.setOfflineStore(store.createMemoryStore());
  await cache.clearOfflineData(true);
  await cache.noteAccount('pro-a');
  requests = [];
  responder = () => json(page());
  globalThis.fetch = async (url, options) => {
    requests.push(String(url));
    return responder(String(url), options);
  };
  root = createRoot(document.getElementById('root'));
});
afterEach(async () => {
  await act(async () => root.unmount());
});
after(async () => {
  await vite?.close();
  dom?.window.close();
});
test('inclusive UTC periods, valid calendars and inverted ranges', () => {
  assert.deepEqual(
    utils.quickEvolutionPeriod(30, new Date('2026-03-01T23:00:00Z')),
    { from: '2026-01-31', to: '2026-03-01' }
  );
  assert.equal(utils.isHistoryDate('2024-02-29'), true);
  assert.equal(utils.isHistoryDate('2026-02-29'), false);
  assert.ok(
    utils.validateEvolutionFilters({
      from: '2026-12-01',
      to: '2026-11-01',
      method: '',
    })
  );
  assert.equal(
    utils.validateEvolutionFilters({
      from: '2026-11-01',
      to: '2026-11-01',
      method: 'legacy',
    }),
    null
  );
});
test('stable ordering preserves microseconds, repeated dates and unique IDs', () => {
  const a = sample(1),
    b = sample(2),
    c = sample(3, {}, { date: '2026-10-31' });
  assert.deepEqual(
    utils.mergeEvolutionSamples([b], [a, b, c]).map((s) => s.id),
    [c.id, a.id, b.id]
  );
});
test('zero evaluations never draw a fictitious graph', async () => {
  await render(section());
  assert.match(
    document.body.textContent,
    /Sin evaluaciones confirmadas en este periodo/
  );
  assert.equal(document.querySelector('svg'), null);
});
test('one value shows date and unit without a trend', async () => {
  responder = () => json(page([sample(1)]));
  await render(section());
  assert.match(document.body.textContent, /Una sola medición: 80.1 kg/);
  assert.match(document.body.textContent, /no hay suficientes registros/);
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 1);
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 0);
});
test('accessible table preserves missing values and same-day SVG points', async () => {
  responder = () =>
    json(page([sample(1), sample(2, {}), sample(3, { weightKg: 79.2 })]));
  await render(section());
  assert.ok(document.querySelector('table caption'));
  assert.equal(document.querySelectorAll('tbody tr').length, 3);
  assert.match(document.body.textContent, /Sin medición/);
  const points = [...document.querySelectorAll('svg [role="button"]')];
  assert.equal(points.length, 2);
  assert.equal(
    points[0].querySelector('circle').getAttribute('cx'),
    points[1].querySelector('circle').getAttribute('cx')
  );
  assert.equal(document.querySelector('polyline'), null);
  await act(async () => points[1].focus());
  assert.match(
    document.querySelector('[aria-live="polite"]').textContent,
    /79.2 kg/
  );
  assert.match(points[0].getAttribute('aria-label'), /método desconocido/);
});
test('metric selection keeps units and never sends a metric API parameter', async () => {
  responder = () =>
    json(page([sample(1, { waistCm: 90.2 }), sample(2, { waistCm: 89.3 })]));
  await render(section());
  await select(0, 'waistCm');
  assert.match(document.querySelector('table').textContent, /90.2/);
  assert.match(document.querySelector('table').textContent, /cm/);
  assert.ok(requests.every((url) => !url.includes('metric')));
});
test('method selection sends only accepted query parameters', async () => {
  responder = (url) =>
    json(
      page([], {
        method: new URL(url, 'http://localhost').searchParams.get('method'),
      })
    );
  await render(section());
  await select(1, 'legacy');
  await click('Aplicar filtros');
  assert.ok(requests.at(-1).includes('method=legacy'));
  assert.deepEqual(
    [...new URL(requests.at(-1), 'http://localhost').searchParams.keys()],
    ['method', 'pageSize']
  );
});
test('pagination discloses incompleteness and merges without duplicate IDs', async () => {
  const first = Array.from({ length: 20 }, (_, i) => sample(i + 1)),
    cursor = 'abc.' + 'a'.repeat(43);
  responder = (url) =>
    json(
      url.includes('cursor=')
        ? page([sample(20), sample(21)])
        : page(first, {
            pageInfo: { pageSize: 20, hasMore: true, nextCursor: cursor },
          })
    );
  await render(section());
  assert.match(document.body.textContent, /Consulta incompleta/);
  await click('Cargar más evolución');
  assert.equal(document.querySelectorAll('tbody tr').length, 21);
  assert.equal(button('Cargar más evolución'), undefined);
});
test('late responses after changing client cannot expose old samples', async () => {
  let release;
  responder = (url) =>
    url.includes(otherId)
      ? json(
          page([sample(9, { weightKg: 62.2 }, { clientId: otherId })], {
            clientId: otherId,
          })
        )
      : new Promise((r) => {
          release = r;
        });
  await render(section());
  await render(section({ clientId: otherId }));
  await act(async () => release(json(page([sample(1)]))));
  await settle();
  assert.match(document.querySelector('table').textContent, /62.2/);
  assert.doesNotMatch(document.querySelector('table').textContent, /80.1/);
});
test('obsolete filter responses are ignored', async () => {
  let release;
  responder = (url) =>
    url.includes('method=legacy')
      ? json(page([sample(2, { weightKg: 71.2 })], { method: 'legacy' }))
      : new Promise((r) => {
          release = r;
        });
  await render(section());
  await select(1, 'legacy');
  await click('Aplicar filtros');
  await act(async () => release(json(page([sample(1)]))));
  await settle();
  assert.match(document.querySelector('table').textContent, /71.2/);
  assert.doesNotMatch(document.querySelector('table').textContent, /80.1/);
});
test('recoverable errors retry and denial never appears as empty', async () => {
  responder = () =>
    json(
      { error: { code: 'QUERY_FAILED', message: 'Consulta no disponible.' } },
      500
    );
  await render(section());
  assert.ok(button('Reintentar evolución'));
  responder = () => json(page([sample(1)]));
  await click('Reintentar evolución');
  assert.ok(document.querySelector('table'));
  responder = () =>
    json({ error: { code: 'FORBIDDEN', message: 'Acceso denegado.' } }, 403);
  await click('Actualizar evolución');
  assert.match(document.body.textContent, /Acceso denegado/);
  assert.equal(document.querySelector('table'), null);
  assert.doesNotMatch(
    document.body.textContent,
    /Sin evaluaciones confirmadas en este periodo/
  );
});
test('offline cache is labelled and unavailable periods are not invented', async () => {
  responder = () => json(page([sample(1)]));
  await render(section());
  responder = () => {
    throw new TypeError('Failed to fetch');
  };
  await click('Actualizar evolución');
  assert.match(
    document.body.textContent,
    /Datos recuperados de caché de esta cuenta/
  );
  assert.ok(document.querySelector('table'));
  await select(1, 'legacy');
  await click('Aplicar filtros');
  assert.match(
    document.body.textContent,
    /este periodo o página no está guardado/
  );
  assert.equal(document.querySelector('table'), null);
});
test('account change clears visible samples and rejects old-account reads', async () => {
  responder = () => json(page([sample(1)]));
  await render(section());
  await act(async () => cache.noteAccount('pro-b'));
  await settle();
  assert.equal(document.querySelector('table'), null);
  assert.match(document.body.textContent, /La sesión cambió/);
  await assert.rejects(
    service.fetchEvolution(
      clientId,
      'pro-a',
      utils.ALL_EVOLUTION,
      undefined,
      () => true
    ),
    (e) => e.code === 'SESSION_CHANGED'
  );
});
test('history invalidation preserves other cached modules and pending outbox', async () => {
  const endpoint = service.evolutionEndpoint(clientId, utils.ALL_EVOLUTION);
  await cache.rememberRead(endpoint, page([sample(1)]), 'pro-a');
  await cache.rememberRead('/api/professional/profile', {
    profile: { fullName: 'QA' },
  });
  await outbox.enqueue({
    id: 'qa-pending',
    kind: 'evaluation.create',
    method: 'POST',
    endpoint: `/api/clients/${clientId}/evaluations`,
    body: { weightKg: 70.1 },
    label: 'QA',
    clientId,
    clientName: 'QA',
  });
  await cache.invalidateEvaluationHistoryReads('pro-a');
  assert.equal(await cache.recallRead(endpoint, 'pro-a'), null);
  assert.ok(await cache.recallRead('/api/professional/profile'));
  assert.equal((await store.getStore().keys('outbox')).length, 1);
});
test('successful HU-021 synchronization invalidates history and refreshes loaded samples', async () => {
  let synced = false;
  responder = (url, options) => {
    if (url === '/api/auth/csrf')
      return json({ csrfToken: 'synthetic-test-csrf' });
    if (options?.method === 'POST') {
      synced = true;
      return json({ evaluation: {} }, 201);
    }
    return json(
      page(synced ? [sample(1), sample(2, { weightKg: 79.2 })] : [sample(1)])
    );
  };
  await render(section());
  await outbox.enqueue({
    id: '00000000-0000-4000-8000-999999999999',
    kind: 'evaluation.create',
    method: 'POST',
    endpoint: `/api/clients/${clientId}/evaluations`,
    body: { weightKg: 79.2 },
    label: 'QA sync',
    clientId,
    clientName: 'QA',
  });
  await act(async () => sync.flushOutbox());
  await settle();
  assert.equal(synced, true);
  assert.equal(document.querySelectorAll('tbody tr').length, 2);
  assert.equal((await store.getStore().keys('outbox')).length, 0);
});
test('summary uses the existing Evaluation route', async () => {
  await render(
    React.createElement(Summary, {
      clientId,
      section: { status: 'available', history: page([sample(1)]) },
    })
  );
  assert.equal(
    document.querySelector('a').getAttribute('href'),
    `/app/clientes/${clientId}/evaluacion#evolucion-antropometrica`
  );
});
test('mobile-sized SVG retains keyboard access and real dates', async () => {
  const original = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 240 });
  try {
    await render(
      React.createElement(Chart, {
        metric: 'weightKg',
        samples: [
          sample(1),
          sample(2, { weightKg: 81.2 }, { date: '2026-11-02' }),
        ],
      })
    );
    assert.equal(
      document.querySelector('svg').getAttribute('viewBox'),
      '0 0 240 270'
    );
    assert.ok(
      [...document.querySelectorAll('svg [role="button"]')].every(
        (p) => p.getAttribute('tabindex') === '0'
      )
    );
    assert.match(document.body.textContent, /nov/);
  } finally {
    window.HTMLElement.prototype.getBoundingClientRect = original;
  }
});

test('custom inclusive dates are applied together; invalid ranges never request history', async () => {
  responder = (url) => {
    const q = new URL(url, 'http://localhost').searchParams;
    return json(page([], { period: { from: q.get('from'), to: q.get('to') } }));
  };
  await render(section());
  const change = async (index, value) => {
    await act(async () => {
      const input = document.querySelectorAll('input[type="date"]')[index];
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  };
  await change(0, '2026-11-01');
  await change(1, '2026-11-01');
  await click('Aplicar filtros');
  assert.match(requests.at(-1), /from=2026-11-01&to=2026-11-01/);
  const count = requests.length;
  await change(0, '2026-12-01');
  await click('Aplicar filtros');
  assert.equal(requests.length, count);
  assert.match(document.body.textContent, /no puede ser posterior/);
});
test('logout defeats an in-flight request and does not repopulate cache', async () => {
  let release;
  responder = () =>
    new Promise((r) => {
      release = r;
    });
  await render(section());
  await act(async () => cache.clearOfflineData());
  await act(async () => release(json(page([sample(1)]))));
  await settle();
  assert.equal(document.querySelector('table'), null);
  assert.deepEqual(await store.getStore().keys('readCache'), []);
});
test('response with mismatched filters is rejected, never silently replaced by cached data', async () => {
  await cache.rememberRead(
    service.evolutionEndpoint(clientId, utils.ALL_EVOLUTION),
    page([sample(1)]),
    'pro-a'
  );
  responder = () =>
    json(page([sample(1)], { period: { from: '2026-11-01', to: null } }));
  await render(section());
  assert.equal(document.querySelector('table'), null);
  assert.match(
    document.body.textContent,
    /No pudimos interpretar la evolución/
  );
});
test('cached partial pages remain explicitly incomplete and unvisited pages require connection', async () => {
  const cursor = 'abc.' + 'a'.repeat(43),
    first = page(
      Array.from({ length: 20 }, (_, i) => sample(i + 1)),
      { pageInfo: { pageSize: 20, hasMore: true, nextCursor: cursor } }
    );
  await cache.rememberRead(
    service.evolutionEndpoint(clientId, utils.ALL_EVOLUTION),
    first,
    'pro-a'
  );
  responder = () => {
    throw new TypeError('Failed to fetch');
  };
  await render(section());
  assert.match(document.body.textContent, /Consulta incompleta/);
  await click('Cargar más evolución');
  assert.match(
    document.body.textContent,
    /este periodo o página no está guardado/
  );
  assert.equal(document.querySelectorAll('tbody tr').length, 20);
});
test('declared device provenance does not change metric labels or imply all fields came from the device', async () => {
  responder = () =>
    json(
      page([
        sample(
          1,
          { weightKg: 80.1 },
          {
            dateBasis: 'effective_date',
            method: 'bioimpedancia',
            provenance: 'device_reported',
            protocol: 'device_report_v1',
          }
        ),
      ])
    );
  await render(section());
  assert.match(
    document.querySelector('table').textContent,
    /Declarada: dispositivo/
  );
  assert.match(
    document.body.textContent,
    /no garantía del origen de cada campo/
  );
});

test('a confirmed online HU-021 create invalidates evolution without changing the write result', async () => {
  const endpoint = service.evolutionEndpoint(clientId, utils.ALL_EVOLUTION);
  await cache.rememberRead(endpoint, page([sample(1)]), 'pro-a');
  const evaluation = {
    id: sample(2).id,
    clientId,
    evaluationDate: '2026-11-01',
    createdAt: '2026-11-01T12:00:00.000Z',
    weightKg: 79.2,
    waistCm: null,
    hipCm: null,
    measuredBodyFatPercentage: null,
    pectoralSkinfoldMm: null,
    abdominalSkinfoldMm: null,
    tricepsSkinfoldMm: null,
    suprailiacSkinfoldMm: null,
    thighSkinfoldMm: null,
  };
  responder = (url) =>
    url === '/api/auth/csrf'
      ? json({ csrfToken: 'synthetic-test-csrf' })
      : json({ evaluation }, 201);
  const writes = await vite.ssrLoadModule(
    '/src/features/evaluations/services/evaluations.ts'
  );
  const outcome = await writes.createEvaluation(clientId, 'QA', {
    weightKg: 79.2,
  });
  assert.equal(outcome.status, 'done');
  assert.equal(outcome.result.id, evaluation.id);
  responder = () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(
    service.fetchEvolution(
      clientId,
      'pro-a',
      utils.ALL_EVOLUTION,
      undefined,
      () => true
    ),
    (e) => e.code === 'EVOLUTION_NOT_CACHED'
  );
});

const manual = (n, date, measurements = { weightKg: 70.1 }, extra = {}) =>
  sample(n, measurements, {
    date,
    dateBasis: 'effective_date',
    method: 'perimetros',
    provenance: 'manual_measurements',
    protocol: 'circumference-sites-pending',
    ...extra,
  });

test('two comparable manual measurements draw one segment and retain keyboard points/table units', async () => {
  responder = () =>
    json(
      page([
        manual(1, '2026-11-01'),
        manual(2, '2026-11-02', { weightKg: 71.2 }),
      ])
    );
  await render(section());
  const lines = [...document.querySelectorAll('[data-evolution-segment]')];
  assert.equal(lines.length, 1);
  assert.equal(lines[0].getAttribute('data-from'), sample(1).id);
  assert.equal(lines[0].getAttribute('data-to'), sample(2).id);
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 2);
  assert.match(document.querySelector('table').textContent, /71.2 kg/);
  assert.match(document.body.textContent, /no pesos intermedios/);
  assert.equal(document.querySelectorAll('tbody tr').length, 2);
});
test('three comparable dates draw consecutive segments in actual chronological order without mutating samples', async () => {
  const samples = [
    manual(3, '2026-11-03'),
    manual(1, '2026-11-01'),
    manual(2, '2026-11-02'),
  ];
  const original = structuredClone(samples);
  const segments = utils.evolutionSegments(samples, 'weightKg');
  assert.deepEqual(
    segments.map((s) => [s.from.id, s.to.id]),
    [
      [sample(1).id, sample(2).id],
      [sample(2).id, sample(3).id],
    ]
  );
  await render(React.createElement(Chart, { metric: 'weightKg', samples }));
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 2);
  assert.deepEqual(samples, original);
});
test('repeated dates interrupt both sides of a series, even with differing creation microseconds', () => {
  const rows = [
    manual(1, '2026-11-01'),
    manual(2, '2026-11-02'),
    manual(3, '2026-11-02', { weightKg: 71.2 }),
    manual(4, '2026-11-03'),
    manual(5, '2026-11-04'),
  ];
  assert.deepEqual(
    utils.evolutionSegments(rows, 'weightKg').map((s) => [s.from.id, s.to.id]),
    [[sample(4).id, sample(5).id]]
  );
});
test('absent and null measurements break segments rather than bridging the missing evaluation', async () => {
  const rows = [
    manual(1, '2026-11-01'),
    manual(2, '2026-11-02', {}),
    manual(3, '2026-11-03'),
  ];
  assert.equal(utils.evolutionSegments(rows, 'weightKg').length, 0);
  assert.equal(
    utils.evolutionSegments(
      [rows[0], manual(2, '2026-11-02', { weightKg: null }), rows[2]],
      'weightKg'
    ).length,
    0
  );
  responder = () => json(page(rows));
  await render(section());
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 0);
  assert.equal(document.querySelectorAll('tbody tr').length, 3);
  assert.match(document.querySelector('table').textContent, /Sin medición/);
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 2);
});
test('method-specific series never connect to another method or protocol', async () => {
  const rows = [
    manual(1, '2026-11-01', { waistCm: 70.1 }),
    manual(
      2,
      '2026-11-02',
      { waistCm: 71.1 },
      { method: 'pliegues', protocol: 'jp3-sites-pending' }
    ),
    manual(3, '2026-11-03', { waistCm: 70.1 }),
    manual(
      4,
      '2026-11-04',
      { waistCm: 71.2 },
      { method: 'pliegues', protocol: 'jp3-sites-pending' }
    ),
  ];
  assert.deepEqual(
    utils.evolutionSegments(rows, 'waistCm').map((s) => [s.from.id, s.to.id]),
    [
      [sample(1).id, sample(3).id],
      [sample(2).id, sample(4).id],
    ]
  );
  assert.equal(
    utils.evolutionSegments(
      [
        rows[0],
        manual(5, '2026-11-05', { waistCm: 70.1 }, { protocol: 'different' }),
      ],
      'waistCm'
    ).length,
    0
  );
  await render(
    React.createElement(Chart, { metric: 'waistCm', samples: rows })
  );
  assert.equal(
    document.querySelectorAll('[data-evolution-segment][stroke-dasharray]')
      .length,
    1
  );
});
test('unknown legacy metadata and reported-device provenance cannot establish a comparable series', async () => {
  const legacy = [
    sample(1, { waistCm: 80.1 }),
    sample(2, { waistCm: 71.1 }, { date: '2026-11-02' }),
  ];
  const device = [
    manual(
      3,
      '2026-11-03',
      { waistCm: 70.1 },
      {
        method: 'bioimpedancia',
        provenance: 'device_reported',
        protocol: 'device-kg-litre-v1',
      }
    ),
    manual(
      4,
      '2026-11-04',
      { waistCm: 71.1 },
      {
        method: 'bioimpedancia',
        provenance: 'device_reported',
        protocol: 'device-kg-litre-v1',
      }
    ),
  ];
  const rows = [...legacy, ...device];
  assert.equal(utils.evolutionSegments(rows, 'waistCm').length, 0);
  responder = () => json(page(rows));
  await render(section());
  await select(0, 'waistCm');
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 4);
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 0);
  assert.match(document.body.textContent, /Sin conexiones/);
  assert.match(
    document.body.textContent,
    /sin protocolo comparable o sin identificación del equipo/
  );
});
test('missing provenance, different clients/date bases and device index never receive a false link', async () => {
  const a = manual(1, '2026-11-01', { waistCm: 70.1 });
  for (const extra of [
    { provenance: null },
    { clientId: otherId },
    { dateBasis: 'legacy_evaluation_date' },
    { protocol: null },
  ])
    assert.equal(
      utils.evolutionSegments(
        [a, manual(2, '2026-11-02', { waistCm: 70.1 }, extra)],
        'waistCm'
      ).length,
      0
    );
  const device = manual(
    1,
    '2026-11-01',
    { visceralFatIndex: 5.1 },
    {
      method: 'bioimpedancia',
      provenance: 'device_reported',
      protocol: 'device-kg-litre-v1',
    }
  );
  responder = () => json(page([device]));
  await render(section());
  await select(0, 'visceralFatIndex');
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 1);
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 0);
  assert.match(document.querySelector('table').textContent, /5.1 índice/);
});

test('incomplete pages do not connect the frontier day before same-day ambiguity can be ruled out', async () => {
  const rows = [
    manual(1, '2026-11-01'),
    manual(2, '2026-11-02'),
    manual(3, '2026-11-03'),
  ];
  assert.deepEqual(
    utils
      .evolutionSegments(rows, 'weightKg', true)
      .map((s) => [s.from.id, s.to.id]),
    [[sample(1).id, sample(2).id]]
  );
  await render(
    React.createElement(Chart, {
      metric: 'weightKg',
      samples: rows,
      hasMore: true,
    })
  );
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 1);
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 3);
  assert.match(
    document.body.textContent,
    /último día cargado queda sin segmentos/
  );
});

test('weight connects different methods/dates as an explicitly heterogeneous SVG guide', async () => {
  const rows = [
    manual(1, '2026-11-01', { weightKg: 80 }),
    manual(
      2,
      '2026-11-02',
      { weightKg: 79 },
      {
        method: 'bioimpedancia',
        provenance: 'device_reported',
        protocol: 'device-kg-litre-v1',
      }
    ),
  ];
  responder = () => json(page(rows));
  await render(section());
  const line = document.querySelector('[data-evolution-segment]');
  assert.ok(line);
  assert.equal(line.getAttribute('data-heterogeneous'), 'true');
  assert.ok(line.getAttribute('stroke-dasharray'));
  assert.notEqual(line.getAttribute('x1'), line.getAttribute('x2'));
  assert.notEqual(line.getAttribute('y1'), line.getAttribute('y2'));
  assert.match(document.body.textContent, /guías visuales/);
  assert.match(document.body.textContent, /registros heterogéneos/);
  assert.equal(document.querySelectorAll('tbody tr').length, 2);
});
test('legacy and unknown-provenance weights remain original points while receiving a temporal guide', async () => {
  const rows = [
    sample(1, { weightKg: 80 }),
    sample(2, { weightKg: 79 }, { date: '2026-11-02' }),
    sample(3, { weightKg: 78 }, { date: '2026-11-03' }),
  ];
  responder = () => json(page(rows));
  await render(section());
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 2);
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 3);
  assert.match(
    document.querySelector('table').textContent,
    /método desconocido/
  );
});
test('same-day equal weights keep every ID without averaging, while different weights isolate the ambiguous day', async () => {
  const rows = [
    sample(1, { weightKg: 68.7 }, { date: '2026-11-09' }),
    sample(2, {}, { date: '2026-11-09' }),
    sample(3, { weightKg: 56 }, { date: '2026-11-09' }),
    manual(4, '2026-11-11', { weightKg: 80 }),
    manual(
      5,
      '2026-11-11',
      {},
      { method: 'pliegues', protocol: 'jp3-sites-pending' }
    ),
    manual(
      6,
      '2026-11-11',
      { weightKg: 80 },
      {
        method: 'bioimpedancia',
        provenance: 'device_reported',
        protocol: 'device-kg-litre-v1',
      }
    ),
    manual(
      7,
      '2026-11-13',
      { weightKg: 54 },
      {
        method: 'bioimpedancia',
        provenance: 'device_reported',
        protocol: 'device-kg-litre-v1',
      }
    ),
    manual(
      8,
      '2026-11-13',
      { weightKg: 54 },
      {
        method: 'bioimpedancia',
        provenance: 'device_reported',
        protocol: 'device-kg-litre-v1',
      }
    ),
  ];
  const before = structuredClone(rows),
    links = utils.evolutionSegments(rows, 'weightKg');
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].fromIds, [sample(4).id, sample(6).id]);
  assert.deepEqual(links[0].toIds, [sample(7).id, sample(8).id]);
  assert.deepEqual(rows, before);
  responder = () => json(page(rows));
  await render(section());
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 1);
  assert.equal(document.querySelectorAll('svg [role="button"]').length, 6);
  assert.equal(document.querySelectorAll('tbody tr').length, 8);
  assert.match(document.body.textContent, /Pesos distintos sin orden intradía/);
  assert.match(document.body.textContent, /09 de nov|09 nov/);
  assert.ok(
    document
      .querySelector('[data-evolution-segment]')
      .getAttribute('data-to-ids')
      .includes(sample(8).id)
  );
});
test('a newly confirmed HU-021 weight invalidates cached history and is drawn in the next fresh guide', async () => {
  let saved = false;
  const old = sample(1, { weightKg: 80 });
  const next = manual(2, '2026-11-02', { weightKg: 79 });
  responder = (url, options) =>
    url === '/api/auth/csrf'
      ? json({ csrfToken: 'synthetic-test-csrf' })
      : options?.method === 'POST'
        ? ((saved = true),
          json(
            {
              evaluation: {
                id: next.id,
                clientId,
                evaluationDate: '2026-11-02',
                createdAt: '2026-11-02T12:00:00.000Z',
                weightKg: 79,
                waistCm: null,
                hipCm: null,
                measuredBodyFatPercentage: null,
                pectoralSkinfoldMm: null,
                abdominalSkinfoldMm: null,
                tricepsSkinfoldMm: null,
                suprailiacSkinfoldMm: null,
                thighSkinfoldMm: null,
              },
            },
            201
          ))
        : json(page(saved ? [old, next] : [old]));
  await render(section());
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 0);
  const writes = await vite.ssrLoadModule(
    '/src/features/evaluations/services/evaluations.ts'
  );
  await act(async () =>
    writes.createEvaluation(clientId, 'QA', { weightKg: 79 })
  );
  await click('Actualizar evolución');
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 1);
  assert.equal(document.querySelectorAll('tbody tr').length, 2);
  responder = () => {
    throw new TypeError('Failed to fetch');
  };
  await click('Actualizar evolución');
  assert.match(document.body.textContent, /Datos recuperados de caché/);
  assert.equal(document.querySelectorAll('[data-evolution-segment]').length, 1);
});

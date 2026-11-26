import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let dom;
let vite;
let AdminPage;
let setConfirmHandler;
let createRoot;
let root;
let originalFetch;
let fetchOverride;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 5));
  });

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const currentMonth = () =>
  new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 7);

const sli = (overrides) => ({
  id: 'F-01-E',
  group: 'function',
  category: 'Identidad y acceso',
  name: 'Registro de profesional: éxito',
  slo: '≥ 98 %',
  comparison: '>=',
  target: 98,
  unit: '%',
  observed: 99.5,
  attributable: 99.5,
  samples: 120,
  status: 'met',
  ...overrides,
});

const report = (month) => ({
  version: '3.0',
  month,
  timeZone: 'America/Mexico_City',
  period: { start: `${month}-01T06:00:00Z`, end: `${month}-28T06:00:00Z` },
  generatedAt: `${month}-15T12:00:00Z`,
  slis: [
    sli({}),
    sli({
      id: 'F-07-L',
      category: 'Suscripción simulada',
      name: 'Catálogo público de planes: latencia',
      slo: '≤ 800 ms',
      comparison: '<=',
      target: 800,
      unit: 'ms',
      observed: 1234.5,
      attributable: 1234.5,
      status: 'unmet',
      details: 'p95 sobre 80 peticiones',
    }),
    sli({
      id: 'G-01',
      group: 'platform',
      category: 'Plataforma',
      name: 'Tasa global de error',
      slo: '≤ 2 %',
      unit: '%',
      observed: null,
      attributable: null,
      samples: 10,
      status: 'insufficient_sample',
    }),
    sli({
      id: 'C-01',
      group: 'capacity',
      category: 'Capacidad',
      name: 'Uso de almacenamiento',
      status: 'no_data',
      observed: null,
      attributable: null,
      samples: 0,
    }),
    sli({
      id: 'R-02',
      group: 'continuity',
      category: 'Continuidad',
      name: 'Restauración',
      unit: 'h',
      status: 'unverified',
      observed: null,
      attributable: null,
      samples: 0,
    }),
    sli({
      id: 'O-01',
      group: 'operation',
      category: 'Operación y soporte',
      name: 'Acuse de incidentes',
      status: 'met',
    }),
  ],
  incidents: [
    {
      id: 'inc-1',
      severity: 'alta',
      receivedAt: `${month}-03T16:00:00Z`,
      ackDeadline: `${month}-03T16:30:00Z`,
      acknowledgedAt: `${month}-03T16:10:00Z`,
      ackOnTime: true,
      resolveDeadline: `${month}-03T20:00:00Z`,
      resolvedAt: null,
      resolvedOnTime: null,
      attributable: true,
      cause: 'Caída del proveedor de base de datos',
    },
  ],
  maintenanceWindows: [
    {
      id: 'mw-1',
      start: `${month}-07T07:00:00Z`,
      end: `${month}-07T09:00:00Z`,
      notifiedAt: `${month}-01T07:00:00Z`,
      counted: false,
      reason: 'Fuera del horario permitido',
    },
  ],
  compensation: {
    due: true,
    reasons: ['La disponibilidad D-01 atribuible fue menor a 95 %.'],
  },
  summary: {
    total: 6,
    met: 2,
    unmet: 1,
    insufficient: 1,
    noData: 1,
    unverified: 1,
  },
});

const sampleRecord = {
  id: 'rec-1',
  kind: 'backup',
  occurredAt: '2026-11-02T10:00:00Z',
  endedAt: null,
  details: { ok: true },
  source: 'admin',
};

before(async () => {
  dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/admin/observabilidad',
  });
  for (const key of [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
    'HTMLElement',
    'HTMLDialogElement',
    'HTMLButtonElement',
    'Event',
  ]) {
    if (dom.window[key]) {
      Object.defineProperty(globalThis, key, {
        value: dom.window[key],
        configurable: true,
      });
    }
  }
  if (!dom.window.matchMedia) {
    dom.window.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    const u = String(url);
    const response = await fetchOverride?.(
      new URL(u, window.location.origin),
      options
    );
    if (response) return response;
    if (u.includes('/api/auth/session') || u.includes('/api/admin/session')) {
      return jsonResponse({
        account: {
          id: 'admin-1',
          username: 'admin.qa',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'admin',
        },
      });
    }
    if (u.includes('/api/auth/csrf'))
      return jsonResponse({ csrfToken: 'csrf-qa' });
    return jsonResponse({}, 404);
  };

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
  AdminPage = (
    await vite.ssrLoadModule('/src/features/admin/pages/AdminPage.tsx')
  ).default;
  ({ setConfirmHandler } = await vite.ssrLoadModule(
    '/src/services/confirm.ts'
  ));
});

beforeEach(() => {
  fetchOverride = undefined;
  root = createRoot(document.getElementById('root'));
});

afterEach(async () => {
  setConfirmHandler(null);
  if (root) {
    await act(async () => root.unmount());
    root = null;
  }
});

after(async () => {
  if (root) await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  await vite?.close();
  dom?.window.close();
});

async function openSlaTab() {
  await act(async () => {
    root.render(React.createElement(AdminPage));
  });
  await settle();
  const container = document.getElementById('root');
  const tab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (item) => item.textContent?.trim() === 'SLA v3.0'
  );
  assert.ok(tab, 'Debe existir la pestaña SLA v3.0');
  await act(async () => tab.click());
  await settle();
  return container;
}

function buttonWithText(container, label) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === label
  );
  assert.ok(button, `Debe existir el botón ${label}`);
  return button;
}

async function setField(element, value) {
  const proto =
    element instanceof dom.window.HTMLSelectElement
      ? dom.window.HTMLSelectElement.prototype
      : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}

function fieldByLabel(container, text) {
  const label = Array.from(container.querySelectorAll('label')).find((item) =>
    item.textContent?.startsWith(text)
  );
  assert.ok(label, `Debe existir el campo ${text}`);
  return label.querySelector('input, select');
}

function slaFetch({ records = [], onWrite } = {}) {
  return (url, options) => {
    if (!url.pathname.includes('/sla-v3/')) return undefined;
    const month = url.searchParams.get('month');
    if (url.pathname.endsWith('/sla-v3/report'))
      return jsonResponse({ report: report(month) });
    if (url.pathname.endsWith('/sla-v3/records') && !options?.method)
      return jsonResponse({ records });
    if (options?.method) return onWrite?.(url, options);
    return undefined;
  };
}

test('SLA v3.0 tab renders, hides the period selector and defaults to the current Mexico City month', async () => {
  fetchOverride = slaFetch({ records: [sampleRecord] });
  const container = await openSlaTab();

  assert.equal(
    container.querySelector('select[aria-label="Periodo de evaluación"]'),
    null
  );
  assert.ok(
    container.querySelector('select[aria-label="Ambiente de observabilidad"]')
  );
  const month = container.querySelector('input[type="month"]');
  assert.equal(month.value, currentMonth());
  assert.match(container.textContent, /Resumen del mes/);
  assert.match(container.textContent, /Bitácora SLA/);
  assert.match(container.textContent, /Respaldo/);
});

test('the report groups indicators by section with Spanish labels, compensation and exports', async () => {
  fetchOverride = slaFetch();
  const container = await openSlaTab();
  const text = container.textContent;

  for (const title of [
    'Funciones de negocio',
    'Identidad y acceso',
    'Suscripción simulada',
    'Plataforma',
    'Capacidad',
    'Continuidad',
    'Operación y soporte',
  ]) {
    assert.ok(text.includes(title), `Debe mostrar ${title}`);
  }
  for (const label of [
    'Cumple',
    'No cumple',
    'Muestra insuficiente',
    'Sin datos',
    'Sin comprobar',
  ]) {
    assert.ok(text.includes(label), `Debe mostrar ${label}`);
  }
  assert.match(text, /F-01-E/);
  assert.match(text, /p95 sobre 80 peticiones/);
  assert.match(text, /1,234.5 ms/);
  assert.match(text, /99.5 %/);
  assert.match(text, /Compensación por incumplimiento: aplica/);
  assert.match(text, /D-01 atribuible fue menor a 95 %/);
  assert.match(text, /Caída del proveedor de base de datos/);
  assert.match(text, /Se descuenta: No/);
  assert.match(text, /Fuera del horario permitido/);
  for (const th of container.querySelectorAll('thead th'))
    assert.equal(th.getAttribute('scope'), 'col');

  const month = currentMonth();
  const hrefs = Array.from(container.querySelectorAll('a[download]')).map((a) =>
    a.getAttribute('href')
  );
  assert.deepEqual(hrefs, [
    `/api/admin/observability/sla-v3/export/requests.csv?environment=production&month=${month}`,
    `/api/admin/observability/sla-v3/export/probes.csv?environment=production&month=${month}`,
    `/api/admin/observability/sla-v3/export/incidents.csv?environment=production&month=${month}`,
    `/api/admin/observability/sla-v3/export/operations.csv?environment=production&month=${month}`,
  ]);
});

test('creating a support incident sends CSRF and the UTC-converted JSON body', async () => {
  const writes = [];
  fetchOverride = slaFetch({
    onWrite: (url, options) => {
      writes.push({
        path: url.pathname,
        method: options.method,
        csrf: new Headers(options.headers).get('x-csrf-token'),
        body: JSON.parse(options.body),
      });
      return jsonResponse({ record: sampleRecord }, 201);
    },
  });
  const container = await openSlaTab();

  await act(async () => buttonWithText(container, 'Agregar registro').click());
  await setField(fieldByLabel(container, 'Recibido'), '2026-11-10T10:30');
  await setField(fieldByLabel(container, 'Resuelto'), '2026-11-10T12:00');
  await setField(fieldByLabel(container, 'Severidad'), 'alta');
  await setField(
    fieldByLabel(container, 'Acuse de recibo'),
    '2026-11-10T10:40'
  );
  await setField(fieldByLabel(container, 'Causa'), 'Caída de Render');
  await act(async () => fieldByLabel(container, 'Atribuible').click());
  await act(async () => buttonWithText(container, 'Guardar registro').click());
  await settle();

  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, 'POST');
  assert.equal(writes[0].path, '/api/admin/observability/sla-v3/records');
  assert.equal(writes[0].csrf, 'csrf-qa');
  assert.deepEqual(writes[0].body, {
    environment: 'production',
    kind: 'support_incident',
    occurredAt: '2026-11-10T16:30:00.000Z',
    endedAt: '2026-11-10T18:00:00.000Z',
    details: {
      severity: 'alta',
      acknowledgedAt: '2026-11-10T16:40:00.000Z',
      cause: 'Caída de Render',
      attributable: true,
      requiresRestore: false,
    },
  });
  assert.match(container.textContent, /Registro guardado/);
});

test('creating a maintenance window converts all dates and validates required fields', async () => {
  const writes = [];
  fetchOverride = slaFetch({
    onWrite: (url, options) => {
      writes.push(JSON.parse(options.body));
      return jsonResponse({ record: sampleRecord }, 201);
    },
  });
  const container = await openSlaTab();

  await act(async () => buttonWithText(container, 'Agregar registro').click());
  await setField(
    fieldByLabel(container, 'Tipo de registro'),
    'maintenance_window'
  );
  await setField(fieldByLabel(container, 'Inicio'), '2026-11-14T01:00');
  await act(async () => buttonWithText(container, 'Guardar registro').click());
  await settle();
  assert.equal(writes.length, 0);
  assert.match(
    container.querySelector('form [role="alert"]').textContent,
    /Fin/
  );

  await setField(fieldByLabel(container, 'Fin'), '2026-11-14T03:00');
  await setField(
    fieldByLabel(container, 'Fecha y hora del aviso'),
    '2026-11-10T09:00'
  );
  await act(async () => buttonWithText(container, 'Guardar registro').click());
  await settle();

  assert.deepEqual(writes, [
    {
      environment: 'production',
      kind: 'maintenance_window',
      occurredAt: '2026-11-14T07:00:00.000Z',
      endedAt: '2026-11-14T09:00:00.000Z',
      details: { notifiedAt: '2026-11-10T15:00:00.000Z' },
    },
  ]);
});

test('deleting a record asks for confirmation first', async () => {
  const deletes = [];
  fetchOverride = slaFetch({
    records: [sampleRecord],
    onWrite: (url, options) => {
      deletes.push(`${options.method} ${url.pathname}`);
      return new Response(null, { status: 204 });
    },
  });
  const container = await openSlaTab();
  const asked = [];

  setConfirmHandler(async (request) => {
    asked.push(request.title);
    return false;
  });
  await act(async () => buttonWithText(container, 'Eliminar').click());
  await settle();
  assert.equal(asked.length, 1);
  assert.deepEqual(deletes, []);

  setConfirmHandler(async () => true);
  await act(async () => buttonWithText(container, 'Eliminar').click());
  await settle();
  assert.deepEqual(deletes, [
    'DELETE /api/admin/observability/sla-v3/records/rec-1',
  ]);
});

test('measuring storage posts to the storage endpoint with CSRF', async () => {
  const writes = [];
  fetchOverride = slaFetch({
    onWrite: (url, options) => {
      writes.push({
        path: url.pathname,
        csrf: new Headers(options.headers).get('x-csrf-token'),
        body: JSON.parse(options.body),
      });
      return jsonResponse({ record: sampleRecord }, 201);
    },
  });
  const container = await openSlaTab();
  await act(async () =>
    buttonWithText(container, 'Medir almacenamiento').click()
  );
  await settle();
  assert.deepEqual(writes, [
    {
      path: '/api/admin/observability/sla-v3/storage',
      csrf: 'csrf-qa',
      body: { environment: 'production' },
    },
  ]);
});

test('a changed month hides the previous results while loading and on failure', async () => {
  fetchOverride = slaFetch();
  const container = await openSlaTab();
  assert.match(container.textContent, /Resumen del mes/);

  const pending = Promise.withResolvers();
  fetchOverride = (url) =>
    url.pathname.endsWith('/sla-v3/report') ? pending.promise : undefined;
  await setField(container.querySelector('input[type="month"]'), '2026-10');
  assert.doesNotMatch(container.textContent, /Resumen del mes|F-01-E/);
  assert.match(container.textContent, /Calculando cumplimiento/);

  await act(async () =>
    pending.resolve(
      jsonResponse(
        { error: { code: 'UNAVAILABLE', message: 'SLA no disponible.' } },
        503
      )
    )
  );
  await settle();
  assert.match(
    container.querySelector('[role="alert"]').textContent,
    /SLA no disponible/
  );
  assert.doesNotMatch(container.textContent, /Resumen del mes|F-01-E/);
});

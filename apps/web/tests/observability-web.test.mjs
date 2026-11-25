import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let dom;
let vite;
let AdminPage;
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

  const sampleSli = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'synthetic_availability',
    currentVersion: 1,
    name: 'Disponibilidad sintética global',
    description: 'Disponibilidad observada.',
    service: 'platform',
    characteristic: 'Disponibilidad',
    dataSource: 'synthetic_availability',
    indicatorType: 'availability',
    unit: '%',
    calculationMethod: {},
    inclusionCriteria: 'Sondeos regulares',
    exclusionCriteria: 'Simulacros',
    evaluationPeriod: '7d',
    isActive: true,
    observedValue: 100,
    samples: 12,
    notExecutedCount: 0,
    note: null,
  };

  const sampleSlo = {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'slo_availability',
    sliId: sampleSli.id,
    sliCode: sampleSli.code,
    sliName: sampleSli.name,
    currentVersion: 1,
    name: 'Disponibilidad >= 99%',
    description: 'Objetivo interno.',
    targetValue: 99,
    comparisonOperator: '>=',
    unit: '%',
    evaluationPeriod: '7d',
    minSamples: 1,
    effectiveFrom: '2026-11-25T12:00:00Z',
    effectiveTo: null,
    status: 'active',
    isContractual: false,
    observedValue: 100,
    deltaValue: 1,
    samples: 12,
    notExecutedCount: 0,
    complianceStatus: 'met',
    errorBudgetTotal: 1,
    errorBudgetConsumed: 0,
    errorBudgetRemainingPct: 100,
    trendDirection: 'stable',
    previousObservedValue: 100,
    notes: null,
  };

  const sampleDashboard = {
    environment: 'production',
    period: '24h',
    periodStart: '2026-11-24T12:00:00Z',
    periodEnd: '2026-11-25T12:00:00Z',
    generatedAt: '2026-11-25T12:00:00Z',
    services: [
      {
        id: 'web',
        name: 'Aplicación Web (Vercel)',
        state: 'operational',
        lastCheckedAt: '2026-11-25T11:55:00Z',
        availabilityPct: 100,
        latencyP95Ms: 210,
        detail: 'Última comprobación exitosa.',
      },
      {
        id: 'api',
        name: 'Backend API (Render)',
        state: 'degraded',
        lastCheckedAt: '2026-11-25T11:55:00Z',
        availabilityPct: 98.5,
        latencyP95Ms: 1200,
        detail: 'Latencia elevada.',
      },
      {
        id: 'database',
        name: 'Base de datos (PostgreSQL / Supabase)',
        state: 'insufficient_data',
        lastCheckedAt: null,
        availabilityPct: null,
        latencyP95Ms: null,
        detail: 'Sin comprobaciones suficientes.',
      },
    ],
    kpis: {
      availabilityPct: 99.2,
      avgLatencyMs: 85,
      p50LatencyMs: 60,
      p95LatencyMs: 320,
      p99LatencyMs: 700,
      requestsTotal: 140,
      requestsSucceeded: 138,
      requestsFailed: 2,
      errorRatePct: 1.43,
      checksPassed: 10,
      checksFailed: 1,
      checksNotExecuted: 2,
      slosMet: 1,
      slosUnmet: 0,
      slosInsufficient: 0,
      openIncidents: 1,
    },
    modules: [
      {
        module: 'training',
        requestsTotal: 40,
        errorRatePct: 0,
        p95LatencyMs: 95,
        checksPassed: 2,
        checksFailed: 0,
        state: 'operational',
      },
    ],
    history: [
      {
        bucket: '2026-11-25T11:00:00Z',
        requestsTotal: 140,
        errorRatePct: 1.43,
        latencyP50Ms: 60,
        latencyP95Ms: 320,
        availabilityPct: 99.2,
        checksPassed: 10,
        checksFailed: 1,
      },
    ],
    activeIncidents: [],
    slos: [sampleSlo],
    limitations: [
      'Los SLO internos no equivalen a acuerdos SLA contractuales.',
    ],
  };

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
    if (u.includes('/api/admin/observability/dashboard')) {
      return jsonResponse(sampleDashboard);
    }
    if (u.includes('/api/admin/observability/logs')) {
      return jsonResponse({
        total: 1,
        page: 1,
        pageSize: 25,
        items: [
          {
            id: 'log-1',
            category: 'operational',
            correlationId: 'corr-1',
            occurredAt: '2026-11-25T11:55:00Z',
            environment: 'production',
            service: 'api',
            module: 'plans',
            source: 'operational',
            eventType: 'http.request',
            severity: 'info',
            operation: 'GET /api/plans',
            normalizedPath: '/api/plans',
            httpMethod: 'GET',
            statusCode: 200,
            durationMs: 44.2,
            outcome: 'success',
            errorCode: null,
            errorMessage: null,
            systemVersion: '1.0.0',
            metadata: {},
          },
        ],
      });
    }
    if (u.includes('/api/admin/observability/slis')) {
      return jsonResponse({
        environment: 'production',
        period: '24h',
        items: [sampleSli],
      });
    }
    if (u.includes('/api/admin/observability/slos')) {
      return jsonResponse({
        environment: 'production',
        period: '24h',
        items: [sampleSlo],
      });
    }
    if (u.includes('/api/admin/observability/slas')) {
      return jsonResponse({
        environment: 'production',
        period: '24h',
        items: [],
      });
    }
    if (u.includes('/api/admin/observability/checks')) {
      return jsonResponse({
        environment: 'production',
        runtimeEnvironment: 'production',
        period: '24h',
        page: 1,
        pageSize: 20,
        totalRuns: 0,
        settings: {
          monitorEnabled: true,
          checkIntervalMinutes: 5,
          logRetentionDays: 30,
          checkRetentionDays: 90,
          evaluationRetentionDays: 365,
          incidentErrorRateThresholdPct: 5,
          incidentLatencyP95ThresholdMs: 2000,
          incidentConsecutiveFailures: 2,
          updatedAt: '2026-11-25T12:00:00Z',
        },
        authorizedChecks: [
          {
            key: 'api_liveness',
            name: 'Disponibilidad del proceso API',
            description: 'Verifica respuesta viva.',
            service: 'api',
            module: 'health',
            kind: 'synthetic_availability',
            safeInProduction: true,
            configured: true,
          },
        ],
        runs: [],
        latestChecks: [],
      });
    }
    if (u.includes('/api/admin/observability/incidents')) {
      return jsonResponse({ items: [] });
    }
    if (u.includes('/api/admin/observability/reports')) {
      return jsonResponse({
        generatedAt: '2026-11-25T12:00:00Z',
        environment: 'production',
        period: '24h',
        periodStart: '2026-11-24T12:00:00Z',
        periodEnd: '2026-11-25T12:00:00Z',
        dashboard: sampleDashboard,
        slis: [sampleSli],
        slas: [],
        runs: [],
        totalRuns: 0,
        recentErrors: [],
        totalErrors: 0,
        incidents: [],
        markdown: '# Reporte de Observabilidad',
      });
    }
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
});

beforeEach(() => {
  fetchOverride = undefined;
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
  globalThis.fetch = originalFetch;
  await vite?.close();
  dom?.window.close();
});

async function renderAdmin() {
  await act(async () => {
    root.render(React.createElement(AdminPage));
  });
  await settle();
  return document.getElementById('root');
}

async function clickTab(container, label) {
  const button = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (item) => item.textContent?.trim() === label
  );
  assert.ok(button, `Debe existir la pestaña ${label}`);
  await act(async () => button.click());
  await settle();
}

async function selectOption(container, label, value) {
  const select = container.querySelector(`select[aria-label="${label}"]`);
  assert.ok(select);
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function buttonWithText(container, label) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === label
  );
  assert.ok(button, `Debe existir el botón ${label}`);
  return button;
}

test('AdminPage renders Observabilidad y niveles de servicio and switches across all operational tabs', async () => {
  const container = await renderAdmin();

  assert.match(container.textContent, /Observabilidad y niveles de servicio/);
  assert.match(container.textContent, /Aplicación Web \(Vercel\)/);
  assert.match(container.textContent, /Operativo/);
  assert.match(container.textContent, /Degradado/);
  assert.match(container.textContent, /Sin información suficiente/);

  await clickTab(container, 'Explorador de logs');
  assert.match(container.textContent, /GET \/api\/plans/);

  await clickTab(container, 'SLI');
  assert.match(container.textContent, /Disponibilidad sintética global/);

  await clickTab(container, 'SLO');
  assert.match(
    container.textContent,
    /no constituyen un acuerdo contractual SLA aprobado/i
  );

  await clickTab(container, 'SLA');
  assert.match(container.textContent, /Sin acuerdos SLA registrados/);

  await clickTab(container, 'Pruebas automatizadas');
  assert.match(container.textContent, /Disponibilidad del proceso API/);

  await clickTab(container, 'Incidentes');
  assert.match(container.textContent, /Sin incidentes registrados/);

  await clickTab(container, 'Reportes');
  assert.match(container.textContent, /Resumen ejecutivo del periodo/);
});

test('reports hide previous results and exports while a changed filter is pending or fails', async () => {
  const container = await renderAdmin();
  await clickTab(container, 'Reportes');
  assert.match(container.textContent, /Descargar JSON/);

  const pending = Promise.withResolvers();
  fetchOverride = (url) =>
    url.pathname.endsWith('/reports') ? pending.promise : undefined;
  await selectOption(container, 'Periodo de evaluación', '7d');
  assert.doesNotMatch(
    container.textContent,
    /Descargar JSON|Resumen ejecutivo/
  );
  await act(async () =>
    pending.resolve(
      jsonResponse(
        {
          error: {
            code: 'UNAVAILABLE',
            message: 'Reporte temporalmente no disponible.',
          },
        },
        503
      )
    )
  );
  await settle();
  assert.match(
    container.querySelector('[role="alert"]').textContent,
    /temporalmente no disponible/
  );
  assert.doesNotMatch(container.textContent, /Descargar|Resumen ejecutivo/);
});

test('checks use the selected period, allow browsing runs and restrict manual execution to the runtime', async () => {
  const start = '2026-11-25T11:55:00Z';
  const firstId = '22222222-2222-4222-8222-222222222221';
  const secondId = '22222222-2222-4222-8222-222222222222';
  const requests = [];
  fetchOverride = (url) => {
    if (!url.pathname.endsWith('/checks')) return undefined;
    const params = url.searchParams;
    requests.push(Object.fromEntries(params));
    const page = Number(params.get('page') ?? 1);
    const runId = params.get('runId');
    const run = {
      id: page === 1 ? firstId : secondId,
      category: 'synthetic_periodic',
      triggerSource: 'github_actions',
      status: 'passed',
      startedAt: start,
      durationMs: 150,
      passedChecks: 1,
      failedChecks: 0,
      notExecutedChecks: 0,
      skippedChecks: 0,
      totalChecks: 1,
    };
    return jsonResponse({
      environment: params.get('environment'),
      runtimeEnvironment: 'production',
      period: params.get('period'),
      page,
      pageSize: 1,
      totalRuns: 2,
      settings: {
        monitorEnabled: true,
        checkIntervalMinutes: 30,
        logRetentionDays: 30,
        checkRetentionDays: 90,
        evaluationRetentionDays: 365,
        incidentErrorRateThresholdPct: 5,
        incidentLatencyP95ThresholdMs: 2000,
        incidentConsecutiveFailures: 2,
        updatedAt: start,
      },
      authorizedChecks: [
        {
          key: 'api_liveness',
          name: 'Disponibilidad del proceso API',
          description: 'Verifica respuesta viva.',
          service: 'api',
          configured: true,
        },
      ],
      runs: [run],
      latestChecks:
        runId === secondId
          ? [
              {
                id: 'check-second',
                runId,
                executedAt: start,
                checkName: 'Comprobación del segundo lote',
                service: 'api',
                module: 'health',
                status: 'passed',
                expectedResult: 'Salud válida',
                actualResult: 'Salud conforme',
                httpStatus: 200,
                durationMs: 150,
              },
            ]
          : [],
    });
  };

  const container = await renderAdmin();
  await clickTab(container, 'Pruebas automatizadas');
  assert.equal(requests[0].period, '24h');
  assert.equal(
    buttonWithText(container, 'Ejecutar seleccionadas').disabled,
    false
  );

  await act(async () => buttonWithText(container, 'Siguiente').click());
  await settle();
  assert.equal(requests.at(-1).page, '2');
  await act(async () => buttonWithText(container, 'Ver resultados').click());
  await settle();
  assert.equal(requests.at(-1).runId, secondId);
  assert.match(container.textContent, /Comprobación del segundo lote/);
  assert.match(container.textContent, /Salud válida.*Salud conforme/);

  await selectOption(container, 'Ambiente de observabilidad', 'development');
  await settle();
  assert.equal(requests.at(-1).environment, 'development');
  assert.equal(requests.at(-1).page, '1');
  assert.equal(
    buttonWithText(container, 'Ejecutar seleccionadas').disabled,
    true
  );
  assert.doesNotMatch(container.textContent, /Comprobación del segundo lote/);
});

test('editing an HTTP SLI preserves its executable inclusion and exclusion criteria', async () => {
  const calculationMethod = {
    module: 'training',
    thresholdMs: 1000,
    methods: ['GET'],
    pathPrefix: '/api/clients',
    excludePaths: ['/api/clients/inactive'],
    statusCodes: [200, 304],
  };
  const id = '11111111-1111-4111-8111-111111111112';
  const definition = {
    id,
    code: 'latency_valid_training',
    currentVersion: 1,
    name: 'Consultas válidas de entrenamiento',
    description: 'Consulta de entrenamiento bajo umbral.',
    service: 'api',
    characteristic: 'Latencia',
    dataSource: 'operational_http',
    indicatorType: 'latency_threshold_pct',
    unit: '%',
    calculationMethod,
    inclusionCriteria: 'Lecturas válidas de entrenamiento',
    exclusionCriteria: 'Rutas sin expedientes activos',
    evaluationPeriod: '7d',
    isActive: true,
    observedValue: null,
    samples: 0,
    note: null,
  };
  let saved;
  fetchOverride = (url, options) => {
    if (url.pathname.endsWith('/auth/csrf'))
      return jsonResponse({ csrfToken: 'csrf-qa' });
    if (url.pathname.endsWith('/slis'))
      return jsonResponse({ items: [definition] });
    if (url.pathname.endsWith(`/slis/${id}`) && options.method === 'PUT') {
      saved = JSON.parse(options.body);
      return jsonResponse({ sli: definition });
    }
    return undefined;
  };

  const container = await renderAdmin();
  await clickTab(container, 'SLI');
  await act(async () => buttonWithText(container, 'Editar').click());
  assert.equal(
    container.querySelector('input[placeholder="/api/clients"]').value,
    '/api/clients'
  );
  await act(async () =>
    buttonWithText(container, 'Guardar nueva versión').click()
  );
  await settle();
  assert.deepEqual(saved?.calculationMethod, calculationMethod);
});

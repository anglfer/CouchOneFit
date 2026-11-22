import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

let dom;
let vite;
let planRecommendation;
let MarketingPage;
let createRoot;
let root;
let originalFetch;

const catalog = [
  {
    id: 'elite',
    name: 'Élite ilimitado',
    maxClients: null,
    isUnlimited: true,
    priceMxn: 999,
  },
  {
    id: 'basic',
    name: 'Básico 10',
    maxClients: 10,
    isUnlimited: false,
    priceMxn: 299,
  },
  {
    id: 'pro',
    name: 'Pro 30',
    maxClients: 30,
    isUnlimited: false,
    priceMxn: 599,
  },
];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 5));
  });

before(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
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
  if (!dom.window.Element.prototype.scrollIntoView) {
    dom.window.Element.prototype.scrollIntoView = () => {};
  }
  if (dom.window.HTMLDialogElement) {
    if (!dom.window.HTMLDialogElement.prototype.showModal) {
      dom.window.HTMLDialogElement.prototype.showModal = function showModal() {
        this.open = true;
      };
    }
    if (!dom.window.HTMLDialogElement.prototype.close) {
      dom.window.HTMLDialogElement.prototype.close = function close() {
        this.open = false;
        this.dispatchEvent(new dom.window.Event('close'));
      };
    }
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/plans')) {
      return new Response(
        JSON.stringify({
          plans: [catalog[1], catalog[2], catalog[0]],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
    return new Response('{}', {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };

  createRoot = (await import('react-dom/client')).createRoot;
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  planRecommendation = await vite.ssrLoadModule(
    '/src/features/marketing/utils/planRecommendation.ts'
  );
  MarketingPage = (
    await vite.ssrLoadModule('/src/features/marketing/pages/MarketingPage.tsx')
  ).default;
});

beforeEach(() => {
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

test('recommendPlanForClients selects the smallest fitting plan even with unordered catalog', () => {
  const one = planRecommendation.recommendPlanForClients(catalog, 1);
  assert.equal(one.recommendedPlan?.id, 'basic');
  assert.equal(one.remainingSlots, 9);
  assert.equal(one.occupancyPercent, 10);

  const ten = planRecommendation.recommendPlanForClients(catalog, 10);
  assert.equal(ten.recommendedPlan?.id, 'basic');
  assert.equal(ten.remainingSlots, 0);
  assert.equal(ten.occupancyPercent, 100);

  const eighteen = planRecommendation.recommendPlanForClients(catalog, 18);
  assert.equal(eighteen.recommendedPlan?.id, 'pro');
  assert.equal(eighteen.remainingSlots, 12);
  assert.equal(eighteen.costPerClientMxn, 33);
  assert.equal(eighteen.occupancyPercent, 60);

  const thirtyOne = planRecommendation.recommendPlanForClients(catalog, 31);
  assert.equal(thirtyOne.recommendedPlan?.id, 'elite');
  assert.equal(thirtyOne.remainingSlots, null);
  assert.equal(thirtyOne.occupancyPercent, 100);
});

test('recommendPlanForClients handles empty catalog and non-positive counts safely', () => {
  const empty = planRecommendation.recommendPlanForClients([], 15);
  assert.equal(empty.recommendedPlan, null);
  assert.equal(empty.remainingSlots, null);
  assert.equal(empty.costPerClientMxn, null);
  assert.equal(empty.occupancyPercent, 0);

  const normalized = planRecommendation.recommendPlanForClients(catalog, 0);
  assert.equal(normalized.recommendedPlan?.id, 'basic');
  assert.equal(normalized.remainingSlots, 9);
  assert.equal(normalized.costPerClientMxn, 299);
});

test('formatCostPerClient formats MXN integer approximations and rejects invalid prices', () => {
  assert.equal(planRecommendation.formatCostPerClient(599, 20), '$30');
  assert.equal(planRecommendation.formatCostPerClient('999.00', 40), '$25');
  assert.equal(planRecommendation.formatCostPerClient(0, 10), null);
  assert.equal(planRecommendation.formatCostPerClient('invalid', 10), null);
});

test('MarketingPage renders interactive modules, visibility simulator, comparison, plans estimator and preserves HU-039 routes', async () => {
  await act(async () => {
    root.render(React.createElement(MarketingPage));
  });
  await settle();

  const container = document.getElementById('root');
  const fullText = container.textContent;
  assert.match(
    fullText,
    /Un solo sistema para tu cartera\.\s*Una app real para cada cliente\./
  );
  assert.match(
    fullText,
    /Capturas reales del producto con datos de demostración/
  );

  // Hero: 5 tabs including Alimentación + native <dialog> lightbox.
  const nutritionTab = document.getElementById('modulo-alimentacion');
  assert.ok(nutritionTab);
  await act(async () => {
    nutritionTab.click();
  });
  assert.equal(nutritionTab.getAttribute('aria-selected'), 'true');
  assert.match(
    container.textContent,
    /Plan v1 · 1750 kcal · P 144 \/ C 174 \/ G 53 g/
  );

  const zoomButtons = Array.from(container.querySelectorAll('button')).filter(
    (btn) => btn.textContent?.includes('Ampliar capturas')
  );
  assert.equal(zoomButtons.length, 1);
  await act(async () => {
    zoomButtons[0].click();
  });
  const openDialog = container.querySelector('dialog[open]');
  assert.ok(openDialog);
  assert.match(
    openDialog.textContent ?? '',
    /Alimentación · Panel profesional/
  );

  const closeDialogButton = openDialog.querySelector(
    'button[aria-label="Cerrar vista ampliada"]'
  );
  assert.ok(closeDialogButton);
  await act(async () => {
    closeDialogButton.click();
  });
  assert.equal(container.querySelector('dialog[open]'), null);

  // TwoSides: switch to Visibilidad controlada and toggle DEC-009 controls.
  const visibilityTab = document.getElementById('escena-visibilidad');
  assert.ok(visibilityTab);
  await act(async () => {
    visibilityTab.click();
  });
  assert.match(
    container.textContent,
    /Visible hoy en su app: Entrenamientos y check-ins propios · Medidas evaluadas \(26\.7 % grasa\) · Adherencia compartida/
  );
  const measuresToggle = Array.from(container.querySelectorAll('button')).find(
    (btn) => btn.textContent?.includes('Medidas evaluadas')
  );
  assert.ok(measuresToggle);
  await act(async () => {
    measuresToggle.click();
  });
  assert.equal(measuresToggle.getAttribute('aria-pressed'), 'false');
  assert.doesNotMatch(
    container.textContent,
    /Visible hoy en su app:.*Medidas evaluadas/
  );

  // RecordCoverage: switch area and daily comparison moment.
  const evalButton = Array.from(container.querySelectorAll('button')).find(
    (btn) =>
      btn.textContent?.includes('Evaluación') &&
      btn.textContent?.includes('Bioimpedancia')
  );
  assert.ok(evalButton);
  await act(async () => {
    evalButton.click();
  });
  assert.match(container.textContent, /Resumen y evaluación · Mariana Ríos/);

  const offlineMomentButton = Array.from(
    container.querySelectorAll('button')
  ).find((btn) => btn.textContent?.trim() === 'Sin señal en consulta');
  assert.ok(offlineMomentButton);
  await act(async () => {
    offlineMomentButton.click();
  });
  assert.match(
    container.textContent,
    /La PWA profesional lee expedientes guardados sin conexión/
  );

  // Plans: default 18 recommends Pro 30; switching to 45 recommends Élite ilimitado.
  assert.match(container.textContent, /Plan sugerido: Pro 30/);
  const fortyFivePreset = Array.from(container.querySelectorAll('button')).find(
    (btn) => btn.textContent?.trim() === '45 clientes'
  );
  assert.ok(fortyFivePreset);
  await act(async () => {
    fortyFivePreset.click();
  });
  assert.match(container.textContent, /Plan sugerido: Élite ilimitado/);

  // Routes and non-exclusive FAQ count.
  const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
    a.getAttribute('href')
  );
  assert.ok(hrefs.includes('/registro'));
  assert.ok(hrefs.includes('/registro?plan=basic'));
  assert.ok(hrefs.includes('/registro?plan=pro'));
  assert.ok(hrefs.includes('/registro?plan=elite'));
  assert.ok(hrefs.includes('/acceso'));
  assert.ok(hrefs.includes('/recuperar'));
  assert.ok(hrefs.includes('/privacidad'));
  assert.equal(container.querySelectorAll('.mk-faq details').length, 7);
});

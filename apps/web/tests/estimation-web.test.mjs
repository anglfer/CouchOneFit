import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
let vite, Composition, valid;
const snapshot = () => ({
  method: 'pliegues',
  equation: 'male',
  effectiveDate: '2026-11-13',
  ageYears: 30,
  version: 'composition-estimation-v1',
  protocol: 'jp3-sites-pending@technical-reference-v1',
  provenance: 'manual_measurements',
  calculationStatus: 'pending_verification',
  measurements: { pectoralSkinfoldMm: 10.1 },
  results: {},
  estimation: {
    schemaVersion: 1,
    methodId: 'jackson-pollock-3-siri',
    variant: 'male',
    formulaVersion: null,
    domainPolicyVersion: null,
    protocol: { id: 'jp3-sites-pending', version: 'technical-reference-v1' },
    provenance: 'server_estimation',
    inputs: {
      effectiveDate: '2026-11-13',
      ageYears: 30,
      unit: 'mm',
      skinfolds: { pectoralSkinfoldMm: 10.1 },
    },
    status: 'unavailable',
    result: null,
    reasons: [{ code: 'scientific_verification_pending', fields: [] }],
  },
});
before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  Composition = (
    await vite.ssrLoadModule(
      '/src/features/evaluations/components/CompositionResults.tsx'
    )
  ).default;
  valid = (
    await vite.ssrLoadModule('/src/features/evaluations/types/evaluation.ts')
  ).isEvaluation;
});
after(async () => {
  await vite?.close();
});
const evaluation = (assessment = snapshot()) => ({
  id: '10000000-0000-4000-8000-000000000001',
  clientId: '20000000-0000-4000-8000-000000000001',
  evaluationDate: '2026-11-13',
  createdAt: '2026-11-13T12:00:00Z',
  weightKg: null,
  waistCm: null,
  hipCm: null,
  measuredBodyFatPercentage: null,
  pectoralSkinfoldMm: 10.1,
  abdominalSkinfoldMm: null,
  tricepsSkinfoldMm: null,
  suprailiacSkinfoldMm: null,
  thighSkinfoldMm: null,
  assessment,
});

test('HU-023 confirmed pending response is accepted, keeps null result and does not fabricate approval', () => {
  const s = snapshot();
  assert(valid(evaluation(s)));
  assert.equal(s.estimation.result, null);
  assert.equal(s.estimation.formulaVersion, null);
  const original = structuredClone(s);
  assert(valid(evaluation(s)));
  assert.deepEqual(s, original);
});
test('HU-023 rejects candidate/available payloads, unknown references and activation flags', () => {
  for (const patch of [
    { status: 'candidate_only' },
    { status: 'available', result: { estimatedBodyFatPercentage: 20 } },
    { activationAllowed: true },
    { formulaVersion: 'approved-fake' },
    { protocol: { id: 'unknown', version: 'unknown' } },
  ]) {
    const s = snapshot();
    Object.assign(s.estimation, patch);
    assert.equal(valid(evaluation(s)), false);
  }
});
test('HU-023 rejects inconsistent dates, age, variant and captured inputs', () => {
  for (const field of ['effectiveDate', 'ageYears', 'skinfolds']) {
    const s = snapshot();
    s.estimation.inputs[field] =
      field === 'effectiveDate' ? '2026-11-12' : field === 'ageYears' ? 99 : {};
    assert.equal(valid(evaluation(s)), false);
  }
  const s = snapshot();
  s.estimation.variant = 'female';
  assert.equal(valid(evaluation(s)), false);
});
test('HU-023 old/offline confirmed responses remain valid without adding estimation', () => {
  const s = snapshot();
  delete s.estimation;
  s.version = 'composition-arithmetic-v1';
  s.protocol = 'jp3-sites-pending';
  assert(valid(evaluation(s)));
  assert.equal('estimation' in s, false);
  const legacy = evaluation();
  delete legacy.assessment;
  assert(valid(legacy));
});
test('HU-021 available device results remain available and explicitly informed, not JP3 estimates', () => {
  const html = renderToStaticMarkup(
    React.createElement(Composition, {
      results: { bodyFatPercentage: 25, fatMassKg: 20 },
    })
  );
  assert.match(html, /Grasa corporal informada/);
  assert.match(html, /25.0/);
  assert.match(html, /Masa grasa/);
});

function officialSnapshot() {
  const a = snapshot();
  delete a.estimation;
  a.version = 'composition-skinfold-v1';
  a.calculationStatus = 'available';
  a.measurements = {
    pectoralSkinfoldMm: 20,
    abdominalSkinfoldMm: 20,
    thighSkinfoldMm: 20,
  };
  const density = 1.10938 - 0.0008267 * 60 + 0.0000016 * 3600 - 0.0002574 * 30;
  a.results = {
    bodyFatPercentage: 495 / density - 450,
    sumSkinfoldMm: 60,
    bodyDensityGPerMl: density,
  };
  return a;
}

test('HU-023 official skinfold results are accepted and labelled as JP3 + Siri estimates', () => {
  const a = officialSnapshot();
  assert.equal(valid(evaluation(a)), true);
  const html = renderToStaticMarkup(
    React.createElement(Composition, { method: 'pliegues', results: a.results })
  );
  assert.match(html, /Grasa corporal estimada/);
  assert.match(html, /17\.9/);
  assert.match(html, /Jackson–Pollock 3 pliegues \+ Siri/);
  assert.match(html, /1\.0578/);
  assert.doesNotMatch(html, /informada|pendiente de validación/);
});

test('HU-023 skinfold form always offers the equation, previews JP3 + Siri and sends no estimation request', async () => {
  const { JSDOM } = await import('jsdom');
  const { act } = await import('react');
  // Not a loopback host: the calculation is no longer a local-only candidate.
  const dom = new JSDOM('<div id="official-test"></div>', {
    url: 'http://app.example.test/app/clientes/20000000-0000-4000-8000-000000000001/evaluacion/nueva',
  });
  const keys = [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
  ];
  const previous = keys.map((k) => [
    k,
    Object.getOwnPropertyDescriptor(globalThis, k),
  ]);
  const priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  const priorFetch = globalThis.fetch;
  let root;
  try {
    for (const k of keys)
      Object.defineProperty(globalThis, k, {
        value: dom.window[k],
        configurable: true,
      });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const store = await vite.ssrLoadModule('/src/services/offline/store.ts');
    store.setOfflineStore(store.createMemoryStore());
    const Form = (
      await vite.ssrLoadModule(
        '/src/features/evaluations/components/AssessmentForm.tsx'
      )
    ).default;
    const { createRoot } = await import('react-dom/client');
    root = createRoot(document.getElementById('official-test'));
    await act(async () => {
      root.render(
        React.createElement(Form, {
          clientId: '20000000-0000-4000-8000-000000000001',
          clientName: 'Synthetic',
          birthDate: '1996-01-15',
          onSaved: () => {},
          onQueued: () => {},
        })
      );
    });
    const pliegues = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Pliegues cutáneos')
    );
    await act(async () => pliegues.click());
    assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 0);
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    const type = async (element, value) =>
      act(async () => {
        setter.call(element, value);
        element.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
    await type(document.querySelector('input[type="date"]'), '2026-11-20');
    const select = document.querySelector('select');
    const chooseEquation = async (value) =>
      act(async () => {
        select.value = value;
        select.dispatchEvent(new window.Event('change', { bubbles: true }));
      });
    const requiredFields = () =>
      [...document.querySelectorAll('input[required]')].map(
        (input) => input.name
      );
    await chooseEquation('female');
    assert.deepEqual(requiredFields(), [
      'tricepsSkinfoldMm',
      'suprailiacSkinfoldMm',
      'thighSkinfoldMm',
    ]);
    await chooseEquation('male');
    assert.deepEqual(requiredFields(), [
      'pectoralSkinfoldMm',
      'abdominalSkinfoldMm',
      'thighSkinfoldMm',
    ]);
    assert.match(
      document.body.textContent,
      /Edad a la fecha de medición: 30 años/
    );
    await type(document.getElementById('assessment-pectoralSkinfoldMm'), '20');
    await type(document.getElementById('assessment-abdominalSkinfoldMm'), '20');
    assert.match(
      document.body.textContent,
      /Faltan pliegues para el % de grasa: muslo/
    );
    await type(document.getElementById('assessment-thighSkinfoldMm'), '20');
    assert.match(document.body.textContent, /17\.9%/);
    const posts = [];
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).endsWith('/auth/csrf'))
        return new Response(
          JSON.stringify({ csrfToken: 'synthetic-unit-csrf' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      posts.push(JSON.parse(options.body));
      return new Response(
        JSON.stringify({
          evaluation: {
            ...evaluation(officialSnapshot()),
            abdominalSkinfoldMm: 20,
            thighSkinfoldMm: 20,
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    };
    await act(async () =>
      document
        .querySelector('form')
        .dispatchEvent(
          new window.Event('submit', { bubbles: true, cancelable: true })
        )
    );
    assert.equal(posts.length, 1);
    assert.equal(posts[0].equation, 'male');
    assert.equal('estimationRequest' in posts[0], false);
    assert.match(document.body.textContent, /Resultados guardados/);
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const [k, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor);
      else delete globalThis[k];
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
    globalThis.fetch = priorFetch;
  }
});

function candidateSnapshot(variant = 'male', age = 30) {
  const a = snapshot();
  a.version = 'composition-candidate-v1';
  a.equation = variant;
  a.ageYears = age;
  a.protocol = `jp3-${variant}-candidate@technical-candidate-v1`;
  a.measurements =
    variant === 'male'
      ? { pectoralSkinfoldMm: 10, abdominalSkinfoldMm: 15, thighSkinfoldMm: 20 }
      : {
          tricepsSkinfoldMm: 12,
          suprailiacSkinfoldMm: 13,
          thighSkinfoldMm: 20,
        };
  const s = 45;
  const density =
    variant === 'male'
      ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age
      : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * age;
  a.estimation = {
    ...a.estimation,
    variant,
    protocol: {
      id: `jp3-${variant}-candidate`,
      version: 'technical-candidate-v1',
    },
    technicalFormulaVersion: 'jp3-siri-arithmetic-candidate-v1',
    technicalDomainVersion: 'jp3-reference-ranges-candidate-v1',
    scientificStatus: 'not_validated',
    activationAllowed: false,
    status: 'candidate_only',
    inputs: {
      effectiveDate: a.effectiveDate,
      ageYears: age,
      unit: 'mm',
      skinfolds: { ...a.measurements },
    },
    result: {
      sumSkinfoldMm: s,
      bodyDensityGPerMl: density,
      estimatedBodyFatPercentage: 495 / density - 450,
    },
    reasons: [],
    blockers: [
      'scientific_verification_pending',
      'domain_approval_pending',
      'protocol_approval_pending',
      'independent_reference_cases_pending',
      ...(variant === 'female' ? ['female_equation_original_pending'] : []),
      ...(variant === 'female' && age > 40
        ? ['female_over_40_caution_pending']
        : []),
    ],
  };
  return a;
}

test('HU-023 candidate response keeps technical versions, selected sites and scientific blockers distinct from measured fat', () => {
  for (const variant of ['male', 'female']) {
    const a = candidateSnapshot(variant);
    assert.equal(valid(evaluation(a)), true);
    for (const patch of [
      { status: 'available' },
      { activationAllowed: true },
      { scientificStatus: 'approved' },
      { formulaVersion: 'approved-v1' },
      { technicalFormulaVersion: 'unknown' },
      { result: null },
      { result: { ...a.estimation.result, estimatedBodyFatPercentage: 100 } },
      { protocol: { id: 'unknown', version: 'technical-candidate-v1' } },
      { blockers: [] },
      { inputs: { ...a.estimation.inputs, skinfolds: {} } },
    ])
      assert.equal(
        valid(evaluation({ ...a, estimation: { ...a.estimation, ...patch } })),
        false
      );
    const missing = {
      ...a,
      estimation: {
        ...a.estimation,
        status: 'unavailable',
        result: null,
        reasons: [
          {
            code: 'missing_measurements',
            fields: ['skinfolds.thighSkinfoldMm'],
          },
        ],
      },
    };
    assert.equal(valid(evaluation(missing)), true);
    assert.equal(
      valid(
        evaluation({
          ...a,
          ageYears: 17,
          estimation: {
            ...a.estimation,
            inputs: { ...a.estimation.inputs, ageYears: 17 },
          },
        })
      ),
      false
    );
  }
});

test('AnatomicalGuide renders sculpted musculature, method-scoped pins, zoom focus, required indicators and focuses matching form input', async () => {
  const { JSDOM } = await import('jsdom');
  const { act } = await import('react');
  const dom = new JSDOM('<div id="anatomical-guide-test"></div>', {
    url: 'http://127.0.0.1/app/clientes/20000000-0000-4000-8000-000000000001/evaluacion/nueva',
  });
  const keys = [
    'window',
    'document',
    'navigator',
    'localStorage',
    'sessionStorage',
  ];
  const previous = keys.map((k) => [
    k,
    Object.getOwnPropertyDescriptor(globalThis, k),
  ]);
  const priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  let root;
  try {
    for (const k of keys)
      Object.defineProperty(globalThis, k, {
        value: dom.window[k],
        configurable: true,
      });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const store = await vite.ssrLoadModule('/src/services/offline/store.ts');
    store.setOfflineStore(store.createMemoryStore());
    const Form = (
      await vite.ssrLoadModule(
        '/src/features/evaluations/components/AssessmentForm.tsx'
      )
    ).default;
    const AnatomicalGuide = (
      await vite.ssrLoadModule(
        '/src/features/evaluations/components/AnatomicalGuide.tsx'
      )
    ).default;

    const allHtml = renderToStaticMarkup(
      React.createElement(AnatomicalGuide, {
        active: 'abdomenUmbilicalCm',
        onSelect: () => {},
      })
    );
    assert.match(allHtml, /Vista anterior/);
    assert.match(allHtml, /Vista posterior/);
    assert.match(allHtml, /anatomical-muscle/);
    assert.match(allHtml, /data-active="true"/);
    assert.match(allHtml, /data-zoomed="true"/);
    assert.match(allHtml, /no sustituye cintura/);
    assert.match(allHtml, /Pliegue subescapular \(vista posterior\)/);
    assert.match(allHtml, /Cuello \(vista anterior\)/);

    const { createRoot } = await import('react-dom/client');
    root = createRoot(document.getElementById('anatomical-guide-test'));
    await act(async () => {
      root.render(
        React.createElement(Form, {
          clientId: '20000000-0000-4000-8000-000000000001',
          clientName: 'Synthetic',
          onSaved: () => {},
          onQueued: () => {},
        })
      );
    });

    const guide = () =>
      document.querySelector('[aria-label="Referencia anatómica"]');
    const frontViewport = () =>
      guide().querySelector('[aria-label="Vista anterior"]');
    const backViewport = () =>
      guide().querySelector('[aria-label="Vista posterior"]');
    const zoomBtn = (name) =>
      guide().querySelector(
        `[aria-label="Nivel de acercamiento"] button[aria-label^="${name}"]`
      );

    assert.match(guide().textContent, /Cinta · 4 sitios/);
    assert.equal(guide().querySelectorAll('button.anatomical-pin').length, 4);
    assert.equal(zoomBtn('Completa').getAttribute('aria-pressed'), 'true');
    assert.equal(frontViewport().getAttribute('data-zoomed'), null);

    const hipPin = guide().querySelector(
      'button.anatomical-pin[aria-label="Cadera (vista anterior)"]'
    );
    assert(hipPin);
    await act(async () => hipPin.click());
    assert.equal(
      document.activeElement,
      document.getElementById('assessment-hipCm')
    );
    assert.equal(hipPin.getAttribute('aria-pressed'), 'true');
    assert.equal(zoomBtn('Acercar').getAttribute('aria-pressed'), 'true');
    assert.equal(frontViewport().getAttribute('data-zoomed'), 'true');
    assert.equal(backViewport().getAttribute('data-zoomed'), 'true');
    assert.match(
      guide().textContent,
      /Glúteo mayor, glúteo medio y tensor de la fascia lata/
    );
    assert.ok(
      guide().querySelectorAll('.anatomical-muscle[data-active="true"]')
        .length > 0
    );

    await act(async () => zoomBtn('Completa').click());
    assert.equal(zoomBtn('Completa').getAttribute('aria-pressed'), 'true');
    assert.equal(frontViewport().getAttribute('data-zoomed'), null);
    assert.equal(backViewport().getAttribute('data-zoomed'), null);

    const plieguesBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Pliegues cutáneos')
    );
    await act(async () => plieguesBtn.click());
    assert.match(guide().textContent, /Plicómetro · 7 sitios/);
    assert.equal(guide().querySelectorAll('button.anatomical-pin').length, 7);
    const select = document.querySelector('select');
    await act(async () => {
      select.value = 'female';
      select.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    // Choosing the equation alone marks its three sites as required.
    assert.equal(
      [...guide().querySelectorAll('.anatomical-chip')].filter((b) =>
        b.textContent.includes('Obligatorio')
      ).length,
      3
    );

    const subscapularPin = guide().querySelector(
      'button.anatomical-pin[aria-label="Pliegue subescapular (vista posterior)"]'
    );
    assert(subscapularPin);
    await act(async () => subscapularPin.click());
    assert.equal(
      document.activeElement,
      document.getElementById('assessment-subscapularSkinfoldMm')
    );
    assert.equal(frontViewport().getAttribute('data-zoomed'), null);
    assert.equal(backViewport().getAttribute('data-zoomed'), 'true');
    assert.match(guide().textContent, /2\.2×/);
    assert.match(
      guide().querySelector('[role="status"]').textContent,
      /Pliegue subescapular \(mm\)/
    );
    assert.match(
      guide().textContent,
      /Ángulo inferior escapular, redondo mayor y dorsal ancho/
    );

    await act(async () => zoomBtn('Detalle').click());
    assert.equal(zoomBtn('Detalle').getAttribute('aria-pressed'), 'true');
    assert.match(guide().textContent, /2\.8×/);
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const [k, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, k, descriptor);
      else delete globalThis[k];
    }
    globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
  }
});

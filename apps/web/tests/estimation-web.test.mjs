import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
let vite, Details, Composition, valid;
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
  Details = (
    await vite.ssrLoadModule(
      '/src/features/evaluations/components/EstimationDetails.tsx'
    )
  ).default;
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
test('HU-023 pending detail explains unavailable without drawing numbers or a candidate graph', () => {
  const html = renderToStaticMarkup(
    React.createElement(Details, { effectiveDate: '2026-11-13' })
  );
  assert.match(html, /Estimación de grasa corporal/);
  assert.match(html, /no disponible/);
  assert.match(html, /no se calculó ningún porcentaje/);
  assert.match(html, /sin versión científica aprobada/);
  assert.match(html, /No es un diagnóstico/);
  assert.match(html, /2026-11-13/);
  assert(!html.includes('<svg'));
  assert(!html.includes('%'));
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

test('HU-023 form opt-in defaults off and survives method changes without enabling calculation', async () => {
  const { JSDOM } = await import('jsdom');
  const { act } = await import('react');
  const dom = new JSDOM('<div id="pending-test"></div>', {
    url: 'http://localhost/app/clientes/20000000-0000-4000-8000-000000000001/evaluacion/nueva',
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
    root = createRoot(document.getElementById('pending-test'));
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
    const choose = async (text) => {
      const button = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.includes(text)
      );
      assert(button);
      await act(async () => button.click());
    };
    await choose('Pliegues cutáneos');
    const checkbox = () => document.querySelector('input[type="checkbox"]');
    assert.equal(checkbox().checked, false);
    await act(async () => checkbox().click());
    assert.equal(checkbox().checked, true);
    assert.match(
      document.body.textContent,
      /No activa un protocolo aprobado ni calcula grasa corporal/
    );
    await choose('Bioimpedancia');
    assert.equal(checkbox(), null);
    await choose('Pliegues cutáneos');
    assert.equal(checkbox().checked, true);
    const boxes = () => [
      ...document.querySelectorAll('input[type="checkbox"]'),
    ];
    assert.equal(boxes().length, 2);
    assert.equal(boxes()[1].disabled, true);
    const equation = document.querySelector('select');
    await act(async () => {
      equation.value = 'male';
      equation.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(boxes()[1].disabled, false);
    assert.equal(boxes()[1].checked, false);
    await act(async () => boxes()[1].click());
    assert.equal(boxes()[0].checked, false);
    assert.equal(boxes()[1].checked, true);
    assert.match(
      document.body.textContent,
      /habilitarlo; no implica validación científica/
    );
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    await act(async () => {
      for (const [key, n] of Object.entries({
        pectoralSkinfoldMm: 10,
        abdominalSkinfoldMm: 15,
        thighSkinfoldMm: 20,
      })) {
        const element = document.getElementById('assessment-' + key);
        assert(element);
        setter.call(element, String(n));
        element.dispatchEvent(new window.Event('input', { bubbles: true }));
      }
    });
    const posts = [];
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).endsWith('/auth/csrf'))
        return new Response(
          JSON.stringify({ csrfToken: 'synthetic-unit-csrf' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      assert.equal(options.method, 'POST');
      posts.push(JSON.parse(options.body));
      const a = candidateSnapshot();
      const e = {
        ...evaluation(a),
        pectoralSkinfoldMm: 10,
        abdominalSkinfoldMm: 15,
        thighSkinfoldMm: 20,
      };
      return new Response(JSON.stringify({ evaluation: e }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    await act(async () => {
      const form = document.querySelector('form');
      form.dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      );
      form.dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true })
      );
    });
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].estimationRequest, {
      methodId: 'jackson-pollock-3-siri',
      protocolId: 'jp3-male-candidate',
      protocolVersion: 'technical-candidate-v1',
    });
    assert.match(document.body.textContent, /resultado candidato para pruebas/);
    assert.match(
      document.body.textContent,
      /La evaluación se guardó correctamente/
    );
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

test('HU-023 local detail shows one decimal, traceable density and female caution; remote views hide candidate numbers', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { hostname: '127.0.0.1' } },
    });
    for (const variant of ['male', 'female']) {
      const a = candidateSnapshot(variant, 45);
      assert.equal(valid(evaluation(a)), true);
      const html = renderToStaticMarkup(
        React.createElement(Details, {
          effectiveDate: a.effectiveDate,
          estimation: a.estimation,
        })
      );
      assert.match(html, /resultado candidato para pruebas/);
      assert(
        html.includes(
          a.estimation.result.estimatedBodyFatPercentage.toFixed(1) + ' %'
        )
      );
      assert(html.includes(String(a.estimation.result.bodyDensityGPerMl)));
      assert.match(html, /jp3-siri-arithmetic-candidate-v1/);
      assert.match(html, /No está validado científicamente/);
      assert.match(html, /no constituye un diagnóstico/);
      if (variant === 'female') {
        assert.match(html, /cotejo con el original pendiente/);
        assert.match(html, /mayores de 40/);
      }
    }
    window.location.hostname = 'example.invalid';
    const a = candidateSnapshot();
    const html = renderToStaticMarkup(
      React.createElement(Details, {
        effectiveDate: a.effectiveDate,
        estimation: a.estimation,
      })
    );
    assert.doesNotMatch(html, /aria-label="Porcentaje candidato/);
    assert.match(html, /requiere desarrollo local/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete globalThis.window;
  }
});

test('HU-023 No aplica clears candidate opt-in, announces no estimation, preserves measurements and permits explicit reselection', async () => {
  const { JSDOM } = await import('jsdom');
  const { act } = await import('react');
  const dom = new JSDOM('<div id="equation-regression"></div>', {
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
    root = createRoot(document.getElementById('equation-regression'));
    const saved = [];
    await act(async () =>
      root.render(
        React.createElement(Form, {
          clientId: '20000000-0000-4000-8000-000000000001',
          clientName: 'Synthetic',
          onSaved: (value) => saved.push(value),
          onQueued: () =>
            assert.fail('Expected a confirmed synthetic HTTP response'),
        })
      )
    );
    const pliegues = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Pliegues cutáneos')
    );
    await act(async () => pliegues.click());
    const select = document.querySelector('select');
    const chooseEquation = async (value) =>
      act(async () => {
        select.value = value;
        select.dispatchEvent(new window.Event('change', { bubbles: true }));
      });
    const candidate = () =>
      [...document.querySelectorAll('input[type="checkbox"]')][1];
    await chooseEquation('male');
    await act(async () => candidate().click());
    assert.equal(candidate().checked, true);
    const measurements = {
      pectoralSkinfoldMm: 10,
      abdominalSkinfoldMm: 15,
      thighSkinfoldMm: 20,
    };
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    await act(async () => {
      for (const [key, value] of Object.entries(measurements)) {
        const input = document.getElementById('assessment-' + key);
        setter.call(input, String(value));
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
      }
    });
    const assertMeasurements = () => {
      for (const [key, value] of Object.entries(measurements))
        assert.equal(
          document.getElementById('assessment-' + key).value,
          String(value)
        );
    };
    await chooseEquation('not_applicable');
    assert.equal(candidate().checked, false);
    assert.equal(candidate().disabled, true);
    const notice = document.getElementById('candidate-estimation-notice');
    assert.equal(notice.getAttribute('role'), 'status');
    assert.equal(select.getAttribute('aria-describedby'), notice.id);
    assert.match(
      notice.textContent,
      /No se realizará una estimación candidata/
    );
    assert.match(notice.textContent, /mediciones capturadas se conservan/);
    assertMeasurements();
    await chooseEquation('female');
    assert.equal(candidate().disabled, false);
    assert.equal(candidate().checked, false);
    assert.equal(notice.textContent, '');
    assertMeasurements();
    await act(async () => candidate().click());
    assert.equal(candidate().checked, true);
    await chooseEquation('not_applicable');
    assert.equal(candidate().checked, false);
    assertMeasurements();
    const posts = [];
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).endsWith('/auth/csrf'))
        return new Response(
          JSON.stringify({ csrfToken: 'synthetic-unit-csrf' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      assert.equal(options.method, 'POST');
      assert(String(url).endsWith('/evaluations'));
      posts.push(JSON.parse(options.body));
      const a = snapshot();
      delete a.estimation;
      Object.assign(a, {
        version: 'composition-arithmetic-v1',
        protocol: 'jp3-sites-pending',
        equation: 'not_applicable',
        measurements,
        ownerId: '10000000-0000-4000-8000-000000000001',
        birthDate: '1996-11-13',
      });
      return new Response(
        JSON.stringify({ evaluation: { ...evaluation(a), ...measurements } }),
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
    assert.equal(posts[0].equation, 'not_applicable');
    assert.equal(Object.hasOwn(posts[0], 'estimationRequest'), false);
    assert.deepEqual(posts[0].measurements, measurements);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].assessment.estimation, undefined);
    assertMeasurements();
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

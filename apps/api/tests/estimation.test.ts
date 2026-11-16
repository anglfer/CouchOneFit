import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ESTIMATION_METHOD_ID,
  ESTIMATION_REASON_CODES,
  type AvailableBodyFatEstimation,
  type UnavailableBodyFatEstimation,
  type AssessmentEstimationExtension,
} from '../src/features/evaluations/types/estimation.js';
import {
  EstimationContractError,
  parseEstimationRequest,
  parseOptionalEstimationRequest,
  parseEstimationSnapshot,
} from '../src/features/evaluations/validators/estimation.js';
import { assessmentInput } from '../src/features/evaluations/validators/assessment.js';
import {
  calculate,
  type Assessment,
} from '../src/features/evaluations/domain/assessment.js';

// Synthetic SHAPE fixtures only, deliberately not JP3/Siri reference cases.
// Strings below do not register or claim approval of any scientific version.
const requestFixture = () => ({
  methodId: ESTIMATION_METHOD_ID,
  protocolId: 'synthetic-test-protocol',
  protocolVersion: 'synthetic-test-version',
});
const available = (): AvailableBodyFatEstimation => ({
  schemaVersion: 1,
  methodId: ESTIMATION_METHOD_ID,
  variant: 'male',
  formulaVersion: 'synthetic-test-only',
  domainPolicyVersion: 'synthetic-test-only',
  protocol: {
    id: 'synthetic-test-protocol',
    version: 'synthetic-test-version',
  },
  provenance: 'server_estimation',
  inputs: {
    effectiveDate: '2026-11-13',
    ageYears: 30,
    unit: 'mm',
    skinfolds: {
      pectoralSkinfoldMm: 10,
      abdominalSkinfoldMm: 15,
      thighSkinfoldMm: 20,
    },
  },
  status: 'available',
  result: {
    sumSkinfoldMm: 45,
    bodyDensityGPerMl: 1.04,
    estimatedBodyFatPercentage: 12.3456789012345,
  },
  reasons: [],
});
const unavailable = (): UnavailableBodyFatEstimation => ({
  ...available(),
  variant: null,
  formulaVersion: null,
  domainPolicyVersion: null,
  inputs: {
    effectiveDate: '2026-11-13',
    ageYears: null,
    unit: 'mm',
    skinfolds: {},
  },
  status: 'unavailable',
  result: null,
  reasons: [{ code: 'scientific_verification_pending', fields: [] }],
});
const invalid = (operation: () => unknown, field?: string) => {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof EstimationContractError &&
      error.code === 'INVALID_ESTIMATION_CONTRACT' &&
      (field === undefined || error.field === field)
  );
};

test('HU-023 request parser preserves opt-in absence and clones a structural request', () => {
  assert.equal(parseOptionalEstimationRequest(undefined), undefined);
  const input = requestFixture();
  const parsed = parseEstimationRequest(input);
  assert.deepEqual(parsed, input);
  assert.notEqual(parsed, input);
  invalid(() => parseOptionalEstimationRequest(null));
});

test('HU-023 requests reject malformed objects and forged authoritative fields', () => {
  for (const value of [null, undefined, [], false, 'request', {}, new Date()]) {
    invalid(() => parseEstimationRequest(value));
  }
  for (const field of [
    'results',
    'ownerId',
    'ageYears',
    'formulaVersion',
    'effectiveDate',
  ]) {
    invalid(
      () => parseEstimationRequest({ ...requestFixture(), [field]: 'forged' }),
      `estimationRequest.${field}`
    );
  }
});

test('HU-023 request identifiers require the selected method and explicit protocol strings', () => {
  invalid(() =>
    parseEstimationRequest({ ...requestFixture(), methodId: 'navy' })
  );
  for (const key of ['protocolId', 'protocolVersion']) {
    for (const raw of [
      null,
      undefined,
      1,
      '',
      ' ',
      ' padded',
      'with@separator',
    ]) {
      invalid(() =>
        parseEstimationRequest({ ...requestFixture(), [key]: raw })
      );
    }
  }
  // Accepted shape is NOT proof of a registered or approved protocol.
  assert.equal(
    parseEstimationRequest(requestFixture()).protocolId,
    'synthetic-test-protocol'
  );
});

test('HU-023 available discriminant requires complete structural metadata without rounding', () => {
  const parsed = parseEstimationSnapshot(available());
  assert.equal(parsed.status, 'available');
  if (parsed.status !== 'available') assert.fail('Wrong discriminant');
  const version: string = parsed.formulaVersion;
  const age: number = parsed.inputs.ageYears;
  assert.equal(version, 'synthetic-test-only');
  assert.equal(age, 30);
  assert.equal(parsed.result.estimatedBodyFatPercentage, 12.3456789012345);
  assert.deepEqual(parsed.reasons, []);
});

test('HU-023 rejects missing, blank or null required available metadata', () => {
  for (const key of Object.keys(available())) {
    const raw: Record<string, unknown> = { ...available() };
    delete raw[key];
    invalid(() => parseEstimationSnapshot(raw));
  }
  for (const field of ['variant', 'formulaVersion', 'domainPolicyVersion']) {
    invalid(() => parseEstimationSnapshot({ ...available(), [field]: null }));
    invalid(() => parseEstimationSnapshot({ ...available(), [field]: '' }));
  }
  invalid(() =>
    parseEstimationSnapshot({
      ...available(),
      inputs: { ...available().inputs, ageYears: null },
    })
  );
});

test('HU-023 unavailable state preserves unknown metadata and never invents a result', () => {
  const parsed = parseEstimationSnapshot(unavailable());
  assert.equal(parsed.status, 'unavailable');
  assert.equal(parsed.result, null);
  assert.equal(parsed.formulaVersion, null);
  assert.equal(parsed.inputs.ageYears, null);
  assert.deepEqual(parsed.inputs.skinfolds, {});
  assert.equal(parsed.reasons.length, 1);
});

test('HU-023 rejects fabricated or intermediate numeric results in unavailable state', () => {
  for (const result of [
    undefined,
    0,
    {},
    available().result,
    { bodyDensityGPerMl: 1.04 },
    { estimatedBodyFatPercentage: 0 },
  ]) {
    invalid(
      () => parseEstimationSnapshot({ ...unavailable(), result }),
      'estimation.result'
    );
  }
});

test('HU-023 states, provenance, schema and reason lists cannot be mixed', () => {
  for (const patch of [
    { schemaVersion: 2 },
    { methodId: 'navy' },
    { status: 'partial' },
    { provenance: 'device_reported' },
    { provenance: 'manual_measurements' },
    { reasons: unavailable().reasons },
    { result: null },
  ])
    invalid(() => parseEstimationSnapshot({ ...available(), ...patch }));
  for (const reasons of [
    [],
    null,
    [{}],
    [{ code: 'invented', fields: [] }],
    new Array(1),
  ]) {
    invalid(() => parseEstimationSnapshot({ ...unavailable(), reasons }));
  }
});

test('HU-023 reasons support all proposed codes with known fields only', () => {
  for (const code of ESTIMATION_REASON_CODES) {
    const parsed = parseEstimationSnapshot({
      ...unavailable(),
      reasons: [
        { code, fields: ['equation', 'measurements.pectoralSkinfoldMm'] },
      ],
    });
    assert.equal(parsed.reasons[0]?.code, code);
  }
  for (const fields of [
    ['professionalId'],
    ['measurements.measuredBodyFatPercentage'],
    [1],
    null,
    new Array(1),
  ]) {
    invalid(() =>
      parseEstimationSnapshot({
        ...unavailable(),
        reasons: [{ code: 'missing_measurements', fields }],
      })
    );
  }
});

test('HU-023 contract rejects unknown keys at every object boundary', () => {
  for (const patch of [
    { measuredBodyFatPercentage: 20 },
    { inputs: { ...available().inputs, weightKg: 80 } },
    { result: { ...available().result, fatMassKg: 10 } },
    { protocol: { ...available().protocol, approved: true } },
    {
      reasons: [{ code: 'missing_measurements', fields: [], message: 'extra' }],
      status: 'unavailable',
      result: null,
    },
  ])
    invalid(() => parseEstimationSnapshot({ ...available(), ...patch }));
});

test('HU-023 calendar and age checks are structural without current-date or clinical policy', () => {
  for (const effectiveDate of ['2024-02-29', '0001-01-01', '2099-01-01']) {
    assert.equal(
      parseEstimationSnapshot({
        ...available(),
        inputs: { ...available().inputs, effectiveDate },
      }).inputs.effectiveDate,
      effectiveDate
    );
  }
  for (const effectiveDate of [
    '0000-01-01',
    '2026-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-1-01',
    '2026-11-13T00:00:00Z',
    null,
  ]) {
    invalid(() =>
      parseEstimationSnapshot({
        ...available(),
        inputs: { ...available().inputs, effectiveDate },
      })
    );
  }
  for (const ageYears of [
    -1,
    30.5,
    NaN,
    Infinity,
    '30',
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    invalid(() =>
      parseEstimationSnapshot({
        ...available(),
        inputs: { ...available().inputs, ageYears },
      })
    );
  }
});

test('HU-023 skinfolds preserve decimals and absence, enforcing DEC-006 capture shape', () => {
  const inputs = {
    ...available().inputs,
    skinfolds: { pectoralSkinfoldMm: 10.1 },
  };
  const parsed = parseEstimationSnapshot({
    ...unavailable(),
    variant: 'male',
    inputs,
    reasons: [
      {
        code: 'missing_measurements',
        fields: ['measurements.abdominalSkinfoldMm'],
      },
    ],
  });
  assert.deepEqual(parsed.inputs.skinfolds, { pectoralSkinfoldMm: 10.1 });
  for (const raw of [
    null,
    undefined,
    0,
    -1,
    0.9,
    80.1,
    10.25,
    NaN,
    Infinity,
    '10',
  ]) {
    invalid(() =>
      parseEstimationSnapshot({
        ...available(),
        inputs: {
          ...available().inputs,
          skinfolds: {
            ...available().inputs.skinfolds,
            pectoralSkinfoldMm: raw,
          },
        },
      })
    );
  }
  invalid(() =>
    parseEstimationSnapshot({
      ...available(),
      inputs: { ...available().inputs, unit: 'cm' },
    })
  );
  invalid(() =>
    parseEstimationSnapshot({
      ...available(),
      inputs: {
        ...available().inputs,
        skinfolds: { measuredBodyFatPercentage: 20 },
      },
    })
  );
});

test('HU-023 available requires three present sites; protocol-specific mapping stays outside shape parser', () => {
  for (const skinfolds of [
    {},
    { pectoralSkinfoldMm: 10 },
    { ...available().inputs.skinfolds, bicepsSkinfoldMm: 10 },
  ]) {
    invalid(() =>
      parseEstimationSnapshot({
        ...available(),
        inputs: { ...available().inputs, skinfolds },
      })
    );
  }
  invalid(() =>
    parseEstimationSnapshot({ ...unavailable(), inputs: available().inputs })
  );
});

test('HU-023 result numbers reject impossible technical values without calculating a formula', () => {
  for (const field of Object.keys(available().result)) {
    for (const raw of [0, -1, null, undefined, '1', NaN, Infinity]) {
      invalid(() =>
        parseEstimationSnapshot({
          ...available(),
          result: { ...available().result, [field]: raw },
        })
      );
    }
  }
  for (const estimatedBodyFatPercentage of [100, 101]) {
    invalid(() =>
      parseEstimationSnapshot({
        ...available(),
        result: { ...available().result, estimatedBodyFatPercentage },
      })
    );
  }
  // Measured-fat capture limits 2–60 do not define estimated-fat structural limits.
  for (const estimatedBodyFatPercentage of [1, 99]) {
    assert.equal(
      parseEstimationSnapshot({
        ...available(),
        result: { ...available().result, estimatedBodyFatPercentage },
      }).status,
      'available'
    );
  }
});

test('HU-023 shape validation neither recalculates nor certifies scientific correctness', () => {
  const raw = {
    ...available(),
    result: {
      ...available().result,
      sumSkinfoldMm: 99,
      estimatedBodyFatPercentage: 25,
    },
  };
  const parsed = parseEstimationSnapshot(raw);
  assert.deepEqual(parsed.result, raw.result); // No sum or JP3/Siri computation, no approval registry.
});

test('HU-023 parsers return detached values without mutating inputs', () => {
  const raw = available();
  const before = structuredClone(raw);
  const parsed = parseEstimationSnapshot(raw);
  assert.deepEqual(raw, before);
  assert.notEqual(parsed, raw);
  assert.notEqual(parsed.inputs.skinfolds, raw.inputs.skinfolds);
  assert.notEqual(parsed.protocol, raw.protocol);
  assert.notEqual(parsed.result, raw.result);
  const pending = unavailable();
  const p = parseEstimationSnapshot(pending);
  assert.notEqual(p.reasons, pending.reasons);
  assert.notEqual(p.reasons[0]?.fields, pending.reasons[0].fields);
});

test('HU-023 stays compatible with omission on old snapshots without changing their version', () => {
  const legacy: Assessment = {
    method: 'pliegues',
    effectiveDate: '2026-11-13',
    equation: 'not_applicable',
    measurements: { thighSkinfoldMm: 10 },
    protocol: 'jp3-sites-pending',
    ownerId: '10000000-0000-4000-8000-000000000001',
    ageYears: null,
    birthDate: null,
    version: 'composition-arithmetic-v1',
    calculationStatus: 'pending_verification',
    provenance: 'manual_measurements',
    results: {},
  };
  const before = structuredClone(legacy);
  const compatible: Assessment & AssessmentEstimationExtension = legacy;
  assert.equal(compatible.estimation, undefined);
  assert.equal(compatible.version, 'composition-arithmetic-v1');
  assert.deepEqual(legacy, before);
});

test('HU-023 unknown protocol stays rejected and legacy capture does not calculate', () => {
  const raw = {
    method: 'pliegues',
    equation: 'male',
    measurements: {
      pectoralSkinfoldMm: 10,
      abdominalSkinfoldMm: 15,
      thighSkinfoldMm: 20,
    },
  };
  const oldInput = assessmentInput(raw, '2026-11-13');
  assert.deepEqual(calculate(oldInput), {});
  assert.throws(() =>
    assessmentInput(
      { ...raw, estimationRequest: requestFixture() },
      '2026-11-13'
    )
  );
  const partial = assessmentInput(
    {
      method: 'pliegues',
      equation: 'not_applicable',
      measurements: { bicepsSkinfoldMm: 10.1 },
    },
    '2026-11-13'
  );
  assert.deepEqual(partial.measurements, { bicepsSkinfoldMm: 10.1 });
  assert.deepEqual(calculate(partial), {});
});

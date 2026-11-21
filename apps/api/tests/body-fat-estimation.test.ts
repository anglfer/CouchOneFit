import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateCandidateBodyFat,
  candidateSiriPercentage,
  type CandidateEstimationInput,
} from '../src/features/evaluations/domain/body-fat-estimation.js';
import { parseEstimationSnapshot } from '../src/features/evaluations/validators/estimation.js';
import { assessmentInput } from '../src/features/evaluations/validators/assessment.js';
import { calculate } from '../src/features/evaluations/domain/assessment.js';

// These are the nine DOCUMENTED CANDIDATES, not independently approved fixtures.
const cases = [
  [
    'M01',
    'male',
    '1996-11-13',
    [10, 15, 20],
    45,
    1.0676965,
    29073150,
    2135393,
    '13.6',
  ],
  [
    'M02',
    'male',
    '2008-11-13',
    [10, 10, 10],
    30,
    1.0813858,
    3807450,
    491539,
    '7.7',
  ],
  [
    'M03',
    'male',
    '1965-11-13',
    [10, 20, 30],
    60,
    1.0498366,
    112867650,
    5249183,
    '21.5',
  ],
  [
    'M04',
    'male',
    '1991-11-13',
    [10.1, 15.2, 20.3],
    45.6,
    1.066000456,
    1912474350,
    133250057,
    '14.4',
  ],
  [
    'F01',
    'female',
    '1996-11-13',
    [20, 15, 25],
    60,
    1.0440221,
    22900050,
    949111,
    '24.1',
  ],
  [
    'F02',
    'female',
    '2008-11-13',
    [10, 15, 20],
    45,
    1.0569635,
    38732850,
    2113927,
    '18.3',
  ],
  [
    'F03',
    'female',
    '1986-11-13',
    [20, 20, 20],
    60,
    1.0426301,
    258164550,
    10426301,
    '24.8',
  ],
  [
    'F04',
    'female',
    '1985-11-13',
    [20, 20, 20],
    60,
    1.0424909,
    23526450,
    947719,
    '24.8',
  ],
  [
    'F05',
    'female',
    '1971-11-13',
    [20, 20, 20],
    60,
    1.0405421,
    267560550,
    10405421,
    '25.7',
  ],
] as const;

const fixture = (
  variant: 'male' | 'female' = 'male',
  values: readonly number[] = [10, 15, 20],
  birthDate = '1996-11-13'
): CandidateEstimationInput => ({
  variant,
  birthDate,
  effectiveDate: '2026-11-13',
  unit: 'mm',
  skinfolds:
    variant === 'male'
      ? {
          pectoralSkinfoldMm: values[0],
          abdominalSkinfoldMm: values[1],
          thighSkinfoldMm: values[2],
        }
      : {
          tricepsSkinfoldMm: values[0],
          suprailiacSkinfoldMm: values[1],
          thighSkinfoldMm: values[2],
        },
});

function rejected(input: unknown, expected: string): void {
  const result = calculateCandidateBodyFat(input);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.activationAllowed, false);
  if (result.status !== 'unavailable')
    assert.fail('Expected no candidate result');
  assert.equal(result.candidateResult, null);
  assert.equal(result.reason.code, expected);
}

for (const [
  id,
  variant,
  birth,
  sites,
  sum,
  density,
  numerator,
  denominator,
  ui,
] of cases) {
  test(`HU-023 ${id}: ${variant === 'female' ? 'PROVISIONAL female' : 'checked male equation'} candidate arithmetic, never activation`, () => {
    const actual = calculateCandidateBodyFat(fixture(variant, sites, birth));
    assert.equal(actual.status, 'candidate_only');
    if (actual.status !== 'candidate_only')
      assert.fail('Expected candidate arithmetic');
    assert.equal(actual.activationAllowed, false);
    assert.equal(actual.formulaVersion, null);
    assert.equal(actual.domainPolicyVersion, null);
    assert.equal(actual.protocolVersion, null);
    assert(actual.blockers.includes('domain_approval_pending'));
    assert(actual.blockers.includes('independent_reference_cases_pending'));
    assert(Math.abs(actual.candidateResult.sumSkinfoldMm - sum) <= 1e-12);
    assert(
      Math.abs(actual.candidateResult.bodyDensityGPerMl - density) <= 1e-12
    );
    assert(
      Math.abs(
        actual.candidateResult.estimatedBodyFatPercentage -
          numerator / denominator
      ) <= 1e-9
    );
    // Presentation check in the TEST only: the engine retains unrounded results.
    assert.equal(
      actual.candidateResult.estimatedBodyFatPercentage.toFixed(1),
      ui
    );
    assert.equal(
      actual.equationEvidence,
      variant === 'male'
        ? 'male_transcription_checked'
        : 'female_transcription_provisional'
    );
    if (variant === 'female') {
      assert(actual.blockers.includes('female_equation_original_pending'));
      if (actual.inputs.ageYears > 40)
        assert(actual.blockers.includes('female_over_40_caution_pending'));
    }
    assert.throws(() => parseEstimationSnapshot(actual));
  });
}

test('HU-023 candidate cases stay traceable to the existing matrix without changing it', () => {
  const doc = readFileSync(
    new URL(
      '../../../docs/epicas/ep-04-antropometria/hu-023/casos-patron-candidatos.md',
      import.meta.url
    ),
    'utf8'
  );
  for (const [id, , , , , density, numerator, denominator] of cases) {
    assert(doc.includes(`| ${id}`));
    assert(doc.includes(String(density)));
    assert(doc.includes(`${numerator} / ${denominator}`));
  }
});

test('HU-023 uses effective birthdays and is independent of today, timezone and supplied current age', () => {
  const before = calculateCandidateBodyFat({
    ...fixture(),
    birthDate: '1996-11-14',
  });
  const birthday = calculateCandidateBodyFat(fixture());
  assert.equal(before.status, 'candidate_only');
  assert.equal(birthday.status, 'candidate_only');
  if (
    before.status !== 'candidate_only' ||
    birthday.status !== 'candidate_only'
  )
    assert.fail();
  assert.equal(before.inputs.ageYears, 29);
  assert.equal(birthday.inputs.ageYears, 30);
  assert.notEqual(
    before.candidateResult.bodyDensityGPerMl,
    birthday.candidateResult.bodyDensityGPerMl
  );
  const historical = calculateCandidateBodyFat({
    ...fixture(),
    birthDate: '1970-01-01',
    effectiveDate: '2000-01-01',
  });
  assert.equal(historical.status, 'candidate_only');
  if (historical.status === 'candidate_only')
    assert.equal(historical.inputs.ageYears, 30);
  rejected({ ...fixture(), ageYears: 30 }, 'invalid_input');
});

test('HU-023 missing/null sites or age never create zeroes or substitute other sites', () => {
  rejected({ ...fixture(), birthDate: null }, 'age_unavailable');
  const { birthDate: _birth, ...withoutBirth } = fixture();
  rejected(withoutBirth, 'age_unavailable');
  rejected({ ...fixture(), variant: null }, 'equation_not_selected');
  rejected({ ...fixture(), skinfolds: {} }, 'missing_measurements');
  for (const value of [null, undefined]) {
    const result = calculateCandidateBodyFat({
      ...fixture(),
      skinfolds: { ...fixture().skinfolds, pectoralSkinfoldMm: value },
    });
    assert.equal(result.status, 'unavailable');
    if (result.status !== 'unavailable') assert.fail();
    assert.equal(result.reason.code, 'missing_measurements');
    assert.deepEqual(result.reason.fields, ['skinfolds.pectoralSkinfoldMm']);
  }
  rejected(
    { ...fixture('female'), skinfolds: fixture('male').skinfolds },
    'missing_measurements'
  );
  rejected(
    { ...fixture('male'), skinfolds: fixture('female').skinfolds },
    'missing_measurements'
  );
});

test('HU-023 optional sites, weight absence and source measurements do not alter the three-site sum', () => {
  const original = fixture();
  const copy = structuredClone(original);
  const actual = calculateCandidateBodyFat({
    ...original,
    skinfolds: {
      ...original.skinfolds,
      bicepsSkinfoldMm: 5,
      subscapularSkinfoldMm: 7,
      tricepsSkinfoldMm: 9,
      suprailiacSkinfoldMm: 11,
    },
  });
  assert.deepEqual(original, copy);
  const expected = calculateCandidateBodyFat(original);
  assert.deepEqual(actual, expected);
  if (actual.status === 'candidate_only') {
    assert.notEqual(actual.inputs.skinfolds, original.skinfolds);
    assert.equal(Object.keys(actual.inputs.skinfolds).length, 3);
    assert(!('measuredBodyFatPercentage' in actual.candidateResult));
    assert(!('fatMassKg' in actual.candidateResult));
  }
});

test('HU-023 rejects malformed inputs, dates and measurements without coercion or approval overrides', () => {
  for (const raw of [undefined, null, [], {}, 1, 'input'])
    assert.equal(calculateCandidateBodyFat(raw).status, 'unavailable');
  for (const field of [
    'approved',
    'activationAllowed',
    'protocolVersion',
    'result',
  ])
    rejected({ ...fixture(), [field]: true }, 'invalid_input');
  rejected({ ...fixture(), variant: 'not_applicable' }, 'invalid_input');
  for (const effectiveDate of [
    '2026-02-30',
    '2026-02-29',
    '0000-01-01',
    '2026-1-01',
    '2026-11-13T00:00:00Z',
    null,
  ])
    rejected({ ...fixture(), effectiveDate }, 'invalid_effective_date');
  for (const birthDate of ['2026-02-30', '2027-01-01', 'bad', ''])
    rejected({ ...fixture(), birthDate }, 'invalid_birth_date');
  for (const value of [0, -1, 0.9, 80.1, 10.25, NaN, Infinity, '10', false])
    rejected(
      {
        ...fixture(),
        skinfolds: { ...fixture().skinfolds, pectoralSkinfoldMm: value },
      },
      'invalid_measurements'
    );
  rejected({ ...fixture(), unit: 'cm' }, 'invalid_measurements');
  rejected(
    { ...fixture(), skinfolds: { ...fixture().skinfolds, waistCm: 80 } },
    'invalid_measurements'
  );
});

test('HU-023 age bounds only constrain candidate arithmetic; no clinical policy is approved', () => {
  for (const [variant, birth] of [
    ['male', '2009-11-13'],
    ['male', '1964-11-13'],
    ['female', '2009-11-13'],
    ['female', '1970-11-13'],
  ] as const)
    rejected(
      fixture(variant, [10, 15, 20], birth),
      'outside_reference_age_range'
    );
  for (const variant of ['male', 'female'] as const) {
    const result = calculateCandidateBodyFat(
      fixture(variant, [1, 1, 1], '2008-11-13')
    );
    assert.equal(result.activationAllowed, false);
    assert(result.blockers.includes('domain_approval_pending'));
  }
  rejected(
    fixture('male', [1, 1, 1], '2008-11-13'),
    'invalid_estimated_percentage'
  );
});

test('HU-023 Siri guards G01–G06 reject invalid densities, non-finite results and boundary percentages', () => {
  for (const [density, code] of [
    [0, 'invalid_density'],
    [-1, 'invalid_density'],
    [NaN, 'non_finite_calculation'],
    [Infinity, 'non_finite_calculation'],
    [Number.MIN_VALUE, 'non_finite_calculation'],
    [1.1, 'invalid_estimated_percentage'],
    [0.9, 'invalid_estimated_percentage'],
    [0.8, 'invalid_estimated_percentage'],
  ] as const) {
    const result = candidateSiriPercentage(density);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.activationAllowed, false);
    if (result.status !== 'unavailable') assert.fail();
    assert.equal(result.candidatePercentage, null);
    assert.equal(result.reason.code, code);
  }
});

test('HU-023 Siri S-01 follows the printed equation, not the discrepant 21.5 example', () => {
  const result = candidateSiriPercentage(1.05);
  assert.equal(result.status, 'candidate_only');
  if (result.status !== 'candidate_only') assert.fail();
  assert(Math.abs(result.candidatePercentage - 150 / 7) <= 1e-9);
  assert.notEqual(result.candidatePercentage, 21.5);
  assert.notEqual(
    result.candidatePercentage,
    Number(result.candidatePercentage.toFixed(1))
  );
  assert.equal(result.activationAllowed, false);
});

test('HU-023 engine is wired only through the candidate gate or the official read-time readers and POST rejects unknown protocols', () => {
  const root = new URL('../src/', import.meta.url);
  function inspect(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) inspect(file);
      else if (
        entry.name.endsWith('.ts') &&
        ![
          'body-fat-estimation.ts',
          'candidate-estimation.ts',
          // Official skinfold result (product decision 2026-11-20).
          'evaluation.ts',
          'follow-up.ts',
        ].includes(entry.name)
      ) {
        assert(
          !readFileSync(file, 'utf8').includes('body-fat-estimation'),
          `Unexpected runtime reference: ${file}`
        );
      }
    }
  }
  inspect(fileURLToPath(root));
  const legacy = {
    method: 'pliegues',
    equation: 'male',
    measurements: {
      pectoralSkinfoldMm: 10,
      abdominalSkinfoldMm: 15,
      thighSkinfoldMm: 20,
    },
  };
  const before = structuredClone(legacy);
  assert.deepEqual(calculate(assessmentInput(legacy, '2026-11-13')), {});
  assert.throws(
    () =>
      assessmentInput(
        {
          ...legacy,
          estimationRequest: {
            methodId: 'jackson-pollock-3-siri',
            protocolId: 'not-approved',
            protocolVersion: 'not-approved',
          },
        },
        '2026-11-13'
      ),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'INVALID_EVALUATION'
  );
  assert.deepEqual(legacy, before);
});

test('HU-023 official read-time JP3 + Siri derives fat mass and explains nothing when inputs are incomplete', async () => {
  const { skinfoldResults } = await import(
    '../src/features/evaluations/domain/body-fat-estimation.js'
  );
  const snapshot = {
    equation: 'male',
    birthDate: '1996-01-15',
    effectiveDate: '2026-11-20',
    measurements: {
      weightKg: 80,
      pectoralSkinfoldMm: 20,
      abdominalSkinfoldMm: 20,
      thighSkinfoldMm: 20,
    },
  };
  const results = skinfoldResults(snapshot)!;
  assert.equal(results.sumSkinfoldMm, 60);
  assert.ok(Math.abs(results.bodyFatPercentage - 17.945275927) < 1e-6);
  assert.ok(Math.abs(results.fatMassKg + results.fatFreeMassKg - 80) < 1e-9);
  // Missing site, no equation or out-of-range age never invent a value.
  const { thighSkinfoldMm: _t, ...partial } = snapshot.measurements;
  assert.equal(skinfoldResults({ ...snapshot, measurements: partial }), null);
  assert.equal(skinfoldResults({ ...snapshot, equation: 'not_applicable' }), null);
  assert.equal(skinfoldResults({ ...snapshot, birthDate: '2010-01-01' }), null);
});

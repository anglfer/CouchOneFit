import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthError } from '../src/features/auth/types/errors.js'
import { evaluationMeasurements } from '../src/features/evaluations/validators/evaluation.js'

test('HU-021 accepts each documented boundary and preserves omitted and NULL values as NULL', () => {
  const result = evaluationMeasurements({
    weightKg: 30,
    waistCm: 250,
    hipCm: 50,
    measuredBodyFatPercentage: 60,
    pectoralSkinfoldMm: 1,
    abdominalSkinfoldMm: 80,
    tricepsSkinfoldMm: null,
    suprailiacSkinfoldMm: undefined,
  })
  assert.deepEqual(result, {
    weightKg: 30,
    waistCm: 250,
    hipCm: 50,
    measuredBodyFatPercentage: 60,
    pectoralSkinfoldMm: 1,
    abdominalSkinfoldMm: 80,
    tricepsSkinfoldMm: null,
    suprailiacSkinfoldMm: null,
    thighSkinfoldMm: null,
  })
})

test('HU-021 allows any single valid measurement, including one skinfold and without weight', () => {
  assert.equal(evaluationMeasurements({ thighSkinfoldMm: 12.3 }).thighSkinfoldMm, 12.3)
  assert.equal(evaluationMeasurements({ waistCm: 80.1 }).weightKg, null)
})

test('HU-021 accepts minimum and maximum bounds for every measurement field', () => {
  const bounds = {
    weightKg: [30, 300],
    waistCm: [40, 250],
    hipCm: [50, 250],
    measuredBodyFatPercentage: [2, 60],
    pectoralSkinfoldMm: [1, 80],
    abdominalSkinfoldMm: [1, 80],
    tricepsSkinfoldMm: [1, 80],
    suprailiacSkinfoldMm: [1, 80],
    thighSkinfoldMm: [1, 80],
  } as const
  for (const [field, [minimum, maximum]] of Object.entries(bounds)) {
    assert.equal(evaluationMeasurements({ [field]: minimum })[field as keyof typeof bounds], minimum)
    assert.equal(evaluationMeasurements({ [field]: maximum })[field as keyof typeof bounds], maximum)
  }
})

test('HU-021 rejects empty measurements, unknown fields, coercion, non-finite values, range errors and excess precision', () => {
  const invalidInputs: unknown[] = [
    {}, { weightKg: null }, { unexpected: 50 }, { weightKg: '70' }, { weightKg: true },
    { weightKg: Number.NaN }, { weightKg: 29.9 }, { waistCm: 250.1 },
    { thighSkinfoldMm: 80.1 }, { hipCm: 90.25 }, { hipCm: 90.30000001 }, { measuredBodyFatPercentage: 0 },
  ]
  for (const input of invalidInputs) {
    assert.throws(() => evaluationMeasurements(input), (error) => error instanceof AuthError && error.status === 400 && error.code === 'INVALID_EVALUATION')
  }
})

test('HU-021 rejects non-object bodies', () => {
  for (const input of [null, [], 'weightKg=70', 70]) assert.throws(() => evaluationMeasurements(input), AuthError)
})

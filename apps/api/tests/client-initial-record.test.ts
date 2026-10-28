import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateClientInitialRecord } from '../src/features/saas/services/clients.js'

const now = new Date('2026-10-28T12:00:00Z')
const input = {
  fullName: '  Cliente de prueba  ',
  birthDate: '1990-05-20',
  heightCm: 170.5,
  baseWeightKg: 70.2,
}
const invalidField = (field: string) => (error: unknown) => {
  const failure = error as { status: number; code: string; fields: Record<string, string> }
  assert.equal(failure.status, 400)
  assert.equal(failure.code, 'INVALID_INPUT')
  assert.ok(failure.fields[field])
  return true
}

test('initial record accepts dictionary boundaries and preserves absent optional values as null', () => {
  for (const measures of [
    { heightCm: 100, baseWeightKg: 30, baseBodyFatPercentage: 2, waistCm: 40, hipCm: 50 },
    { heightCm: 250, baseWeightKg: 300, baseBodyFatPercentage: 60, waistCm: 250, hipCm: 250 },
  ]) {
    const result = validateClientInitialRecord({ ...input, ...measures }, now)
    for (const field of Object.keys(measures) as (keyof typeof measures)[])
      assert.equal(result[field], measures[field])
  }
  assert.deepEqual(validateClientInitialRecord(input, now), {
    ...input, fullName: 'Cliente de prueba', goal: null,
    baseBodyFatPercentage: null, waistCm: null, hipCm: null,
  })
  const unicode = validateClientInitialRecord({ ...input, fullName: '😀'.repeat(150), goal: '😀'.repeat(500) }, now)
  assert.equal([...unicode.fullName].length, 150)
  assert.equal([...unicode.goal!].length, 500)
})

test('initial record rejects precision beyond a tenth even near a valid decimal', () => {
  for (const [field, value] of Object.entries({
    heightCm: 170.50000000001,
    baseWeightKg: 70.20000000001,
    baseBodyFatPercentage: 20.20000000001,
    waistCm: 80.20000000001,
    hipCm: 90.20000000001,
  })) {
    assert.throws(() => validateClientInitialRecord({ ...input, [field]: value }, now), invalidField(field))
    assert.doesNotThrow(() => validateClientInitialRecord({ ...input, [field]: Number(value.toFixed(1)) }, now))
  }
})

test('initial record rejects coercion, zero, non-finite values and missing required measures', () => {
  for (const field of ['heightCm', 'baseWeightKg', 'baseBodyFatPercentage', 'waistCm', 'hipCm']) {
    for (const value of ['', '70.2', true, false, 0, NaN, Infinity, -Infinity])
      assert.throws(() => validateClientInitialRecord({ ...input, [field]: value }, now), invalidField(field))
  }
  for (const field of ['heightCm', 'baseWeightKg'])
    for (const value of [null, undefined])
      assert.throws(() => validateClientInitialRecord({ ...input, [field]: value }, now), invalidField(field))
})

test('initial record validates calendar dates, PostgreSQL year range and adult birthday boundaries', () => {
  for (const birthDate of ['0000-01-01', '2007-02-29', '2026-10-29', '2008-10-29', '', '1990-13-01'])
    assert.throws(() => validateClientInitialRecord({ ...input, birthDate }, now), invalidField('birthDate'))
  assert.doesNotThrow(() => validateClientInitialRecord({ ...input, birthDate: '2008-10-28' }, now))
  assert.throws(() => validateClientInitialRecord({ ...input, birthDate: '2008-02-29' }, new Date('2026-02-28T12:00:00Z')), invalidField('birthDate'))
  assert.doesNotThrow(() => validateClientInitialRecord({ ...input, birthDate: '2008-02-29' }, new Date('2026-03-01T12:00:00Z')))
  assert.throws(() => validateClientInitialRecord({ ...input, birthDate: '2008-10-29' }, new Date('2026-10-29T00:30:00Z')), invalidField('birthDate'))
  assert.doesNotThrow(() => validateClientInitialRecord({ ...input, birthDate: '2008-10-29' }, new Date('2026-10-29T06:00:00Z')))
})

test('initial record rejects owner injection and invalid names and goals', () => {
  assert.throws(() => validateClientInitialRecord({ ...input, professionalId: 'forged' }, now), { status: 400, code: 'INVALID_INPUT' })
  for (const fullName of ['', 'a', 'a'.repeat(151), '😀', '😀'.repeat(151)])
    assert.throws(() => validateClientInitialRecord({ ...input, fullName }, now), invalidField('fullName'))
  for (const goal of ['', ' ', 'a'.repeat(501), false])
    assert.throws(() => validateClientInitialRecord({ ...input, goal }, now), invalidField('goal'))
})

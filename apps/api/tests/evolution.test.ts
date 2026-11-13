import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  evolutionQuery,
  evolutionCursor,
  isEvolutionDate,
  evolutionTimestamp,
} from '../src/features/evaluations/validators/evolution.js'
import {
  evolutionSample,
  compareEvolutionPositions,
  inEvolutionPeriod,
  evolutionMetricState,
} from '../src/features/evaluations/domain/evolution.js'
import {
  EVOLUTION_METRICS,
  type EvolutionScope,
  type EvolutionPosition,
} from '../src/features/evaluations/types/evolution.js'
import { evaluationMeasurements } from '../src/features/evaluations/validators/evaluation.js'
import { methodFields } from '../src/features/evaluations/validators/assessment.js'
import type { Evaluation } from '../src/features/evaluations/types/evaluation.js'

const key = new Uint8Array(32).fill(7) // Synthetic test-only material, never runtime credentials.
const scope: EvolutionScope = {
  subjectId: '10000000-0000-4000-8000-000000000001',
  clientId: '20000000-0000-4000-8000-000000000002',
}
const last: EvolutionPosition = {
  date: '2026-11-10',
  createdAt: '2026-11-11T00:01:02.123456Z',
  id: '30000000-0000-4000-8000-000000000003',
}
const query = (raw: unknown = {}, currentScope = scope) =>
  evolutionQuery(raw, currentScope, key)
const fixture = (changes: Partial<Evaluation> = {}): Evaluation => ({
  ...evaluationMeasurements({ waistCm: 80.1 }),
  id: last.id,
  clientId: scope.clientId,
  evaluationDate: '2026-11-11',
  createdAt: last.createdAt,
  ...changes,
})
const invalid = (operation: () => unknown) =>
  assert.throws(
    operation,
    (e: unknown) =>
      e instanceof Error &&
      'status' in e &&
      e.status === 400 &&
      'code' in e &&
      e.code === 'INVALID_INPUT',
  )

test('HU-022 validates real calendar dates, leap years and defaults without runtime configuration', () => {
  for (const d of [
    '0001-01-01',
    '2000-02-29',
    '2024-02-29',
    '2026-11-12',
    '9999-12-31',
  ])
    assert(isEvolutionDate(d))
  for (const d of [
    '0000-01-01',
    '1900-02-29',
    '2026-02-29',
    '2026-02-30',
    '2026-04-31',
    '2026-00-01',
    '2026-13-01',
    '2026-01-00',
    '2026-1-01',
    ' 2026-01-01',
    '2026-01-01T00:00:00Z',
    '',
    null,
    2026,
  ])
    assert(!isEvolutionDate(d))
  assert.deepEqual(query(), {
    from: null,
    to: null,
    method: null,
    pageSize: 20,
    after: null,
  })
  for (const from of ['2026-01-01', '2026-02-30']) {
    if (isEvolutionDate(from)) assert.equal(query({ from }).from, from)
    else invalid(() => query({ from }))
  }
})

test('HU-022 periods are inclusive, optional and ordered; historical query does not invent a future-date restriction', () => {
  const q = query({ from: '2026-01-01', to: '2026-01-31' })
  for (const date of ['2026-01-01', '2026-01-15', '2026-01-31'])
    assert(inEvolutionPeriod(date, q))
  for (const date of ['2025-12-31', '2026-02-01'])
    assert(!inEvolutionPeriod(date, q))
  assert(
    inEvolutionPeriod(
      '2026-01-01',
      query({ from: '2026-01-01', to: '2026-01-01' }),
    ),
  )
  assert(inEvolutionPeriod('2025-01-01', query({ to: '2026-01-01' })))
  assert.equal(query({ from: '2099-01-01' }).from, '2099-01-01')
  invalid(() => query({ from: '2026-02-01', to: '2026-01-01' }))
})

test('HU-022 rejects unknown fields, arrays, null, coercion and out-of-range page sizes', () => {
  for (const raw of [
    null,
    [],
    '',
    { from: null },
    { to: ['2026-01-01'] },
    { from: '' },
    { method: false },
    { pageSize: 20 },
    { pageSize: '0' },
    { pageSize: '101' },
    { pageSize: '01' },
    { pageSize: '1.5' },
    { pageSize: '-1' },
    { pageSize: ' 20' },
    { cursor: '' },
    { order: 'desc' },
    { professionalId: scope.subjectId },
    { sql: 'weight_kg' },
  ])
    invalid(() => query(raw))
  for (const size of ['1', '20', '100'])
    assert.equal(query({ pageSize: size }).pageSize, Number(size))
  for (const method of ['perimetros', 'pliegues', 'bioimpedancia', 'legacy'])
    assert.equal(query({ method }).method, method)
  for (const method of ['unknown', 'all', '', 'circumference'])
    invalid(() => query({ method }))
})

test('HU-022 cursor round-trips and binds actor, client, period, method and page size', () => {
  const raw = {
    from: '2026-01-01',
    to: '2026-12-31',
    method: 'legacy',
    pageSize: '100',
  }
  const cursor = evolutionCursor(scope, query(raw), last, key)
  assert.deepEqual(query({ ...raw, cursor }).after, last)
  const sample = evolutionSample(fixture())
  assert.deepEqual(
    query({ cursor: evolutionCursor(scope, query(), sample, key) }).after,
    { date: sample.date, createdAt: sample.createdAt, id: sample.id },
  )
  for (const delta of [
    { from: '2026-01-02' },
    { to: '2026-12-30' },
    { method: 'pliegues' },
    { pageSize: '20' },
  ])
    invalid(() => query({ ...raw, ...delta, cursor }))
  invalid(() => query({ ...raw, cursor }, { ...scope, clientId: last.id }))
  invalid(() => query({ ...raw, cursor }, { ...scope, subjectId: last.id }))
  invalid(() =>
    evolutionQuery({ ...raw, cursor }, scope, new Uint8Array(32).fill(8)),
  )
})

test('HU-022 rejects altered, malformed, oversized and validly signed invalid cursors', () => {
  const cursor = evolutionCursor(scope, query(), last, key)
  for (const c of [
    'not-a-cursor',
    'a.b',
    '.'.repeat(5000),
    `${cursor}x`,
    cursor.replace(/^./, cursor[0] === 'A' ? 'B' : 'A'),
  ])
    invalid(() => query({ cursor: c }))
  const [encoded] = cursor.split('.')
  const original = JSON.parse(Buffer.from(encoded, 'base64url').toString())
  for (const delta of [
    { v: 2 },
    { extra: true },
    { after: { ...last, date: '2026-02-30' } },
    { after: { ...last, id: 'bad' } },
    { after: { ...last, createdAt: '2026-11-10' } },
    { after: [] },
  ]) {
    const e = Buffer.from(JSON.stringify({ ...original, ...delta })).toString(
      'base64url',
    )
    const mac = createHmac('sha256', key)
      .update(`evaluation-history:v1:${e}`)
      .digest('base64url')
    invalid(() => query({ cursor: `${e}.${mac}` }))
  }
  invalid(() => evolutionCursor(scope, query({ to: '2026-01-01' }), last, key))
  invalid(() =>
    evolutionCursor(scope, { ...query(), pageSize: 101 }, last, key),
  )
  assert.throws(() => evolutionCursor(scope, query(), last, new Uint8Array(4)))
})

test('HU-022 chronological comparison preserves same-day and microsecond tie-breaks without mutating input', () => {
  assert.equal(
    evolutionTimestamp('2026-01-01T00:00:00Z'),
    '2026-01-01T00:00:00.000000Z',
  )
  for (const date of [
    '2026-02-30T00:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T00:00:00+00:00',
  ])
    invalid(() => evolutionTimestamp(date))
  const earlier = { ...last, createdAt: '2026-11-11T00:01:02.123455Z' }
  const laterId = { ...last, id: '40000000-0000-4000-8000-000000000004' }
  const previousDate = {
    ...last,
    date: '2026-11-09',
    createdAt: '2026-11-12T00:00:00Z',
  }
  const values = [laterId, last, earlier, previousDate]
  assert.deepEqual([...values].sort(compareEvolutionPositions), [
    previousDate,
    earlier,
    last,
    laterId,
  ])
  assert.deepEqual(values, [laterId, last, earlier, previousDate])
  assert.equal(compareEvolutionPositions(last, { ...last }), 0)
})

test('HU-022 metric catalog covers HU-021 captured fields, units and precision, never calculated outputs', () => {
  assert.deepEqual(
    Object.keys(EVOLUTION_METRICS).sort(),
    [...new Set(Object.values(methodFields).flat())].sort(),
  )
  assert.equal(EVOLUTION_METRICS.weightKg.unit, 'kg')
  assert.equal(EVOLUTION_METRICS.waistCm.unit, 'cm')
  assert.equal(EVOLUTION_METRICS.abdomenUmbilicalCm.unit, 'cm')
  assert.equal(EVOLUTION_METRICS.bicepsSkinfoldMm.unit, 'mm')
  assert.equal(EVOLUTION_METRICS.measuredBodyFatPercentage.unit, '%')
  assert.equal(EVOLUTION_METRICS.waterLitres.unit, 'L')
  assert.equal(EVOLUTION_METRICS.visceralFatIndex.unit, 'índice')
  assert(Object.values(EVOLUTION_METRICS).every((m) => m.decimalPlaces === 1))
  assert(!('bodyFatPercentage' in EVOLUTION_METRICS))
})

test('HU-022 legacy projection preserves unknown method/provenance and no invented zeros or profile dates', () => {
  const e = fixture(),
    before = structuredClone(e),
    sample = evolutionSample(e)
  assert.equal(sample.id, e.id)
  assert.equal(sample.clientId, e.clientId)
  assert.equal(sample.date, e.evaluationDate)
  assert.equal(sample.dateBasis, 'legacy_evaluation_date')
  assert.equal(sample.source, 'professional_evaluation')
  assert.equal(sample.method, null)
  assert.equal(sample.provenance, null)
  assert.equal(sample.protocol, null)
  assert.deepEqual(sample.measurements, { waistCm: 80.1 })
  assert.deepEqual(e, before)
})

test('HU-022 snapshots retain effective date and declared record provenance without duplicating measurements or calculating', () => {
  for (const method of ['perimetros', 'pliegues', 'bioimpedancia'] as const) {
    const a: NonNullable<Evaluation['assessment']> = {
      method,
      equation: 'not_applicable',
      effectiveDate: '2020-01-01',
      measurements: { weightKg: 70.1, waistCm: 80.1 },
      protocol: 'snapshot-protocol',
      ownerId: scope.subjectId,
      birthDate: null,
      ageYears: null,
      version: 'composition-arithmetic-v1',
      calculationStatus: 'pending_verification',
      provenance:
        method === 'bioimpedancia' ? 'device_reported' : 'manual_measurements',
      results: { fatMassKg: 10 },
    }
    const e = fixture({ assessment: a, weightKg: 70.1 }),
      before = structuredClone(e),
      s = evolutionSample(e)
    assert.equal(s.date, '2020-01-01')
    assert.equal(s.dateBasis, 'effective_date')
    assert.equal(s.method, method)
    assert.equal(s.provenance, a.provenance)
    assert.deepEqual(s.measurements, { weightKg: 70.1, waistCm: 80.1 })
    assert(!('fatMassKg' in s.measurements))
    assert.deepEqual(e, before)
  }
})

test('HU-022 zero, single and multiple metric values are counted on loaded samples only', () => {
  const a = evolutionSample(fixture()),
    b = evolutionSample(
      fixture({ ...evaluationMeasurements({ weightKg: 80.1 }) }),
    )
  assert.deepEqual(evolutionMetricState([], 'weightKg'), {
    count: 0,
    state: 'empty',
  })
  assert.deepEqual(evolutionMetricState([a], 'weightKg'), {
    count: 0,
    state: 'empty',
  })
  assert.deepEqual(evolutionMetricState([a, b], 'weightKg'), {
    count: 1,
    state: 'single',
  })
  assert.deepEqual(
    evolutionMetricState(
      [b, { ...b, id: last.id.replace(/^3/, '4') }],
      'weightKg',
    ),
    { count: 2, state: 'multiple' },
  )
})

test('HU-022 OpenAPI catalog matches DTO and implemented history preserves HU-021 routes', () => {
  const spec = JSON.parse(
    readFileSync(
      new URL(
        '../../../docs/api/identity-lifecycle.openapi.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  assert.deepEqual(
    spec.components.schemas.EvolutionMetricCatalog.const,
    EVOLUTION_METRICS,
  )
  const op = spec.paths['/api/clients/{clientId}/evaluation-history'].get
  assert.equal(op['x-implementation-status'], 'implemented-stage-2')
  assert.deepEqual(
    op.parameters.map((p: { name: string }) => p.name),
    ['clientId', 'from', 'to', 'method', 'pageSize', 'cursor'],
  )
  assert.equal(
    spec.paths['/api/clients/{clientId}/evaluations'].post.operationId,
    'createClientEvaluation',
  )
})

test('HU-022 never relabels a snapshot missing its effective date as a legacy measurement', () => {
  const assessment: NonNullable<Evaluation['assessment']> = {
    method: 'perimetros',
    equation: 'not_applicable',
    effectiveDate: null,
    measurements: { waistCm: 80 },
    protocol: 'snapshot-protocol',
    ownerId: scope.subjectId,
    birthDate: null,
    ageYears: null,
    version: 'composition-arithmetic-v1',
    calculationStatus: 'pending_verification',
    provenance: 'manual_measurements',
    results: {},
  }
  assert.throws(
    () => evolutionSample(fixture({ assessment })),
    /Invalid persisted evaluation date/,
  )
  assert.throws(
    () => evolutionSample(fixture({ evaluationDate: '2026-02-30' })),
    /Invalid persisted evaluation date/,
  )
})

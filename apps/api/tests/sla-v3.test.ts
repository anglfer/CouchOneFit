import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SLA_V3_FUNCTIONS,
  computeSlaV3,
  currentSlaMonth,
  isCountedMaintenance,
  parseSlaMonth,
  toLoggedRoute,
  toSlaRoute,
} from '../src/features/observability/services/sla-v3.js'
import type {
  SlaProbeRow,
  SlaRecord,
  SlaRequestRow,
} from '../src/features/observability/services/sla-v3.js'

const MONTH = '2026-12'
const NOW = new Date('2027-01-02T12:00:00Z')
let seq = 0

function record(
  kind: SlaRecord['kind'],
  occurredAt: string,
  endedAt: string | null,
  details: Record<string, unknown>,
): SlaRecord {
  seq += 1
  return { id: `rec-${seq}`, kind, occurredAt, endedAt, details, source: 'admin' }
}

function req(
  method: string,
  route: string,
  status: number,
  durationMs: number,
  index = 0,
  uptimeS: number | null = 3600,
): SlaRequestRow {
  // Mid-week afternoon of December, spread over the month.
  const ts = new Date(Date.UTC(2026, 11, 8, 18, 0, 0) + index * 1000).toISOString()
  return { ts, method, route, status, durationMs, uptimeS }
}

function sli(report: ReturnType<typeof computeSlaV3>, id: string) {
  const found = report.slis.find((s) => s.id === id)
  assert.ok(found, `missing ${id}`)
  return found
}

// Saturday 2026-12-05 01:00-04:00 Mexico City is 07:00-10:00Z.
const goodWindow = (day: number) =>
  record(
    'maintenance_window',
    `2026-12-${String(day).padStart(2, '0')}T07:00:00Z`,
    `2026-12-${String(day).padStart(2, '0')}T10:00:00Z`,
    { notifiedAt: `2026-12-${String(day - 4).padStart(2, '0')}T12:00:00Z` },
  )

test('month bounds use the fixed UTC-6 offset', () => {
  const bounds = parseSlaMonth('2026-12')!
  assert.equal(bounds.start.toISOString(), '2026-12-01T06:00:00.000Z')
  assert.equal(bounds.end.toISOString(), '2027-01-01T06:00:00.000Z')
  assert.equal(parseSlaMonth('2026-13'), null)
  assert.equal(parseSlaMonth('2026-1'), null)
  assert.equal(currentSlaMonth(new Date('2027-01-01T05:59:59Z')), '2026-12')
  assert.equal(currentSlaMonth(new Date('2027-01-01T06:00:00Z')), '2027-01')
})

test('catalog has 26 functions and the report has 67 SLIs in order', () => {
  assert.equal(SLA_V3_FUNCTIONS.length, 26)
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [] })
  assert.equal(report.slis.length, 67)
  assert.equal(report.summary.total, 67)
  assert.deepEqual(report.slis.slice(0, 3).map((s) => s.id), ['F-01-E', 'F-01-L', 'F-02-E'])
  assert.deepEqual(
    report.slis.slice(52).map((s) => s.id),
    ['G-01', 'D-01', 'D-02', 'D-03', 'D-04', 'C-01', 'C-02', 'R-01', 'R-02', 'R-03', 'O-01', 'O-02', 'O-03', 'O-04', 'O-05'],
  )
})

test('route notation round trips between SLA and logged routes', () => {
  assert.equal(
    toLoggedRoute('/api/clients/:clientId/training-plans/:planId/versions/:versionId'),
    '/api/clients/:id/training-plans/:id/versions/:id',
  )
  assert.equal(
    toSlaRoute('PATCH', '/api/clients/:id/training-plans/:id/versions/:id'),
    '/api/clients/:clientId/training-plans/:planId/versions/:versionId',
  )
  assert.equal(toSlaRoute('GET', '/api/clients/:id'), '/api/clients/:clientId')
  assert.equal(toSlaRoute('GET', '/api/unknown/:id'), '/api/unknown/:id')
  assert.equal(toSlaRoute('DELETE', '/api/plans'), '/api/plans')
})

test('F-02-E matches SLA example 8.4: 20 with 429 and 15 with 503 out of 1000', () => {
  const requests: SlaRequestRow[] = []
  for (let i = 0; i < 1000; i += 1) {
    const status = i < 20 ? 429 : i < 35 ? 503 : 200
    requests.push(req('POST', '/api/auth/login', status, 100, i))
  }
  const report = computeSlaV3({ month: MONTH, now: NOW, requests, probes: [], records: [] })
  const e = sli(report, 'F-02-E')
  assert.equal(e.samples, 980)
  assert.equal(e.observed, 98.47)
  assert.equal(e.attributable, 98.47)
  assert.equal(e.status, 'met')
})

test('F-22-L matches SLA example 8.4: p95 of 200 samples is position 190', () => {
  const requests: SlaRequestRow[] = []
  for (let i = 1; i <= 200; i += 1) {
    // Ascending durations, position 190 is 640 ms.
    const duration = i <= 190 ? 640 - (190 - i) : 700 + i
    requests.push(req('GET', '/api/me/training-plan', 200, duration, i))
  }
  const report = computeSlaV3({ month: MONTH, now: NOW, requests, probes: [], records: [] })
  const l = sli(report, 'F-22-L')
  assert.equal(l.observed, 640)
  assert.equal(l.status, 'met')
  assert.equal(l.samples, 200)
})

test('D-01 matches SLA example 8.4 with 24 probes inside 4 counted windows', () => {
  const records = [5, 12, 19, 26].map(goodWindow)
  const probes: SlaProbeRow[] = []
  const first = Date.UTC(2026, 11, 1, 6, 0, 0)
  let failed = 0
  for (let i = 0; i < 1440; i += 1) {
    const time = first + i * 30 * 60_000
    const inWindow = records.some(
      (r) => time >= Date.parse(r.occurredAt) && time < Date.parse(r.endedAt as string),
    )
    // Fail 20 probes that are outside every window.
    const fail = !inWindow && i % 70 === 3 && failed < 20
    if (fail) failed += 1
    probes.push({
      ts: new Date(time).toISOString(),
      target: 'api:/api/ready',
      status: inWindow || fail ? 503 : 200,
      durationMs: 120,
      contentOk: true,
      coldStart: false,
    })
  }
  assert.equal(failed, 20)
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes, records })
  const d = sli(report, 'D-01')
  assert.equal(d.samples, 1416)
  assert.equal(d.observed, 98.59)
  assert.equal(d.status, 'met')
  assert.equal(report.compensation.due, false)
})

test('fewer than 50 valid requests is insufficient_sample for E and L', () => {
  const requests = Array.from({ length: 49 }, (_, i) => req('GET', '/api/plans', 200, 50, i))
  const report = computeSlaV3({ month: MONTH, now: NOW, requests, probes: [], records: [] })
  assert.equal(sli(report, 'F-07-E').status, 'insufficient_sample')
  assert.equal(sli(report, 'F-07-L').status, 'insufficient_sample')
  assert.equal(sli(report, 'G-01').status, 'insufficient_sample')
})

test('4xx counts as good and requests with uptime below 60 s skip latency', () => {
  const requests: SlaRequestRow[] = []
  for (let i = 0; i < 60; i += 1) {
    requests.push(req('POST', '/api/auth/login', 401, 90, i))
  }
  for (let i = 0; i < 10; i += 1) {
    requests.push(req('POST', '/api/auth/login', 200, 5000, 100 + i, 30))
    requests.push(req('POST', '/api/auth/login', 200, 5000, 200 + i, null))
  }
  const report = computeSlaV3({ month: MONTH, now: NOW, requests, probes: [], records: [] })
  assert.equal(sli(report, 'F-02-E').observed, 100)
  const l = sli(report, 'F-02-L')
  assert.equal(l.samples, 60)
  assert.equal(l.observed, 90)
  assert.equal(l.status, 'met')
})

test('requests outside the month or in a counted window are not valid', () => {
  const records = [goodWindow(5)]
  const requests: SlaRequestRow[] = Array.from({ length: 50 }, (_, i) =>
    req('GET', '/api/plans', 200, 40, i),
  )
  requests.push({ ...req('GET', '/api/plans', 503, 40), ts: '2026-12-05T08:00:00Z' })
  requests.push({ ...req('GET', '/api/plans', 503, 40), ts: '2027-01-01T06:00:00Z' })
  const report = computeSlaV3({ month: MONTH, now: NOW, requests, probes: [], records })
  assert.equal(sli(report, 'F-07-E').samples, 50)
  assert.equal(sli(report, 'F-07-E').observed, 100)
})

test('a maintenance window counts only with 48 h notice and inside Saturday 01:00-04:00', () => {
  const ok = goodWindow(5)
  const late = record('maintenance_window', '2026-12-12T07:00:00Z', '2026-12-12T10:00:00Z', {
    notifiedAt: '2026-12-11T12:00:00Z',
  })
  const wrongDay = record('maintenance_window', '2026-12-13T07:00:00Z', '2026-12-13T10:00:00Z', {
    notifiedAt: '2026-12-01T12:00:00Z',
  })
  const tooLong = record('maintenance_window', '2026-12-19T07:00:00Z', '2026-12-19T11:00:00Z', {
    notifiedAt: '2026-12-01T12:00:00Z',
  })
  const early = record('maintenance_window', '2026-12-26T06:00:00Z', '2026-12-26T08:00:00Z', {
    notifiedAt: '2026-12-01T12:00:00Z',
  })
  const records = [ok, late, wrongDay, tooLong, early]
  assert.equal(isCountedMaintenance(new Date('2026-12-05T08:00:00Z'), records), true)
  assert.equal(isCountedMaintenance(new Date('2026-12-05T10:00:00Z'), records), false)
  assert.equal(isCountedMaintenance(new Date('2026-12-12T08:00:00Z'), records), false)
  assert.equal(isCountedMaintenance(new Date('2026-12-13T08:00:00Z'), records), false)
  assert.equal(isCountedMaintenance(new Date('2026-12-19T08:00:00Z'), records), false)
  assert.equal(isCountedMaintenance(new Date('2026-12-26T07:00:00Z'), records), false)
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records })
  assert.deepEqual(
    report.maintenanceWindows.map((w) => w.counted),
    [true, false, false, false, false],
  )
  // O-03 only checks the notice: 4 of 5 windows had >= 48 h.
  assert.equal(sli(report, 'O-03').observed, 80)
  assert.equal(sli(report, 'O-03').status, 'unmet')
})

test('attributable values drop failures inside a provider incident', () => {
  const provider = record('provider_incident', '2026-12-08T17:59:00Z', '2026-12-08T18:00:30Z', {
    provider: 'render',
    url: 'https://status.render.com/incident',
  })
  const requests: SlaRequestRow[] = []
  for (let i = 0; i < 90; i += 1) requests.push(req('POST', '/api/auth/login', 200, 80, 100 + i))
  // 10 failures inside the incident (18:00:00 to 18:00:09).
  for (let i = 0; i < 10; i += 1) requests.push(req('POST', '/api/auth/login', 503, 80, i))
  const report = computeSlaV3({ month: MONTH, now: NOW, requests, probes: [], records: [provider] })
  const e = sli(report, 'F-02-E')
  assert.equal(e.observed, 90)
  assert.equal(e.attributable, 100)
  assert.equal(e.status, 'met')
  const global = sli(report, 'G-01')
  assert.equal(global.observed, 10)
  assert.equal(global.attributable, 0)
})

test('business-hours deadlines start at the next business hour', () => {
  // Saturday 2026-12-05 12:00 MX = 18:00Z. Support starts Monday 09:00 MX = 15:00Z.
  const sat = record('support_incident', '2026-12-05T18:00:00Z', '2026-12-07T21:00:00Z', {
    severity: 'alta',
    acknowledgedAt: '2026-12-07T15:20:00Z',
    cause: 'Caída',
    attributable: false,
  })
  // Wednesday 2026-12-09 16:30 MX (22:30Z), 1 business hour left plus next day.
  const media = record('support_incident', '2026-12-09T22:30:00Z', '2026-12-10T18:00:00Z', {
    severity: 'media',
    acknowledgedAt: '2026-12-09T23:30:00Z',
    cause: 'Falla',
    attributable: false,
  })
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [sat, media] })
  const [a, m] = report.incidents
  assert.equal(a.ackDeadline, '2026-12-07T15:30:00.000Z')
  assert.equal(a.ackOnTime, true)
  assert.equal(a.resolveDeadline, '2026-12-07T19:00:00.000Z')
  assert.equal(a.resolvedOnTime, false)
  // Media: ack in 1 h (16:30 -> 17:30 MX), resolution 9 business hours:
  // 1.5 h left Wednesday, then Thursday 09:00 + 7.5 h = 16:30 MX = 22:30Z.
  assert.equal(m.ackDeadline, '2026-12-09T23:30:00.000Z')
  assert.equal(m.ackOnTime, true)
  assert.equal(m.resolveDeadline, '2026-12-10T22:30:00.000Z')
  assert.equal(m.resolvedOnTime, true)
  assert.equal(sli(report, 'O-01').observed, 100)
  assert.equal(sli(report, 'O-02').observed, 50)
  assert.equal(sli(report, 'O-02').status, 'unmet')
})

test('mandatory rest days are skipped by business-hours deadlines', () => {
  // 2026-12-24 (Thursday) 17:00 MX; 25 Dec is a holiday, 26-27 weekend.
  const baja = record('support_incident', '2026-12-24T23:00:00Z', null, {
    severity: 'baja',
    acknowledgedAt: null,
    cause: 'Visual',
    attributable: false,
  })
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [baja] })
  // 1 h Thursday (17:00-18:00), then Monday 28th 09:00 + 3 h = 12:00 MX = 18:00Z.
  assert.equal(report.incidents[0].ackDeadline, '2026-12-28T18:00:00.000Z')
  assert.equal(report.incidents[0].ackOnTime, false)

  // Third Monday of November 2026 is the 16th: a report on Friday 13th 17:30 MX
  // gets its 1 h acknowledgement window after the holiday weekend.
  const media = record('support_incident', '2026-11-14T00:30:00Z', null, {
    severity: 'media',
    acknowledgedAt: null,
    cause: 'x',
    attributable: false,
  })
  const november = computeSlaV3({ month: '2026-11', now: NOW, requests: [], probes: [], records: [media] })
  assert.equal(november.incidents[0].ackDeadline, '2026-11-17T16:00:00.000Z')
})

test('requiresRestore sets the high-severity resolution deadline to ack deadline plus 4 h', () => {
  const alta = record('support_incident', '2026-12-08T16:00:00Z', null, {
    severity: 'alta',
    acknowledgedAt: null,
    cause: 'BD',
    attributable: true,
    requiresRestore: true,
  })
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [alta] })
  assert.equal(report.incidents[0].ackDeadline, '2026-12-08T16:30:00.000Z')
  assert.equal(report.incidents[0].resolveDeadline, '2026-12-08T20:30:00.000Z')
})

test('R-03 counts business days only', () => {
  const records = [
    record('access_cleanup', '2026-12-01T10:00:00Z', null, { ok: true }),
    record('access_cleanup', '2026-12-02T10:00:00Z', null, { ok: true }),
    record('access_cleanup', '2026-12-03T10:00:00Z', null, { ok: false }),
    record('access_cleanup', '2026-12-05T10:00:00Z', null, { ok: true }),
    record('backup', '2026-12-01T09:00:00Z', null, { ok: true }),
    record('backup', '2026-12-03T09:00:00Z', null, { ok: true }),
    record('backup', '2026-12-05T09:00:00Z', null, { ok: true }),
  ]
  const report = computeSlaV3({
    month: MONTH,
    now: new Date('2026-12-05T20:00:00Z'),
    requests: [],
    probes: [],
    records,
  })
  // Business days elapsed: Dec 1 to 4 (Saturday 5th is not one).
  const r = sli(report, 'R-03')
  assert.equal(r.samples, 4)
  assert.equal(r.observed, 50)
  assert.equal(r.status, 'unmet')
  assert.equal(sli(report, 'R-01').samples, 5)
  assert.equal(sli(report, 'R-01').observed, 60)
})

test('O-04 deadline is 18:00 of the fifth business day of the month', () => {
  // December 2026: business days 1,2,3,4,7 -> deadline 2026-12-07 18:00 MX = 2026-12-08T00:00Z.
  const onTime = record('monthly_report', '2026-12-07T23:59:00Z', null, { period: '2026-11' })
  const late = record('monthly_report', '2026-12-08T00:01:00Z', null, { period: '2026-11' })
  const forMonth = (r: SlaRecord) =>
    sli(computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [r] }), 'O-04')
  assert.equal(forMonth(onTime).status, 'met')
  assert.equal(forMonth(late).status, 'unmet')
  assert.equal(
    sli(computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [] }), 'O-04').status,
    'no_data',
  )
})

test('platform, capacity and operation SLIs from records', () => {
  const probes: SlaProbeRow[] = [4, 5, 6, 7, 8].map((i) => ({
    ts: `2026-12-0${i}T10:00:00Z`,
    target: 'api:/api/ready',
    status: 200,
    durationMs: 30_000 + i * 1000,
    contentOk: true,
    coldStart: true,
  }))
  const records = [
    record('storage_measurement', '2026-12-10T10:00:00Z', null, { bytes: 100, limitBytes: 1000 }),
    record('storage_measurement', '2026-12-11T10:00:00Z', null, { bytes: 410_000_000 }),
    record('load_test', '2026-11-20T10:00:00Z', null, {
      version: '1', readP95Ms: 700, writeP95Ms: 1400, readSamples: 600, writeSamples: 500,
    }),
    record('restore_drill', '2026-10-20T10:00:00Z', '2026-10-20T12:30:00Z', { ok: true }),
    record('deployment', '2026-12-09T10:00:00Z', null, { version: 'a', healthOk: true, readinessOk: true, functionalOk: true }),
    record('deployment', '2026-12-10T10:00:00Z', null, { version: 'b', healthOk: true, readinessOk: false, functionalOk: true }),
  ]
  const report = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes, records })
  assert.equal(sli(report, 'D-04').observed, 38)
  assert.equal(sli(report, 'D-04').status, 'met')
  assert.equal(sli(report, 'C-01').observed, 78.2)
  assert.equal(sli(report, 'C-01').status, 'met')
  assert.equal(sli(report, 'C-02').status, 'met')
  assert.equal(sli(report, 'C-02').observed, 700)
  assert.equal(sli(report, 'R-02').observed, 2.5)
  assert.equal(sli(report, 'R-02').status, 'met')
  assert.equal(sli(report, 'O-05').observed, 50)
  assert.equal(sli(report, 'O-05').status, 'unmet')

  const lowSamples = computeSlaV3({
    month: MONTH,
    now: NOW,
    requests: [],
    probes: probes.slice(0, 4),
    records: [record('load_test', '2026-12-01T10:00:00Z', null, { readP95Ms: 1, writeP95Ms: 1, readSamples: 499, writeSamples: 900 })],
  })
  assert.equal(sli(lowSamples, 'D-04').status, 'insufficient_sample')
  assert.equal(sli(lowSamples, 'C-02').status, 'insufficient_sample')
  assert.equal(sli(lowSamples, 'C-01').status, 'no_data')
  assert.equal(sli(lowSamples, 'R-02').status, 'unverified')
})

test('compensation is due when D-01 attributable is below 95 % or a provider high incident exceeds 8 business hours', () => {
  const probes: SlaProbeRow[] = Array.from({ length: 100 }, (_, i) => ({
    ts: new Date(Date.UTC(2026, 11, 8, 12, i)).toISOString(),
    target: 'api:/api/health/ready',
    status: i < 10 ? 503 : 200,
    durationMs: 100,
    contentOk: true,
    coldStart: false,
  }))
  const low = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes, records: [] })
  assert.equal(sli(low, 'D-01').attributable, 90)
  assert.equal(low.compensation.due, true)

  // Monday 09:00 MX to Tuesday 12:00 MX = 12 business hours.
  const alta = record('support_incident', '2026-12-07T15:00:00Z', '2026-12-08T18:00:00Z', {
    severity: 'alta',
    acknowledgedAt: '2026-12-07T15:10:00Z',
    cause: 'Proveedor',
    attributable: true,
  })
  const slow = computeSlaV3({ month: MONTH, now: NOW, requests: [], probes: [], records: [alta] })
  assert.equal(slow.compensation.due, true)
  assert.equal(slow.compensation.reasons.length, 1)
  const notProvider = computeSlaV3({
    month: MONTH,
    now: NOW,
    requests: [],
    probes: [],
    records: [{ ...alta, details: { ...alta.details, attributable: false } }],
  })
  assert.equal(notProvider.compensation.due, false)
})

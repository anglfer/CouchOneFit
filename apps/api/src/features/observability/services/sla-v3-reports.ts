import type { Pool } from 'pg'
import { config } from '../../../config/index.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import * as repo from '../repositories/sla-v3.js'
import type { ObservabilityEnvironment } from '../types/observability.js'
import {
  validateSlaMonthQuery,
  validateSlaOperationInput,
  validateSlaRecordId,
  validateSlaRecordInput,
  validateSlaStorageInput,
} from '../validators/sla-v3.js'
import { parseEnvironment } from '../validators/observability.js'
import {
  computeSlaV3,
  isCountedMaintenance,
  parseSlaMonth,
  toSlaRoute,
} from './sla-v3.js'
import type { SlaV3Report } from './sla-v3.js'

function defaultEnv(): ObservabilityEnvironment {
  return parseEnvironment(config.observabilityEnv, 'development')
}

export type CsvExport = { filename: string; content: string }

async function loadMonth(pool: Pool, identity: SessionIdentity, query: unknown, now: Date) {
  const params = validateSlaMonthQuery(query, defaultEnv(), now)
  // Restore drills of the three months ending at the month end (R-02).
  const drillsFrom = parseSlaMonth(
    new Date(Date.UTC(Number(params.month.slice(0, 4)), Number(params.month.slice(5, 7)) - 3, 1))
      .toISOString()
      .slice(0, 7),
  )!.start
  const data = await repo.loadSlaMonth(
    pool,
    identity,
    params.environment,
    params.start,
    params.end,
    drillsFrom,
  )
  return { params, ...data }
}

export async function buildSlaReport(
  pool: Pool,
  identity: SessionIdentity,
  query: unknown,
  now = new Date(),
): Promise<{ report: SlaV3Report }> {
  const { params, ...data } = await loadMonth(pool, identity, query, now)
  return { report: computeSlaV3({ month: params.month, now, ...data }) }
}

const yesNo = (value: boolean) => (value ? 'si' : 'no')
const iso = (value: string | number | Date) => new Date(value).toISOString().slice(0, 19) + 'Z'

/** RFC 4180 quoting; free text also neutralizes spreadsheet formulas. */
function cell(value: unknown, freeText = false): string {
  let raw = value === null || value === undefined ? '' : String(value)
  if (freeText && /^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`
  return /[",\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw
}
const csv = (rows: unknown[][]): string => rows.map((r) => r.join(',')).join('\n') + '\n'

export async function exportSlaCsv(
  pool: Pool,
  identity: SessionIdentity,
  kind: 'requests' | 'probes' | 'incidents' | 'operations',
  query: unknown,
  now = new Date(),
): Promise<CsvExport> {
  const { params, requests, probes, records } = await loadMonth(pool, identity, query, now)
  const filename = `${kind}-${params.month}.csv`
  if (kind === 'requests') {
    return {
      filename,
      content: csv([
        ['ts', 'method', 'route', 'status', 'duration_ms', 'uptime_s', 'in_maintenance'],
        ...requests.map((r) => [
          iso(r.ts),
          cell(r.method),
          cell(toSlaRoute(r.method, r.route), true),
          r.status,
          r.durationMs,
          r.uptimeS ?? '',
          yesNo(isCountedMaintenance(new Date(r.ts), records)),
        ]),
      ]),
    }
  }
  if (kind === 'probes') {
    return {
      filename,
      content: csv([
        ['ts', 'target', 'status', 'duration_ms', 'content_ok', 'cold_start'],
        ...probes.map((p) => [
          iso(p.ts),
          cell(p.target, true),
          p.status ?? '',
          p.durationMs ?? '',
          yesNo(p.contentOk),
          yesNo(p.coldStart),
        ]),
      ]),
    }
  }
  if (kind === 'incidents') {
    const report = computeSlaV3({ month: params.month, now, requests, probes, records })
    return {
      filename,
      content: csv([
        ['id', 'severidad', 'recibido', 'acuse', 'resuelto', 'causa', 'atribuible'],
        ...report.incidents.map((i) => [
          cell(i.id),
          i.severity,
          iso(i.receivedAt),
          i.acknowledgedAt ? iso(i.acknowledgedAt) : '',
          i.resolvedAt ? iso(i.resolvedAt) : '',
          cell(i.cause, true),
          yesNo(i.attributable),
        ]),
      ]),
    }
  }
  const monthOnly = records.filter((r) => {
    const at = Date.parse(r.occurredAt)
    return at >= params.start.getTime() && at < params.end.getTime()
  })
  return {
    filename,
    content: csv([
      ['fecha', 'tipo', 'resultado', 'responsable', 'detalle'],
      ...monthOnly.map((r) => [
        iso(r.occurredAt),
        r.kind,
        typeof r.details.ok === 'boolean' ? (r.details.ok ? 'ok' : 'falla') : '',
        cell(r.details.responsible, true),
        cell(JSON.stringify(r.details), true),
      ]),
    ]),
  }
}

export async function listSlaRecords(
  pool: Pool,
  identity: SessionIdentity,
  query: unknown,
  now = new Date(),
) {
  const params = validateSlaMonthQuery(query, defaultEnv(), now)
  return {
    records: await repo.listSlaRecords(pool, identity, params.environment, params.start, params.end),
  }
}

export async function createSlaRecord(pool: Pool, identity: SessionIdentity, body: unknown) {
  const input = validateSlaRecordInput(body, defaultEnv())
  return { record: await repo.createSlaRecord(pool, identity, input) }
}

export async function deleteSlaRecord(pool: Pool, identity: SessionIdentity, id: string) {
  await repo.deleteSlaRecord(pool, identity, validateSlaRecordId(id))
}

export async function measureSlaStorage(pool: Pool, identity: SessionIdentity, body: unknown) {
  const input = validateSlaStorageInput(body, defaultEnv())
  return { record: await repo.measureStorage(pool, identity, input.environment, input.limitBytes) }
}

export async function ingestSlaOperation(pool: Pool, body: unknown) {
  const input = validateSlaOperationInput(body, defaultEnv())
  return repo.ingestSlaOperation(pool, input)
}

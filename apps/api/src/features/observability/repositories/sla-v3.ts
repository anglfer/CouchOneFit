import type { Pool, PoolClient } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import type { ObservabilityEnvironment } from '../types/observability.js'
import type {
  SlaProbeRow,
  SlaRecord,
  SlaRecordKind,
  SlaRequestRow,
} from '../services/sla-v3.js'
import { adminTx, ingestTx, recordAuditEntry } from './observability.js'

type RecordRow = {
  id: string
  kind: SlaRecordKind
  occurred_at: Date
  ended_at: Date | null
  details: Record<string, unknown>
  source: 'admin' | 'automation'
}

const RECORD_COLUMNS = 'id, kind, occurred_at, ended_at, details, source'

function toRecord(row: RecordRow): SlaRecord {
  return {
    id: row.id,
    kind: row.kind,
    occurredAt: row.occurred_at.toISOString(),
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    details: row.details,
    source: row.source,
  }
}

async function monthRecords(
  client: PoolClient,
  environment: ObservabilityEnvironment,
  start: Date,
  end: Date,
  extras?: { drillsFrom: Date },
): Promise<SlaRecord[]> {
  const { rows } = await client.query<RecordRow>(
    `SELECT ${RECORD_COLUMNS}
     FROM private.observability_sla_records r
     WHERE r.environment = $1
       AND (
         (r.occurred_at >= $2 AND r.occurred_at < $3)
         OR (r.ended_at >= $2 AND r.ended_at < $3)
         OR ($4::timestamptz IS NOT NULL AND r.kind = 'restore_drill'
             AND r.occurred_at >= $4 AND r.occurred_at < $3)
         OR ($4::timestamptz IS NOT NULL AND r.id = (
             SELECT l.id FROM private.observability_sla_records l
             WHERE l.environment = $1 AND l.kind = 'load_test' AND l.occurred_at < $3
             ORDER BY l.occurred_at DESC, l.id DESC LIMIT 1))
       )
     ORDER BY r.occurred_at, r.id`,
    [environment, start.toISOString(), end.toISOString(), extras?.drillsFrom.toISOString() ?? null],
  )
  return rows.map(toRecord)
}

export async function listSlaRecords(
  pool: Pool,
  identity: SessionIdentity,
  environment: ObservabilityEnvironment,
  start: Date,
  end: Date,
): Promise<SlaRecord[]> {
  return adminTx(pool, identity, async (client) => {
    return monthRecords(client, environment, start, end)
  })
}

// shortcut: loads the whole month in memory; aggregate in SQL (percentile_disc) if a month exceeds ~1M rows
export async function loadSlaMonth(
  pool: Pool,
  identity: SessionIdentity,
  environment: ObservabilityEnvironment,
  start: Date,
  end: Date,
  drillsFrom: Date,
): Promise<{ requests: SlaRequestRow[]; probes: SlaProbeRow[]; records: SlaRecord[] }> {
  return adminTx(pool, identity, async (client) => {
    const window = [environment, start.toISOString(), end.toISOString()]
    const { rows: requestRows } = await client.query<{
      ts: Date
      method: string
      route: string
      status: number
      duration: number
      uptime: string | null
    }>(
      `SELECT l.occurred_at AS ts, l.http_method AS method, l.normalized_path AS route,
              l.status_code AS status, l.duration_ms::float8 AS duration,
              l.metadata->>'uptimeS' AS uptime
       FROM private.observability_logs l
       WHERE l.environment = $1
         AND l.event_type = 'http.request'
         AND l.occurred_at >= $2 AND l.occurred_at < $3
         AND l.http_method IS NOT NULL AND l.normalized_path IS NOT NULL
         AND l.status_code IS NOT NULL AND l.duration_ms IS NOT NULL
       ORDER BY l.occurred_at, l.id`,
      window,
    )
    const { rows: probeRows } = await client.query<{
      ts: Date
      service: string
      target: string | null
      status: number | null
      duration: number | null
      check_status: string
      phase: string
    }>(
      `SELECT c.executed_at AS ts, c.service, c.target, c.http_status AS status,
              c.duration_ms::float8 AS duration, c.status AS check_status, c.phase
       FROM private.observability_check_results c
       WHERE c.environment = $1
         AND c.check_kind = 'synthetic_availability'
         AND c.executed_at >= $2 AND c.executed_at < $3
         AND c.status IN ('passed', 'failed')
         AND c.phase <> 'recovery-drill'
       ORDER BY c.executed_at, c.id`,
      window,
    )
    const records = await monthRecords(client, environment, start, end, { drillsFrom })
    return {
      requests: requestRows.map((r) => {
        const uptime = r.uptime === null ? Number.NaN : Number(r.uptime)
        return {
          ts: r.ts.toISOString(),
          method: r.method,
          route: r.route,
          status: r.status,
          durationMs: r.duration,
          uptimeS: Number.isFinite(uptime) ? uptime : null,
        }
      }),
      probes: probeRows.map((p) => ({
        ts: p.ts.toISOString(),
        // The monitor tags readiness as service 'database', but it probes the API origin (SLA D-01).
        target: `${p.service === 'web' ? 'web' : 'api'}:${p.target ?? ''}`,
        status: p.status,
        durationMs: p.duration,
        contentOk: p.check_status === 'passed',
        coldStart: p.phase === 'cold_start',
      })),
      records,
    }
  })
}

export async function createSlaRecord(
  pool: Pool,
  identity: SessionIdentity,
  input: {
    environment: ObservabilityEnvironment
    kind: SlaRecordKind
    occurredAt: string
    endedAt: string | null
    details: Record<string, unknown>
  },
): Promise<SlaRecord> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [row],
    } = await client.query<RecordRow>(
      `INSERT INTO private.observability_sla_records
         (environment, kind, occurred_at, ended_at, details, source, created_by)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5::jsonb, 'admin', $6)
       RETURNING ${RECORD_COLUMNS}`,
      [
        input.environment,
        input.kind,
        input.occurredAt,
        input.endedAt,
        JSON.stringify(input.details),
        identity.id,
      ],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'sla_record',
      entityId: row.id,
      action: 'created',
      summary: `Registro de bitácora SLA: ${input.kind}`,
      changes: { environment: input.environment, kind: input.kind },
    })
    return toRecord(row)
  })
}

export async function deleteSlaRecord(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
): Promise<void> {
  await adminTx(pool, identity, async (client) => {
    const { rows } = await client.query<{ id: string; kind: string; environment: string }>(
      `DELETE FROM private.observability_sla_records
       WHERE id = $1 RETURNING id, kind, environment`,
      [id],
    )
    if (!rows.length) throw new AuthError(404, 'NOT_FOUND', 'El registro no existe.')
    await recordAuditEntry(client, identity.id, {
      entityType: 'sla_record',
      entityId: id,
      action: 'deleted',
      summary: `Registro de bitácora SLA eliminado: ${rows[0].kind}`,
      changes: { environment: rows[0].environment, kind: rows[0].kind },
    })
  })
}

export async function measureStorage(
  pool: Pool,
  identity: SessionIdentity,
  environment: ObservabilityEnvironment,
  limitBytes: number,
): Promise<SlaRecord> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [size],
    } = await client.query<{ bytes: string }>(
      'SELECT pg_database_size(current_database())::text AS bytes',
    )
    const bytes = Number(size.bytes)
    const {
      rows: [row],
    } = await client.query<RecordRow>(
      `INSERT INTO private.observability_sla_records
         (environment, kind, occurred_at, details, source, created_by)
       VALUES ($1, 'storage_measurement', clock_timestamp(), $2::jsonb, 'admin', $3)
       RETURNING ${RECORD_COLUMNS}`,
      [environment, JSON.stringify({ bytes, limitBytes }), identity.id],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'sla_record',
      entityId: row.id,
      action: 'created',
      summary: `Medición de almacenamiento: ${bytes} bytes`,
      changes: { environment, bytes, limitBytes },
    })
    return toRecord(row)
  })
}

export async function ingestSlaOperation(
  pool: Pool,
  input: {
    environment: ObservabilityEnvironment
    kind: SlaRecordKind
    occurredAt: string
    details: Record<string, unknown>
    externalId: string
  },
): Promise<{ record: SlaRecord; duplicate: boolean }> {
  return ingestTx(pool, async (client) => {
    const {
      rows: [row],
    } = await client.query<{
      result: {
        duplicate: boolean
        record: Omit<SlaRecord, 'occurredAt' | 'endedAt'> & {
          occurredAt: string
          endedAt: string | null
        }
      }
    }>(
      'SELECT private.record_observability_sla_operation($1, $2, $3::timestamptz, $4::jsonb, $5) AS result',
      [
        input.environment,
        input.kind,
        input.occurredAt,
        JSON.stringify(input.details),
        input.externalId,
      ],
    )
    const { record, duplicate } = row.result
    return {
      duplicate,
      record: {
        ...record,
        occurredAt: new Date(record.occurredAt).toISOString(),
        endedAt: record.endedAt ? new Date(record.endedAt).toISOString() : null,
      },
    }
  })
}

import type { Pool, PoolClient } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import { context, transaction } from '../../auth/repositories/lifecycle.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import type {
  CheckResultRecord,
  CheckRunRecord,
  EvaluationSnapshot,
  IncidentRecord,
  IncidentStatus,
  LogRecordItem,
  ObservabilityEnvironment,
  ObservabilitySettings,
  SlaAgreement,
  SliCalculationMethod,
  SliDefinition,
  SliVersionRecord,
  SloDefinition,
  SloEvaluationRecord,
  SloVersionRecord,
} from '../types/observability.js'
import type { IncidentSignal } from '../services/incident-detector.js'

async function adminTx<T>(
  pool: Pool,
  identity: SessionIdentity,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return transaction(pool, async (client) => {
    await context(client, 'subject_id', identity.id)
    return work(client)
  })
}

async function ingestTx<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return transaction(pool, async (client) => {
    await client.query(
      "SELECT set_config('app.observability_scope', 'ingest', true)",
    )
    return work(client)
  })
}

export async function recordAuditEntry(
  client: PoolClient,
  adminId: string,
  entry: {
    entityType: 'sli' | 'slo' | 'sla' | 'settings' | 'incident' | 'check_run' | 'maintenance'
    entityId: string
    action: 'created' | 'updated' | 'status_changed' | 'evaluated' | 'acknowledged' | 'resolved' | 'manual_run' | 'pruned'
    summary: string
    changes?: Record<string, unknown>
  },
): Promise<void> {
  await client.query(
    `INSERT INTO private.observability_audit_log (admin_id, entity_type, entity_id, action, summary, changes)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      adminId,
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.summary,
      JSON.stringify(entry.changes ?? {}),
    ],
  )
}

export async function readRuntimeSettings(
  pool: Pool,
  identity?: SessionIdentity,
): Promise<ObservabilitySettings> {
  const exec = async (client: PoolClient) => {
    const {
      rows: [row],
    } = await client.query<{ cfg: ObservabilitySettings }>(
      'SELECT private.read_observability_runtime_config() AS cfg',
    )
    return row.cfg
  }
  if (identity) return adminTx(pool, identity, exec)
  const client = await pool.connect()
  try {
    return await exec(client)
  } finally {
    client.release()
  }
}

export async function updateSettings(
  pool: Pool,
  identity: SessionIdentity,
  data: Omit<ObservabilitySettings, 'updatedAt'>,
): Promise<ObservabilitySettings> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [row],
    } = await client.query(
      `UPDATE private.observability_settings
       SET monitor_enabled = $1,
           check_interval_minutes = $2,
           log_retention_days = $3,
           check_retention_days = $4,
           evaluation_retention_days = $5,
           incident_error_rate_threshold_pct = $6,
           incident_latency_p95_threshold_ms = $7,
           incident_consecutive_failures = $8,
           updated_by = $9,
           updated_at = clock_timestamp()
       WHERE key = 'default'
       RETURNING
         monitor_enabled AS "monitorEnabled",
         check_interval_minutes AS "checkIntervalMinutes",
         log_retention_days AS "logRetentionDays",
         check_retention_days AS "checkRetentionDays",
         evaluation_retention_days AS "evaluationRetentionDays",
         incident_error_rate_threshold_pct::float8 AS "incidentErrorRateThresholdPct",
         incident_latency_p95_threshold_ms AS "incidentLatencyP95ThresholdMs",
         incident_consecutive_failures AS "incidentConsecutiveFailures",
         updated_at AS "updatedAt"`,
      [
        data.monitorEnabled,
        data.checkIntervalMinutes,
        data.logRetentionDays,
        data.checkRetentionDays,
        data.evaluationRetentionDays,
        data.incidentErrorRateThresholdPct,
        data.incidentLatencyP95ThresholdMs,
        data.incidentConsecutiveFailures,
        identity.id,
      ],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'settings',
      entityId: 'default',
      action: 'updated',
      summary: `Frecuencia ${data.checkIntervalMinutes} min; retención ${data.logRetentionDays}/${data.checkRetentionDays}/${data.evaluationRetentionDays} días`,
      changes: data,
    })
    return row
  })
}

export async function queryLogsPage(
  pool: Pool,
  identity: SessionIdentity,
  filters: {
    id?: string
    excludeSynthetic?: boolean
    runtimeEnvironment: ObservabilityEnvironment
    environment?: ObservabilityEnvironment
    category: 'all' | 'operational' | 'error' | 'audit' | 'test_result' | 'client_telemetry'
    from: string | null
    to: string | null
    module?: string
    service?: string
    operation?: string
    severity?: string
    outcome?: string
    correlationId?: string
    search?: string
    page: number
    pageSize: number
  },
): Promise<{ total: number; page: number; pageSize: number; items: LogRecordItem[] }> {
  return adminTx(pool, identity, async (client) => {
    const offset = (filters.page - 1) * filters.pageSize
    const params: unknown[] = []
    const push = (v: unknown) => {
      params.push(v)
      return `$${params.length}`
    }

    const pEnv = push(filters.environment ?? null)
    const pFrom = push(filters.from)
    const pTo = push(filters.to)
    const pModule = push(filters.module ?? null)
    const pService = push(filters.service ?? null)
    const pOperation = push(filters.operation ?? null)
    const pSeverity = push(filters.severity ?? null)
    const pOutcome = push(filters.outcome ?? null)
    const pCorr = push(filters.correlationId ?? null)
    const pSearch = push(filters.search ?? null)
    const pCategory = push(filters.category)
    const pId = push(filters.id ?? null)
    const pExcludeSynthetic = push(filters.excludeSynthetic ?? false)
    const pRuntimeEnv = push(filters.runtimeEnvironment)
    const pLimit = push(filters.pageSize)
    const pOffset = push(offset)

    const sql = `
      WITH unified AS (
        SELECT
          l.id::text AS id,
          CASE
            WHEN l.source = 'client_telemetry' THEN 'client_telemetry'
            WHEN l.source = 'error' OR l.severity IN ('error', 'critical') THEN 'error'
            ELSE 'operational'
          END AS category,
          l.correlation_id AS "correlationId",
          l.occurred_at AS "occurredAt",
          l.environment,
          l.service,
          l.module,
          l.source,
          l.event_type AS "eventType",
          l.severity,
          l.operation,
          l.normalized_path AS "normalizedPath",
          l.http_method AS "httpMethod",
          l.status_code AS "statusCode",
          l.duration_ms::float8 AS "durationMs",
          l.outcome,
          l.error_code AS "errorCode",
          l.error_message AS "errorMessage",
          l.system_version AS "systemVersion",
          l.metadata
        FROM private.observability_logs l
        WHERE ${pCategory} IN ('all', 'operational', 'error', 'client_telemetry')
          AND (${pId}::uuid IS NULL OR l.id = ${pId}::uuid)
          AND (NOT ${pExcludeSynthetic}::boolean OR l.metadata->'synthetic' IS DISTINCT FROM 'true'::jsonb)

        UNION ALL

        SELECT
          c.id::text AS id,
          'test_result' AS category,
          c.correlation_id AS "correlationId",
          c.executed_at AS "occurredAt",
          c.environment,
          c.service,
          c.module,
          'automated_check' AS source,
          c.check_kind AS "eventType",
          CASE WHEN c.status = 'failed' THEN 'error' WHEN c.status = 'not_executed' THEN 'warn' ELSE 'info' END AS severity,
          c.check_name AS operation,
          c.target AS "normalizedPath",
          NULL::text AS "httpMethod",
          c.http_status AS "statusCode",
          c.duration_ms::float8 AS "durationMs",
          CASE WHEN c.status = 'passed' THEN 'success' WHEN c.status = 'failed' THEN 'server_error' ELSE 'info' END AS outcome,
          c.error_code AS "errorCode",
          c.error_message AS "errorMessage",
          NULL::text AS "systemVersion",
          jsonb_build_object(
            'checkKey', c.check_key,
            'status', c.status,
            'expectedResult', c.expected_result,
            'actualResult', c.actual_result,
            'runId', c.run_id
          ) AS metadata
        FROM private.observability_check_results c
        WHERE ${pCategory} IN ('all', 'test_result')
          AND (${pId}::uuid IS NULL OR c.id = ${pId}::uuid)

        UNION ALL

        SELECT
          a.id::text AS id,
          'audit' AS category,
          a.entity_id AS "correlationId",
          a.created_at AS "occurredAt",
          ${pRuntimeEnv}::text AS environment,
          'admin' AS service,
          'observability' AS module,
          'admin_audit' AS source,
          a.entity_type || '.' || a.action AS "eventType",
          'info' AS severity,
          a.summary AS operation,
          NULL::text AS "normalizedPath",
          NULL::text AS "httpMethod",
          NULL::integer AS "statusCode",
          NULL::float8 AS "durationMs",
          'info' AS outcome,
          NULL::text AS "errorCode",
          NULL::text AS "errorMessage",
          NULL::text AS "systemVersion",
          jsonb_build_object('action', a.action, 'entityType', a.entity_type) AS metadata
        FROM private.observability_audit_log a
        WHERE ${pCategory} IN ('all', 'audit')
          AND (${pId}::uuid IS NULL OR a.id = ${pId}::uuid)

        UNION ALL

        SELECT
          ae.id::text AS id,
          'audit' AS category,
          ae.id::text AS "correlationId",
          ae.created_at AS "occurredAt",
          ${pRuntimeEnv}::text AS environment,
          'auth' AS service,
          'auth' AS module,
          'access_audit' AS source,
          'access.' || ae.action AS "eventType",
          'info' AS severity,
          ae.action AS operation,
          NULL::text AS "normalizedPath",
          NULL::text AS "httpMethod",
          NULL::integer AS "statusCode",
          NULL::float8 AS "durationMs",
          'info' AS outcome,
          NULL::text AS "errorCode",
          NULL::text AS "errorMessage",
          NULL::text AS "systemVersion",
          '{}'::jsonb AS metadata
        FROM private.observability_access_event_logs(${pFrom}::timestamptz, ${pTo}::timestamptz, ${pId}::uuid) ae
        WHERE ${pCategory} IN ('all', 'audit')
      ),
      filtered AS (
        SELECT *
        FROM unified u
        WHERE (${pCategory} = 'all' OR u.category = ${pCategory})
          AND (${pEnv}::text IS NULL OR u.environment = ${pEnv})
          AND (${pFrom}::timestamptz IS NULL OR u."occurredAt" >= ${pFrom}::timestamptz)
          AND (${pTo}::timestamptz IS NULL OR u."occurredAt" <= ${pTo}::timestamptz)
          AND (${pModule}::text IS NULL OR u.module = ${pModule})
          AND (${pService}::text IS NULL OR u.service = ${pService})
          AND (${pSeverity}::text IS NULL OR u.severity = ${pSeverity})
          AND (${pOutcome}::text IS NULL OR u.outcome = ${pOutcome})
          AND (${pCorr}::text IS NULL OR u."correlationId" = ${pCorr})
          AND (${pOperation}::text IS NULL OR u.operation ILIKE ('%' || ${pOperation} || '%'))
          AND (
            ${pSearch}::text IS NULL
            OR u.operation ILIKE ('%' || ${pSearch} || '%')
            OR COALESCE(u."normalizedPath", '') ILIKE ('%' || ${pSearch} || '%')
            OR COALESCE(u."errorMessage", '') ILIKE ('%' || ${pSearch} || '%')
            OR COALESCE(u."errorCode", '') ILIKE ('%' || ${pSearch} || '%')
            OR u."correlationId" ILIKE ('%' || ${pSearch} || '%')
          )
      )
      SELECT (SELECT count(*)::int FROM filtered) AS total,
        COALESCE(jsonb_agg(to_jsonb(paged) ORDER BY paged."occurredAt" DESC, paged.id DESC), '[]'::jsonb) AS items
      FROM (
        SELECT * FROM filtered
        ORDER BY "occurredAt" DESC, id DESC
        LIMIT ${pLimit} OFFSET ${pOffset}
      ) paged
    `

    const { rows: [result] } = await client.query<{ total: number; items: LogRecordItem[] }>(
      sql,
      params,
    )
    return { ...result, page: filters.page, pageSize: filters.pageSize }
  })
}

export async function getLogDetailAndCorrelation(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  runtimeEnvironment: ObservabilityEnvironment,
): Promise<{ item: LogRecordItem; related: LogRecordItem[] }> {
  const { items: [item] } = await queryLogsPage(pool, identity, {
    category: 'all',
    id,
    runtimeEnvironment,
    from: null,
    to: null,
    page: 1,
    pageSize: 1,
  })
  if (!item) {
    throw new AuthError(404, 'LOG_NOT_FOUND', 'El registro solicitado no existe.')
  }
  const related = await queryLogsPage(pool, identity, {
    category: 'all',
    runtimeEnvironment,
    environment: item.environment,
    from: null,
    to: null,
    correlationId: item.correlationId,
    page: 1,
    pageSize: 50,
  })
  return { item, related: related.items }
}

export async function listSlis(
  pool: Pool,
  identity: SessionIdentity,
): Promise<SliDefinition[]> {
  return adminTx(pool, identity, async (client) => {
    const { rows } = await client.query<SliDefinition>(
      `SELECT
         id, code, current_version AS "currentVersion", name, description,
         service, characteristic, data_source AS "dataSource",
         indicator_type AS "indicatorType", unit,
         calculation_method AS "calculationMethod",
         inclusion_criteria AS "inclusionCriteria",
         exclusion_criteria AS "exclusionCriteria",
         evaluation_period AS "evaluationPeriod",
         is_active AS "isActive",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM private.observability_sli_definitions
       ORDER BY is_active DESC, name ASC`,
    )
    return rows
  })
}

export async function createSli(
  pool: Pool,
  identity: SessionIdentity,
  input: {
    code: string
    name: string
    description: string
    service: string
    characteristic: string
    dataSource: string
    indicatorType: string
    unit: string
    calculationMethod: SliCalculationMethod
    inclusionCriteria: string
    exclusionCriteria: string
    evaluationPeriod: string
    isActive: boolean
    changeReason: string | null
  },
): Promise<SliDefinition> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [row],
    } = await client.query<SliDefinition>(
      `INSERT INTO private.observability_sli_definitions (
         code, current_version, name, description, service, characteristic, data_source,
         indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria,
         evaluation_period, is_active, created_by, updated_by
       )
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $14)
       RETURNING
         id, code, current_version AS "currentVersion", name, description,
         service, characteristic, data_source AS "dataSource",
         indicator_type AS "indicatorType", unit,
         calculation_method AS "calculationMethod",
         inclusion_criteria AS "inclusionCriteria",
         exclusion_criteria AS "exclusionCriteria",
         evaluation_period AS "evaluationPeriod",
         is_active AS "isActive",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        input.code,
        input.name,
        input.description,
        input.service,
        input.characteristic,
        input.dataSource,
        input.indicatorType,
        input.unit,
        JSON.stringify(input.calculationMethod),
        input.inclusionCriteria,
        input.exclusionCriteria,
        input.evaluationPeriod,
        input.isActive,
        identity.id,
      ],
    )
    await client.query(
      `INSERT INTO private.observability_sli_versions (sli_id, version, snapshot, changed_by, change_reason)
       VALUES ($1, 1, $2::jsonb, $3, $4)`,
      [
        row.id,
        JSON.stringify(row),
        identity.id,
        input.changeReason ?? 'Creación de SLI',
      ],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'sli',
      entityId: row.id,
      action: 'created',
      summary: `SLI creado: ${row.name} (${row.code})`,
      changes: { code: row.code, version: 1 },
    })
    return row
  })
}

export async function updateSli(
  pool: Pool,
  identity: SessionIdentity,
  sliId: string,
  input: {
    name: string
    description: string
    service: string
    characteristic: string
    dataSource: string
    indicatorType: string
    unit: string
    calculationMethod: SliCalculationMethod
    inclusionCriteria: string
    exclusionCriteria: string
    evaluationPeriod: string
    isActive: boolean
    changeReason: string | null
  },
): Promise<SliDefinition> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [existing],
    } = await client.query<{ id: string; current_version: number }>(
      'SELECT id, current_version FROM private.observability_sli_definitions WHERE id = $1 FOR UPDATE',
      [sliId],
    )
    if (!existing) {
      throw new AuthError(404, 'SLI_NOT_FOUND', 'El SLI solicitado no existe.')
    }
    const nextVersion = existing.current_version + 1
    const {
      rows: [row],
    } = await client.query<SliDefinition>(
      `UPDATE private.observability_sli_definitions
       SET current_version = $2, name = $3, description = $4, service = $5,
           characteristic = $6, data_source = $7, indicator_type = $8, unit = $9,
           calculation_method = $10::jsonb, inclusion_criteria = $11,
           exclusion_criteria = $12, evaluation_period = $13, is_active = $14,
           updated_by = $15, updated_at = date_trunc('milliseconds', clock_timestamp())
       WHERE id = $1
       RETURNING
         id, code, current_version AS "currentVersion", name, description,
         service, characteristic, data_source AS "dataSource",
         indicator_type AS "indicatorType", unit,
         calculation_method AS "calculationMethod",
         inclusion_criteria AS "inclusionCriteria",
         exclusion_criteria AS "exclusionCriteria",
         evaluation_period AS "evaluationPeriod",
         is_active AS "isActive",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        sliId,
        nextVersion,
        input.name,
        input.description,
        input.service,
        input.characteristic,
        input.dataSource,
        input.indicatorType,
        input.unit,
        JSON.stringify(input.calculationMethod),
        input.inclusionCriteria,
        input.exclusionCriteria,
        input.evaluationPeriod,
        input.isActive,
        identity.id,
      ],
    )
    await client.query(
      'UPDATE private.observability_sli_versions SET effective_to = $3::timestamptz WHERE sli_id = $1 AND version = $2',
      [sliId, existing.current_version, row.updatedAt],
    )
    await client.query(
      `INSERT INTO private.observability_sli_versions (sli_id, version, snapshot, effective_from, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4::timestamptz, $5, $6)`,
      [
        row.id,
        nextVersion,
        JSON.stringify(row),
        row.updatedAt,
        identity.id,
        input.changeReason ?? 'Actualización de SLI',
      ],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'sli',
      entityId: row.id,
      action: 'updated',
      summary: `SLI actualizado: ${row.name} (v${nextVersion})`,
      changes: { version: nextVersion, reason: input.changeReason },
    })
    return row
  })
}

export async function setSliActiveStatus(
  pool: Pool,
  identity: SessionIdentity,
  sliId: string,
  active: boolean,
  reason: string | null,
): Promise<SliDefinition> {
  return adminTx(pool, identity, async (client) => {
    const { rows: [current] } = await client.query<{
      currentVersion: number
      isActive: boolean
    }>(
      'SELECT current_version AS "currentVersion", is_active AS "isActive" FROM private.observability_sli_definitions WHERE id = $1 FOR UPDATE',
      [sliId],
    )
    if (!current) {
      throw new AuthError(404, 'SLI_NOT_FOUND', 'El SLI solicitado no existe.')
    }
    const {
      rows: [row],
    } = await client.query<SliDefinition>(
      `UPDATE private.observability_sli_definitions
       SET is_active = $2, updated_by = $3,
           updated_at = CASE WHEN is_active <> $2 THEN date_trunc('milliseconds', clock_timestamp()) ELSE updated_at END,
           current_version = current_version + CASE WHEN is_active <> $2 THEN 1 ELSE 0 END
       WHERE id = $1
       RETURNING
         id, code, current_version AS "currentVersion", name, description,
         service, characteristic, data_source AS "dataSource",
         indicator_type AS "indicatorType", unit,
         calculation_method AS "calculationMethod",
         inclusion_criteria AS "inclusionCriteria",
         exclusion_criteria AS "exclusionCriteria",
         evaluation_period AS "evaluationPeriod",
         is_active AS "isActive",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [sliId, active, identity.id],
    )
    if (current.isActive === active) return row
    await client.query(
      'UPDATE private.observability_sli_versions SET effective_to = $3::timestamptz WHERE sli_id = $1 AND version = $2',
      [sliId, current.currentVersion, row.updatedAt],
    )
    await client.query(
      `INSERT INTO private.observability_sli_versions (sli_id, version, snapshot, effective_from, changed_by, change_reason)
       VALUES ($1, $2, $3::jsonb, $4::timestamptz, $5, $6)`,
      [sliId, row.currentVersion, JSON.stringify(row), row.updatedAt, identity.id, reason ?? 'Cambio de estado'],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'sli',
      entityId: row.id,
      action: 'status_changed',
      summary: `SLI ${row.name} marcado como ${active ? 'activo' : 'inactivo'}`,
      changes: { isActive: active, version: row.currentVersion, reason },
    })
    return row
  })
}

export async function listSliVersions(
  pool: Pool,
  identity: SessionIdentity,
  sliId: string,
): Promise<SliVersionRecord[]> {
  return adminTx(pool, identity, async (client) => {
    const { rows } = await client.query<SliVersionRecord>(
      `SELECT
         v.id, v.sli_id AS "sliId", v.version, v.snapshot,
         v.effective_from AS "effectiveFrom", v.effective_to AS "effectiveTo",
         v.changed_by AS "changedBy", u.username AS "changedByUsername",
         v.change_reason AS "changeReason", v.created_at AS "createdAt"
       FROM private.observability_sli_versions v
       LEFT JOIN private.users u ON u.id = v.changed_by
       WHERE v.sli_id = $1
       ORDER BY v.version DESC`,
      [sliId],
    )
    return rows
  })
}

export async function listSlos(
  pool: Pool,
  identity: SessionIdentity,
): Promise<SloDefinition[]> {
  return adminTx(pool, identity, async (client) => {
    const { rows } = await client.query<SloDefinition>(
      `SELECT
         o.id, o.code, o.sli_id AS "sliId", s.code AS "sliCode", s.name AS "sliName",
         o.current_version AS "currentVersion", o.name, o.description,
         o.target_value::float8 AS "targetValue",
         o.comparison_operator AS "comparisonOperator",
         o.unit, o.evaluation_period AS "evaluationPeriod",
         o.min_samples AS "minSamples",
         o.effective_from AS "effectiveFrom", o.effective_to AS "effectiveTo",
         o.status, o.is_contractual AS "isContractual",
         o.created_at AS "createdAt", o.updated_at AS "updatedAt"
       FROM private.observability_slo_definitions o
       JOIN private.observability_sli_definitions s ON s.id = o.sli_id
       ORDER BY o.status ASC, o.name ASC`,
    )
    return rows
  })
}

export async function createSlo(
  pool: Pool,
  identity: SessionIdentity,
  input: {
    code: string
    sliId: string
    name: string
    description: string
    targetValue: number
    comparisonOperator: string
    unit: string
    evaluationPeriod: string
    minSamples: number
    effectiveFrom: string
    effectiveTo: string | null
    status: string
    isContractual: false
    changeReason: string | null
  },
): Promise<SloDefinition> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [sli],
    } = await client.query<{ current_version: number }>(
      'SELECT current_version FROM private.observability_sli_definitions WHERE id = $1',
      [input.sliId],
    )
    if (!sli) {
      throw new AuthError(404, 'SLI_NOT_FOUND', 'El SLI asociado no existe.')
    }
    const {
      rows: [row],
    } = await client.query<SloDefinition>(
      `INSERT INTO private.observability_slo_definitions (
         code, sli_id, current_version, name, description, target_value,
         comparison_operator, unit, evaluation_period, min_samples,
         effective_from, effective_to, status, is_contractual, created_by, updated_by
       )
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz, $12, false, $13, $13)
       RETURNING
         id, code, sli_id AS "sliId", current_version AS "currentVersion", name, description,
         target_value::float8 AS "targetValue",
         comparison_operator AS "comparisonOperator",
         unit, evaluation_period AS "evaluationPeriod",
         min_samples AS "minSamples",
         effective_from AS "effectiveFrom", effective_to AS "effectiveTo",
         status, is_contractual AS "isContractual",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        input.code,
        input.sliId,
        input.name,
        input.description,
        input.targetValue,
        input.comparisonOperator,
        input.unit,
        input.evaluationPeriod,
        input.minSamples,
        input.effectiveFrom,
        input.effectiveTo,
        input.status,
        identity.id,
      ],
    )
    await client.query(
      `INSERT INTO private.observability_slo_versions (
         slo_id, version, sli_version, target_value, comparison_operator,
         unit, evaluation_period, min_samples, effective_from, effective_to,
         snapshot, changed_by, change_reason
       )
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10::jsonb, $11, $12)`,
      [
        row.id,
        sli.current_version,
        row.targetValue,
        row.comparisonOperator,
        row.unit,
        row.evaluationPeriod,
        row.minSamples,
        row.effectiveFrom,
        row.effectiveTo,
        JSON.stringify(row),
        identity.id,
        input.changeReason ?? 'Creación de SLO interno',
      ],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'slo',
      entityId: row.id,
      action: 'created',
      summary: `SLO creado: ${row.name} (${row.comparisonOperator} ${row.targetValue} ${row.unit})`,
      changes: { code: row.code, version: 1 },
    })
    return row
  })
}

async function closeSloVersions(client: PoolClient, sloId: string, effectiveFrom: string) {
  await client.query(
    `UPDATE private.observability_slo_versions
     SET effective_to = GREATEST(effective_from, $2::timestamptz)
     WHERE slo_id = $1 AND (effective_to IS NULL OR effective_to > $2::timestamptz)`,
    [sloId, effectiveFrom],
  )
}

export async function updateSlo(
  pool: Pool,
  identity: SessionIdentity,
  sloId: string,
  input: {
    sliId: string
    name: string
    description: string
    targetValue: number
    comparisonOperator: string
    unit: string
    evaluationPeriod: string
    minSamples: number
    effectiveFrom: string
    effectiveTo: string | null
    status: string
    changeReason: string | null
  },
): Promise<SloDefinition> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [existing],
    } = await client.query<{ id: string; current_version: number }>(
      'SELECT id, current_version FROM private.observability_slo_definitions WHERE id = $1 FOR UPDATE',
      [sloId],
    )
    if (!existing) {
      throw new AuthError(404, 'SLO_NOT_FOUND', 'El SLO solicitado no existe.')
    }
    const {
      rows: [sli],
    } = await client.query<{ current_version: number }>(
      'SELECT current_version FROM private.observability_sli_definitions WHERE id = $1',
      [input.sliId],
    )
    if (!sli) {
      throw new AuthError(404, 'SLI_NOT_FOUND', 'El SLI asociado no existe.')
    }

    const nextVersion = existing.current_version + 1
    const effectiveFrom = new Date(Math.max(Date.now(), Date.parse(input.effectiveFrom))).toISOString()
    if (input.effectiveTo && Date.parse(input.effectiveTo) <= Date.parse(effectiveFrom)) {
      throw new AuthError(400, 'INVALID_OBSERVABILITY_INPUT', 'El fin de vigencia debe ser posterior a la aplicación del cambio.')
    }
    await closeSloVersions(client, sloId, effectiveFrom)
    const {
      rows: [row],
    } = await client.query<SloDefinition>(
      `UPDATE private.observability_slo_definitions
       SET sli_id = $2, current_version = $3, name = $4, description = $5,
           target_value = $6, comparison_operator = $7, unit = $8,
           evaluation_period = $9, min_samples = $10, effective_from = $11::timestamptz,
           effective_to = $12::timestamptz, status = $13, updated_by = $14,
           updated_at = clock_timestamp()
       WHERE id = $1
       RETURNING
         id, code, sli_id AS "sliId", current_version AS "currentVersion", name, description,
         target_value::float8 AS "targetValue",
         comparison_operator AS "comparisonOperator",
         unit, evaluation_period AS "evaluationPeriod",
         min_samples AS "minSamples",
         effective_from AS "effectiveFrom", effective_to AS "effectiveTo",
         status, is_contractual AS "isContractual",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        sloId,
        input.sliId,
        nextVersion,
        input.name,
        input.description,
        input.targetValue,
        input.comparisonOperator,
        input.unit,
        input.evaluationPeriod,
        input.minSamples,
        effectiveFrom,
        input.effectiveTo,
        input.status,
        identity.id,
      ],
    )
    await client.query(
      `INSERT INTO private.observability_slo_versions (
         slo_id, version, sli_version, target_value, comparison_operator,
         unit, evaluation_period, min_samples, effective_from, effective_to,
         snapshot, changed_by, change_reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11::jsonb, $12, $13)`,
      [
        row.id,
        nextVersion,
        sli.current_version,
        row.targetValue,
        row.comparisonOperator,
        row.unit,
        row.evaluationPeriod,
        row.minSamples,
        row.effectiveFrom,
        row.effectiveTo,
        JSON.stringify(row),
        identity.id,
        input.changeReason ?? 'Actualización de objetivo SLO',
      ],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'slo',
      entityId: row.id,
      action: 'updated',
      summary: `SLO actualizado: ${row.name} (v${nextVersion}: ${row.comparisonOperator} ${row.targetValue} ${row.unit})`,
      changes: { version: nextVersion, reason: input.changeReason },
    })
    return row
  })
}

export async function setSloStatus(
  pool: Pool,
  identity: SessionIdentity,
  sloId: string,
  active: boolean,
  reason: string | null,
): Promise<SloDefinition> {
  return adminTx(pool, identity, async (client) => {
    const status = active ? 'active' : 'inactive'
    const { rows: [current] } = await client.query<{ status: string; sliVersion: number }>(
      `SELECT o.status, s.current_version AS "sliVersion"
       FROM private.observability_slo_definitions o
       JOIN private.observability_sli_definitions s ON s.id = o.sli_id
       WHERE o.id = $1 FOR UPDATE OF o`,
      [sloId],
    )
    if (!current) {
      throw new AuthError(404, 'SLO_NOT_FOUND', 'El SLO solicitado no existe.')
    }
    const effectiveFrom = new Date().toISOString()
    if (current.status !== status) await closeSloVersions(client, sloId, effectiveFrom)
    const {
      rows: [row],
    } = await client.query<SloDefinition>(
      `UPDATE private.observability_slo_definitions
       SET status = $2, updated_by = $3,
           current_version = current_version + CASE WHEN status <> $2 THEN 1 ELSE 0 END,
           updated_at = CASE WHEN status <> $2 THEN $4::timestamptz ELSE updated_at END,
           effective_from = CASE WHEN status <> $2 AND effective_from < $4::timestamptz
             AND (effective_to IS NULL OR effective_to > $4::timestamptz)
             THEN $4::timestamptz ELSE effective_from END
       WHERE id = $1
       RETURNING
         id, code, sli_id AS "sliId", current_version AS "currentVersion", name, description,
         target_value::float8 AS "targetValue",
         comparison_operator AS "comparisonOperator",
         unit, evaluation_period AS "evaluationPeriod",
         min_samples AS "minSamples",
         effective_from AS "effectiveFrom", effective_to AS "effectiveTo",
         status, is_contractual AS "isContractual",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [sloId, status, identity.id, effectiveFrom],
    )
    if (current.status === status) return row
    await client.query(
      `INSERT INTO private.observability_slo_versions (
         slo_id, version, sli_version, target_value, comparison_operator, unit,
         evaluation_period, min_samples, effective_from, effective_to, snapshot, changed_by, change_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)`,
      [row.id, row.currentVersion, current.sliVersion, row.targetValue, row.comparisonOperator,
        row.unit, row.evaluationPeriod, row.minSamples, row.effectiveFrom, row.effectiveTo,
        JSON.stringify(row), identity.id, reason ?? 'Cambio de estado'],
    )
    await recordAuditEntry(client, identity.id, {
      entityType: 'slo',
      entityId: row.id,
      action: 'status_changed',
      summary: `SLO ${row.name} cambiado a ${status}`,
      changes: { status, version: row.currentVersion, reason },
    })
    return row
  })
}

export async function listSloHistory(
  pool: Pool,
  identity: SessionIdentity,
  sloId: string,
  environment: ObservabilityEnvironment,
): Promise<{ versions: SloVersionRecord[]; evaluations: SloEvaluationRecord[] }> {
  return adminTx(pool, identity, async (client) => {
    const [versionsRes, evalsRes] = await Promise.all([
      client.query<SloVersionRecord>(
        `SELECT
           v.id, v.slo_id AS "sloId", v.version, v.sli_version AS "sliVersion",
           v.target_value::float8 AS "targetValue",
           v.comparison_operator AS "comparisonOperator",
           v.unit, v.evaluation_period AS "evaluationPeriod",
           v.min_samples AS "minSamples",
           v.effective_from AS "effectiveFrom", v.effective_to AS "effectiveTo",
           u.username AS "changedByUsername", v.change_reason AS "changeReason",
           v.created_at AS "createdAt"
         FROM private.observability_slo_versions v
         LEFT JOIN private.users u ON u.id = v.changed_by
         WHERE v.slo_id = $1
         ORDER BY v.version DESC`,
        [sloId],
      ),
      client.query<SloEvaluationRecord>(
        `SELECT
           id, slo_id AS "sloId", slo_version AS "sloVersion", environment,
           period_start AS "periodStart", period_end AS "periodEnd",
           target_value::float8 AS "targetValue",
           observed_value::float8 AS "observedValue",
           delta_value::float8 AS "deltaValue",
           samples, not_executed_count AS "notExecutedCount",
           compliance_status AS "complianceStatus",
           error_budget_total::float8 AS "errorBudgetTotal",
           error_budget_consumed::float8 AS "errorBudgetConsumed",
           error_budget_remaining_pct::float8 AS "errorBudgetRemainingPct",
           notes, evaluated_at AS "evaluatedAt"
         FROM private.observability_slo_evaluations
         WHERE slo_id = $1 AND environment = $2
         ORDER BY evaluated_at DESC
         LIMIT 100`,
        [sloId, environment],
      ),
    ])
    return { versions: versionsRes.rows, evaluations: evalsRes.rows }
  })
}

export async function listSlas(
  pool: Pool,
  identity: SessionIdentity,
): Promise<Array<Omit<SlaAgreement, 'slos' | 'observedCompliance'>>> {
  return adminTx(pool, identity, async (client) => {
    const { rows } = await client.query<
      Omit<SlaAgreement, 'slos' | 'observedCompliance'>
    >(
      `SELECT
         s.id, s.name, s.covered_service AS "coveredService", s.commitments,
         s.approval_status AS "approvalStatus",
         s.effective_from AS "effectiveFrom", s.effective_to AS "effectiveTo",
         s.responsibilities, s.exclusions,
         s.breach_consequences AS "breachConsequences",
         s.is_active AS "isActive",
         s.created_at AS "createdAt", s.updated_at AS "updatedAt",
         COALESCE((
           SELECT array_agg(l.slo_id ORDER BY l.slo_id)
           FROM private.observability_sla_slos l
           WHERE l.sla_id = s.id
         ), ARRAY[]::uuid[]) AS "sloIds"
       FROM private.observability_slas s
       ORDER BY s.is_active DESC, s.created_at DESC`,
    )
    return rows
  })
}

export async function createSla(
  pool: Pool,
  identity: SessionIdentity,
  input: {
    name: string
    coveredService: string
    commitments: string
    approvalStatus: string
    effectiveFrom: string
    effectiveTo: string | null
    responsibilities: string
    exclusions: string
    breachConsequences: string | null
    isActive: boolean
    sloIds: string[]
  },
): Promise<string> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [row],
    } = await client.query<{ id: string }>(
      `INSERT INTO private.observability_slas (
         name, covered_service, commitments, approval_status, effective_from,
         effective_to, responsibilities, exclusions, breach_consequences,
         is_active, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10, $11, $11)
       RETURNING id`,
      [
        input.name,
        input.coveredService,
        input.commitments,
        input.approvalStatus,
        input.effectiveFrom,
        input.effectiveTo,
        input.responsibilities,
        input.exclusions,
        input.breachConsequences,
        input.isActive,
        identity.id,
      ],
    )
    for (const sloId of input.sloIds) {
      await client.query(
        'INSERT INTO private.observability_sla_slos (sla_id, slo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [row.id, sloId],
      )
    }
    await recordAuditEntry(client, identity.id, {
      entityType: 'sla',
      entityId: row.id,
      action: 'created',
      summary: `SLA registrado: ${input.name} (${input.approvalStatus})`,
      changes: { coveredService: input.coveredService, sloCount: input.sloIds.length },
    })
    return row.id
  })
}

export async function updateSla(
  pool: Pool,
  identity: SessionIdentity,
  slaId: string,
  input: {
    name: string
    coveredService: string
    commitments: string
    approvalStatus: string
    effectiveFrom: string
    effectiveTo: string | null
    responsibilities: string
    exclusions: string
    breachConsequences: string | null
    isActive: boolean
    sloIds: string[]
  },
): Promise<void> {
  await adminTx(pool, identity, async (client) => {
    const { rowCount } = await client.query(
      `UPDATE private.observability_slas
       SET name = $2, covered_service = $3, commitments = $4, approval_status = $5,
           effective_from = $6::timestamptz, effective_to = $7::timestamptz,
           responsibilities = $8, exclusions = $9, breach_consequences = $10,
           is_active = $11, updated_by = $12, updated_at = clock_timestamp()
       WHERE id = $1`,
      [
        slaId,
        input.name,
        input.coveredService,
        input.commitments,
        input.approvalStatus,
        input.effectiveFrom,
        input.effectiveTo,
        input.responsibilities,
        input.exclusions,
        input.breachConsequences,
        input.isActive,
        identity.id,
      ],
    )
    if (!rowCount) {
      throw new AuthError(404, 'SLA_NOT_FOUND', 'El acuerdo SLA no existe.')
    }
    await client.query(
      'DELETE FROM private.observability_sla_slos WHERE sla_id = $1',
      [slaId],
    )
    for (const sloId of input.sloIds) {
      await client.query(
        'INSERT INTO private.observability_sla_slos (sla_id, slo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [slaId, sloId],
      )
    }
    await recordAuditEntry(client, identity.id, {
      entityType: 'sla',
      entityId: slaId,
      action: 'updated',
      summary: `SLA actualizado: ${input.name}`,
      changes: { approvalStatus: input.approvalStatus, sloCount: input.sloIds.length },
    })
  })
}

export async function setSlaActiveStatus(
  pool: Pool,
  identity: SessionIdentity,
  slaId: string,
  active: boolean,
  reason: string | null,
): Promise<void> {
  await adminTx(pool, identity, async (client) => {
    const { rowCount } = await client.query(
      'UPDATE private.observability_slas SET is_active = $2, updated_by = $3, updated_at = clock_timestamp() WHERE id = $1',
      [slaId, active, identity.id],
    )
    if (!rowCount) {
      throw new AuthError(404, 'SLA_NOT_FOUND', 'El acuerdo SLA no existe.')
    }
    await recordAuditEntry(client, identity.id, {
      entityType: 'sla',
      entityId: slaId,
      action: 'status_changed',
      summary: `SLA marcado como ${active ? 'activo' : 'inactivo'}`,
      changes: { isActive: active, reason },
    })
  })
}

export async function listTestRunsAndResults(
  pool: Pool,
  identity: SessionIdentity,
  environment: ObservabilityEnvironment,
  from: string,
  to: string,
  page: number,
  pageSize: number,
  runId?: string,
  service?: string,
  module?: string,
): Promise<{ runs: CheckRunRecord[]; latestChecks: CheckResultRecord[]; totalRuns: number }> {
  return adminTx(pool, identity, async (client) => {
    const conditions = `r.environment = $1 AND r.started_at BETWEEN $2::timestamptz AND $3::timestamptz
      AND (($4::text IS NULL AND $5::text IS NULL) OR EXISTS (
        SELECT 1 FROM private.observability_check_results c WHERE c.run_id = r.id
          AND ($4::text IS NULL OR c.service = $4) AND ($5::text IS NULL OR c.module = $5)
      ))`
    const [runsRes, totalsRes] = await Promise.all([
      client.query<CheckRunRecord>(
        `SELECT
           id, external_run_id AS "externalRunId", category, environment,
           trigger_source AS "triggerSource", status,
           started_at AS "startedAt", finished_at AS "finishedAt",
           duration_ms::float8 AS "durationMs",
           total_checks AS "totalChecks", passed_checks AS "passedChecks",
           failed_checks AS "failedChecks", not_executed_checks AS "notExecutedChecks",
           skipped_checks AS "skippedChecks", commit_sha AS "commitSha", notes
         FROM private.observability_test_runs r
         WHERE ${conditions}
         ORDER BY started_at DESC, id DESC
         LIMIT $6 OFFSET $7`,
        [environment, from, to, service ?? null, module ?? null, pageSize, (page - 1) * pageSize],
      ),
      client.query<{ total: number }>(
        `SELECT count(*)::int AS total FROM private.observability_test_runs r WHERE ${conditions}`,
        [environment, from, to, service ?? null, module ?? null],
      ),
    ])
    const runs = runsRes.rows
    const { rows: latestChecks } = await client.query<CheckResultRecord>(
        `SELECT ${runId ? '' : 'DISTINCT ON (check_key)'}
           id, run_id AS "runId", correlation_id AS "correlationId",
           check_key AS "checkKey", check_name AS "checkName", check_kind AS "checkKind",
           service, module, environment, target, phase,
           executed_at AS "executedAt", expected_result AS "expectedResult",
           actual_result AS "actualResult", status,
           duration_ms::float8 AS "durationMs", http_status AS "httpStatus",
           error_code AS "errorCode", error_message AS "errorMessage", assertions
         FROM private.observability_check_results
         WHERE environment = $1
           AND (($2::uuid IS NOT NULL AND run_id = $2::uuid)
             OR ($2::uuid IS NULL AND executed_at BETWEEN $3::timestamptz AND $4::timestamptz))
           AND ($5::text IS NULL OR service = $5)
           AND ($6::text IS NULL OR module = $6)
         ORDER BY ${runId ? '' : 'check_key,'} executed_at DESC, id DESC
         LIMIT 500`,
      [environment, runId ?? null, from, to, service ?? null, module ?? null],
    )
    return { runs, latestChecks, totalRuns: totalsRes.rows[0].total }
  })
}

export async function listIncidents(
  pool: Pool,
  identity: SessionIdentity,
  filters: {
    environment?: ObservabilityEnvironment
    status?: IncidentStatus
    from?: string
    to?: string
    service?: string
  },
): Promise<IncidentRecord[]> {
  return adminTx(pool, identity, async (client) => {
    const { rows } = await client.query<IncidentRecord>(
      `SELECT
         i.id, i.dedupe_key AS "dedupeKey", i.environment, i.service,
         i.incident_type AS "incidentType", i.severity, i.status, i.title, i.summary,
         i.started_at AS "startedAt", i.last_seen_at AS "lastSeenAt",
         i.resolved_at AS "resolvedAt", i.recovery_duration_s::float8 AS "recoveryDurationS",
         i.occurrence_count AS "occurrenceCount", i.correlation_id AS "correlationId",
         i.slo_id AS "sloId", u.username AS "acknowledgedByUsername",
         i.resolution_notes AS "resolutionNotes", i.updated_at AS "updatedAt"
       FROM private.observability_incidents i
       LEFT JOIN private.users u ON u.id = i.acknowledged_by
       WHERE ($1::text IS NULL OR i.environment = $1)
         AND ($2::text IS NULL OR i.status = $2)
         AND ($3::timestamptz IS NULL OR COALESCE(i.resolved_at, 'infinity') >= $3::timestamptz)
         AND ($4::timestamptz IS NULL OR i.started_at <= $4::timestamptz)
         AND ($5::text IS NULL OR i.service = $5)
       ORDER BY
         CASE WHEN i.status = 'open' THEN 0 WHEN i.status = 'acknowledged' THEN 1 ELSE 2 END,
         i.started_at DESC
       LIMIT 200`,
      [filters.environment ?? null, filters.status ?? null, filters.from ?? null, filters.to ?? null, filters.service ?? null],
    )
    return rows
  })
}

export async function updateIncidentStatus(
  pool: Pool,
  identity: SessionIdentity,
  incidentId: string,
  status: 'acknowledged' | 'resolved',
  resolutionNotes: string | null,
): Promise<IncidentRecord> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [row],
    } = await client.query<IncidentRecord>(
      `UPDATE private.observability_incidents
       SET status = $2,
           acknowledged_by = CASE WHEN $2 = 'acknowledged' THEN $3 ELSE acknowledged_by END,
           resolved_at = CASE WHEN $2 = 'resolved' THEN COALESCE(resolved_at, clock_timestamp()) ELSE resolved_at END,
           recovery_duration_s = CASE
             WHEN $2 = 'resolved' THEN round(GREATEST(EXTRACT(EPOCH FROM (clock_timestamp() - started_at)), 0)::numeric, 1)
             ELSE recovery_duration_s
           END,
           resolution_notes = COALESCE($4, resolution_notes),
           updated_at = clock_timestamp()
       WHERE id = $1
       RETURNING
         id, dedupe_key AS "dedupeKey", environment, service,
         incident_type AS "incidentType", severity, status, title, summary,
         started_at AS "startedAt", last_seen_at AS "lastSeenAt",
         resolved_at AS "resolvedAt", recovery_duration_s::float8 AS "recoveryDurationS",
         occurrence_count AS "occurrenceCount", correlation_id AS "correlationId",
         slo_id AS "sloId", NULL::text AS "acknowledgedByUsername",
         resolution_notes AS "resolutionNotes", updated_at AS "updatedAt"`,
      [incidentId, status, identity.id, resolutionNotes],
    )
    if (!row) {
      throw new AuthError(404, 'INCIDENT_NOT_FOUND', 'El incidente solicitado no existe.')
    }
    await recordAuditEntry(client, identity.id, {
      entityType: 'incident',
      entityId: incidentId,
      action: status === 'acknowledged' ? 'acknowledged' : 'resolved',
      summary: `Incidente ${row.title} marcado como ${status}`,
      changes: { status, resolutionNotes },
    })
    return row
  })
}

async function insertRun(
  client: PoolClient,
  runPayload: Record<string, unknown>,
  checksPayload: Array<Record<string, unknown>>,
  actorId?: string,
) {
  const {
    rows: [res],
  } = await client.query<{
    result: { runId: string; insertedChecks: number; duplicateChecks: number }
  }>('SELECT private.ingest_observability_run($1::jsonb, $2::jsonb) AS result', [
    JSON.stringify({ ...runPayload, triggeredBy: actorId ?? null }),
    JSON.stringify(checksPayload),
  ])
  return res.result
}

export async function ingestManualRun(
  pool: Pool,
  identity: SessionIdentity,
  runPayload: Record<string, unknown>,
  checksPayload: Array<Record<string, unknown>>,
) {
  return adminTx(pool, identity, async (client) => {
    const result = await insertRun(client, runPayload, checksPayload, identity.id)
    await recordAuditEntry(client, identity.id, {
      entityType: 'check_run',
      entityId: result.runId,
      action: 'manual_run',
      summary: `Ejecución de comprobaciones autorizadas (${result.insertedChecks} resultados)`,
      changes: { environment: runPayload.environment },
    })
    return result
  })
}

async function loadEvaluationSnapshot(
  client: PoolClient,
  environment: ObservabilityEnvironment,
  from: Date,
  to: Date,
): Promise<EvaluationSnapshot> {
  const { rows: [row] } = await client.query<{ snap: EvaluationSnapshot }>(
    'SELECT private.observability_ingest_snapshot($1, $2::timestamptz, $3::timestamptz) AS snap',
    [environment, from.toISOString(), to.toISOString()],
  )
  return row.snap
}

export async function readEvaluationSnapshot(
  pool: Pool,
  identity: SessionIdentity,
  environment: ObservabilityEnvironment,
  from: Date,
  to: Date,
): Promise<EvaluationSnapshot> {
  return adminTx(pool, identity, (client) => loadEvaluationSnapshot(client, environment, from, to))
}

async function writeSignalsAndEvaluations(
  client: PoolClient,
  signals: IncidentSignal[],
  evaluations: Array<Record<string, unknown>>,
): Promise<void> {
  for (const signal of signals) {
    if (signal.action === 'upsert') {
      await client.query(
        'SELECT private.upsert_observability_incident($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10::uuid)',
        [
          signal.dedupeKey,
          signal.environment,
          signal.service,
          signal.incidentType,
          signal.severity,
          signal.title,
          signal.summary,
          signal.observedAt,
          signal.correlationId,
          signal.sloId,
        ],
      )
    } else {
      await client.query(
        'SELECT private.resolve_observability_incident($1,$2::timestamptz,$3)',
        [signal.dedupeKey, signal.observedAt, signal.resolutionNotes ?? null],
      )
    }
  }
  for (const evalItem of evaluations) {
    await client.query(
      'SELECT private.record_observability_slo_evaluation($1::jsonb)',
      [JSON.stringify(evalItem)],
    )
  }
}

export async function ingestAndEvaluate(
  pool: Pool,
  run: Record<string, unknown> & { environment: ObservabilityEnvironment },
  checks: Array<Record<string, unknown>>,
  from: Date,
  to: Date,
  evaluate?: (snapshot: EvaluationSnapshot, includeSlos: boolean) => {
    signals: IncidentSignal[]
    evaluations: Array<Record<string, unknown>>
  },
) {
  return ingestTx(pool, async (client) => {
    if (evaluate) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('observability_ingest'), hashtext($1))",
        [run.environment],
      )
    }
    const result = await insertRun(client, run, checks)
    if (evaluate && result.insertedChecks > 0) {
      const { rows: [hour] } = await client.query<{ due: boolean }>(
        'SELECT private.observability_needs_hourly_evaluation($1, $2::timestamptz) AS due',
        [run.environment, to.toISOString()],
      )
      const since = hour.due ? from : new Date(to.getTime() - 86_400_000)
      const snapshot = await loadEvaluationSnapshot(client, run.environment, since, to)
      const { signals, evaluations } = evaluate(snapshot, hour.due)
      await writeSignalsAndEvaluations(client, signals, evaluations)
    }
    return result
  })
}

export async function persistSignalsAndEvaluations(
  pool: Pool,
  signals: IncidentSignal[],
  evaluations: Array<Record<string, unknown>>,
  identity: SessionIdentity,
): Promise<void> {
  await adminTx(pool, identity, async (client) => {
    await writeSignalsAndEvaluations(client, signals, evaluations)
    await recordAuditEntry(client, identity.id, {
      entityType: 'slo',
      entityId: 'batch-evaluation',
      action: 'evaluated',
      summary: `Evaluación solicitada (${evaluations.length} objetivos)`,
      changes: { count: evaluations.length },
    })
  })
}

export async function pruneRetentionData(
  pool: Pool,
  identity: SessionIdentity,
): Promise<{
  deletedLogs: number
  deletedChecks: number
  deletedEvaluations: number
}> {
  return adminTx(pool, identity, async (client) => {
    const {
      rows: [row],
    } = await client.query<{
      res: {
        deletedLogs: number
        deletedChecks: number
        deletedEvaluations: number
      }
    }>('SELECT private.prune_observability_data() AS res')
    await recordAuditEntry(client, identity.id, {
      entityType: 'maintenance',
      entityId: 'retention-prune',
      action: 'pruned',
      summary: `Retención ejecutada: ${row.res.deletedLogs} logs, ${row.res.deletedChecks} comprobaciones, ${row.res.deletedEvaluations} evaluaciones`,
      changes: row.res,
    })
    return row.res
  })
}

export async function listAuditEntries(
  pool: Pool,
  identity: SessionIdentity,
  limit = 50,
): Promise<
  Array<{
    id: string
    adminUsername: string
    entityType: string
    entityId: string
    action: string
    summary: string
    changes: Record<string, unknown>
    createdAt: string
  }>
> {
  return adminTx(pool, identity, async (client) => {
    const { rows } = await client.query(
      `SELECT
         a.id, COALESCE(u.username, 'admin') AS "adminUsername",
         a.entity_type AS "entityType", a.entity_id AS "entityId",
         a.action, a.summary, a.changes, a.created_at AS "createdAt"
       FROM private.observability_audit_log a
       LEFT JOIN private.users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $1`,
      [limit],
    )
    return rows
  })
}

export async function insertSanitizedLogsBatch(
  pool: Pool,
  entries: Array<Record<string, unknown>>,
): Promise<number> {
  const {
    rows: [row],
  } = await pool.query<{ inserted: number }>(
    'SELECT private.insert_observability_logs($1::jsonb) AS inserted',
    [JSON.stringify(entries)],
  )
  return row.inserted
}

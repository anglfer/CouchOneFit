import type { Pool } from 'pg'
import { config } from '../../../config/index.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import * as repo from '../repositories/observability.js'
import {
  csvCell,
  isOperationalRequest,
  isServiceAvailabilityCheck,
  mean,
  percentile,
  periodWindow,
  round,
} from '../utils/classify.js'
import {
  validateClientTelemetryPayload,
  validateDashboardQuery,
  validateIncidentUpdate,
  validateIngestPayload,
  validateLogsQuery,
  validateManualChecksRun,
  validateSettingsInput,
  validateSlaInput,
  validateSliInput,
  validateSloInput,
  validateStatusToggle,
  validateUuidParam,
  parseEnvironment,
  parsePeriod,
} from '../validators/observability.js'
import { evaluateSlis, evaluateSlos } from './slo-engine.js'
import { detectIncidentSignals } from './incident-detector.js'
import {
  listAuthorizedChecks,
  runAuthorizedChecks,
} from './manual-checks.js'
import type {
  ComplianceStatus,
  DashboardSummary,
  EvaluationSnapshot,
  IncidentRecord,
  ObservabilityEnvironment,
  ObservabilityPeriod,
  ObservabilitySettings,
  RawCheckSample,
  RawLogSample,
  ServiceHealthState,
  ServiceStatusSummary,
  SlaAgreement,
  SliDefinition,
  SloDefinition,
  SloEvaluated,
  TimeSeriesPoint,
} from '../types/observability.js'

function defaultEnv(): ObservabilityEnvironment {
  return parseEnvironment(config.observabilityEnv, 'development')
}

function buildTimeSeries(
  period: ObservabilityPeriod,
  logs: RawLogSample[],
  checks: RawCheckSample[],
): TimeSeriesPoint[] {
  const bucketMs =
    period === '1h' ? 5 * 60_000 : period === '24h' ? 3_600_000 : 86_400_000
  const map = new Map<
    number,
    {
      requests: RawLogSample[]
      checksPassed: number
      checksFailed: number
      availPassed: number
      availFailed: number
      availMissing: number
    }
  >()

  const getBucket = (iso: string) => {
    const ms = Date.parse(iso)
    const key = Math.floor(ms / bucketMs) * bucketMs
    let bucket = map.get(key)
    if (!bucket) {
      bucket = {
        requests: [],
        checksPassed: 0,
        checksFailed: 0,
        availPassed: 0,
        availFailed: 0,
        availMissing: 0,
      }
      map.set(key, bucket)
    }
    return bucket
  }

  for (const log of logs) {
    if (
      log.eventType === 'http.request' && isOperationalRequest(log)
    ) {
      getBucket(log.occurredAt).requests.push(log)
    }
  }

  for (const check of checks) {
    if (check.phase === 'recovery-drill') continue
    const b = getBucket(check.executedAt)
    if (check.status === 'passed') {
      b.checksPassed += 1
      if (isServiceAvailabilityCheck(check)) b.availPassed += 1
    } else if (check.status === 'failed') {
      b.checksFailed += 1
      if (isServiceAvailabilityCheck(check)) b.availFailed += 1
    } else if (isServiceAvailabilityCheck(check) && (check.status === 'not_executed' || check.status === 'blocked')) {
      b.availMissing += 1
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, bucket]) => {
      const durations = bucket.requests
        .map((r) => r.durationMs)
        .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
      const errors = bucket.requests.filter(
        (r) => (r.statusCode ?? 0) >= 500,
      ).length
      const availTotal = bucket.availPassed + bucket.availFailed
      return {
        bucket: new Date(key).toISOString(),
        requestsTotal: bucket.requests.length,
        errorRatePct: bucket.requests.length
          ? round((errors / bucket.requests.length) * 100, 2)
          : null,
        latencyP50Ms: round(percentile(durations, 50), 1),
        latencyP95Ms: round(percentile(durations, 95), 1),
        availabilityPct: availTotal && bucket.availMissing === 0
          ? round((bucket.availPassed / availTotal) * 100, 2)
          : null,
        checksPassed: bucket.checksPassed,
        checksFailed: bucket.checksFailed,
      }
    })
}

function summarizeServiceState(
  id: 'web' | 'api' | 'database',
  name: string,
  checks: RawCheckSample[],
  logs: RawLogSample[],
  openIncidents: IncidentRecord[],
  settings: ObservabilitySettings,
  now: Date,
): ServiceStatusSummary {
  const relevant = checks.filter((check) => check.service === id && isServiceAvailabilityCheck(check))
  const latest = relevant[0] ?? null
  const executed = relevant.filter((check) => check.status === 'passed' || check.status === 'failed')
  const passed = executed.filter((check) => check.status === 'passed')
  const availabilityPct = executed.length && !relevant.some((check) => check.status === 'not_executed' || check.status === 'blocked')
    ? round((passed.length / executed.length) * 100, 2) : null
  const recentSince = now.getTime() - (2 * settings.checkIntervalMinutes + 5) * 60_000
  const freshChecks = passed.filter((check) => new Date(check.executedAt).getTime() >= recentSince)
  const measurement = latest && new Date(latest.executedAt).getTime() >= recentSince ? latest : null
  const freshLogs = logs.filter((log) => new Date(log.occurredAt).getTime() >= recentSince)
  const apiHttp = id === 'api'
    ? freshLogs.filter((log) => isOperationalRequest(log) && log.eventType === 'http.request')
    : []
  const dbErrors = id === 'database' ? freshLogs.filter((log) => log.eventType === 'db.connection_error') : []
  const latencySamples = (freshChecks.length ? freshChecks : apiHttp)
    .map((item) => item.durationMs)
    .filter((duration): duration is number => duration !== null && Number.isFinite(duration))
  const latencyP95Ms = round(percentile(latencySamples, 95), 1)
  const outage = openIncidents.find((incident) => incident.service === id && incident.incidentType === 'service_outage')
  const failure = apiHttp.filter((log) => (log.statusCode ?? 0) >= 500)
  const errorRate = apiHttp.length ? (failure.length / apiHttp.length) * 100 : 0
  let state: ServiceHealthState = 'insufficient_data'
  let detail = 'Sin comprobaciones recientes o mediciones operativas suficientes.'
  if (measurement?.status === 'failed') {
    state = 'unavailable'
    detail = measurement.errorMessage ?? `Última comprobación fallida (${measurement.checkName}).`
  } else if (outage && (!measurement || measurement.status !== 'passed')) {
    detail = 'Sin comprobación reciente para confirmar la recuperación del incidente abierto.'
  } else if (
    dbErrors.length > 0 ||
    errorRate >= settings.incidentErrorRateThresholdPct ||
    (latencyP95Ms !== null && latencyP95Ms > settings.incidentLatencyP95ThresholdMs)
  ) {
    state = 'degraded'
    detail = dbErrors.length
      ? `${dbErrors.length} error(es) reciente(s) de conexión a base de datos.`
      : `Error 5xx ${round(errorRate, 2)}% · Latencia P95 ${latencyP95Ms ?? 'n/d'} ms.`
  } else if (measurement?.status === 'passed' || apiHttp.length > 0) {
    state = 'operational'
    detail = measurement?.status === 'passed'
      ? `Última comprobación exitosa (${measurement.durationMs ?? 'n/d'} ms).`
      : `${apiHttp.length} solicitud(es) operativa(s) reciente(s).`
  }
  return {
    id, name, state, availabilityPct, latencyP95Ms, detail,
    lastCheckedAt: latest?.executedAt ?? apiHttp[0]?.occurredAt ?? dbErrors[0]?.occurredAt ?? null,
  }
}

export async function getDashboardSummary(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now: Date = new Date(),
  snapshot?: EvaluationSnapshot,
): Promise<DashboardSummary> {
  const filters = validateDashboardQuery(query, defaultEnv())
  const { start, end, previousStart } = periodWindow(filters.period, now)
  const [samples, incidents] = await Promise.all([
    snapshot ?? repo.readEvaluationSnapshot(pool, identity, filters.environment, previousStart, end),
    repo.listIncidents(pool, identity, {
      environment: filters.environment,
      from: start.toISOString(),
      to: end.toISOString(),
      service: filters.service,
    }),
  ])
  const settings = samples.settings
  const currentLogs = samples.logs.filter((log) => new Date(log.occurredAt) >= start)
  const currentChecks = samples.checks.filter((check) => new Date(check.executedAt) >= start)

  const matchFilter = (item: { service: string; module: string }) => {
    if (filters.service && item.service !== filters.service) return false
    if (filters.module && item.module !== filters.module) return false
    return true
  }

  const filteredLogs = currentLogs.filter(matchFilter)
  const filteredChecks = currentChecks.filter(matchFilter)
  const operationalLogs = filteredLogs.filter(isOperationalRequest)
  const httpLogs = operationalLogs.filter((log) => log.eventType === 'http.request')
  const abortedCount = operationalLogs.length - httpLogs.length
  const requestsTotal = operationalLogs.length
  const requestsSucceeded = httpLogs.filter(
    (log) => (log.statusCode ?? 0) >= 200 && (log.statusCode ?? 0) < 400,
  ).length
  const requestsFailed = httpLogs.filter((log) => (log.statusCode ?? 0) >= 400).length + abortedCount
  const errorRatePct = httpLogs.length
    ? round((httpLogs.filter((log) => (log.statusCode ?? 0) >= 500).length / httpLogs.length) * 100, 2)
    : null
  const durations = httpLogs
    .map((l) => l.durationMs)
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))

  const executedChecks = filteredChecks.filter(
    (c) =>
      c.phase !== 'recovery-drill' &&
      (c.status === 'passed' || c.status === 'failed'),
  )
  const checksPassed = executedChecks.filter(
    (c) => c.status === 'passed',
  ).length
  const checksFailed = executedChecks.filter(
    (c) => c.status === 'failed',
  ).length
  const checksNotExecuted = filteredChecks.filter(
    (c) => c.status === 'not_executed' || c.status === 'blocked',
  ).length

  const availabilityChecks = executedChecks.filter(isServiceAvailabilityCheck)
  const incompleteAvailability = filteredChecks.some((check) => isServiceAvailabilityCheck(check) &&
    (check.status === 'not_executed' || check.status === 'blocked'))
  const availabilityPct = availabilityChecks.length && !incompleteAvailability
    ? round(
        (availabilityChecks.filter((c) => c.status === 'passed').length /
          availabilityChecks.length) *
          100,
        2,
      )
    : null

  const sliById = new Map(samples.slis.map((sli) => [sli.id, sli]))
  const selectedSlos = samples.slos.filter((slo) => {
    const sli = sliById.get(slo.sliId)
    return slo.status === 'active' &&
      (!filters.service || sli?.service === filters.service) &&
      (!filters.module || sli?.calculationMethod.module === filters.module || sli?.service === filters.module)
  })
  const evaluatedSlos = evaluateSlos(selectedSlos, sliById, samples, now, filters.period)
  const activeIncidents = incidents.filter((incident) => incident.status !== 'resolved')
  const serviceNames = {
    web: 'Aplicación Web (Vercel)',
    api: 'Backend API (Render)',
    database: 'Base de datos (PostgreSQL / Supabase)',
  }
  const services: ServiceStatusSummary[] = (['web', 'api', 'database'] as const)
    .filter((id) => !filters.service || id === filters.service)
    .map((id) => summarizeServiceState(id, serviceNames[id], currentChecks, currentLogs, activeIncidents, settings, now))

  const moduleNames = new Set<string>([
    ...filteredLogs.map((l) => l.module),
    ...filteredChecks.map((c) => c.module),
  ])
  const modules = [...moduleNames]
    .sort()
    .map((mod) => {
      const mLogs = httpLogs.filter((l) => l.module === mod)
      const mChecks = executedChecks.filter((c) => c.module === mod)
      const mErrors = mLogs.filter((l) => (l.statusCode ?? 0) >= 500).length
      const mDurs = mLogs
        .map((l) => l.durationMs)
        .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
      const mPass = mChecks.filter((c) => c.status === 'passed').length
      const mFail = mChecks.filter((c) => c.status === 'failed').length
      const mErrRate = mLogs.length
        ? round((mErrors / mLogs.length) * 100, 2)
        : null
      const mP95 = round(percentile(mDurs, 95), 1)
      let state: ServiceHealthState = 'insufficient_data'
      if (mFail > 0 && mPass === 0) state = 'unavailable'
      else if (
        mFail > 0 ||
        (mErrRate !== null && mErrRate >= settings.incidentErrorRateThresholdPct) ||
        (mP95 !== null && mP95 > settings.incidentLatencyP95ThresholdMs)
      ) {
        state = 'degraded'
      } else if (mLogs.length > 0 || mChecks.length > 0) {
        state = 'operational'
      }
      return {
        module: mod,
        requestsTotal: mLogs.length,
        errorRatePct: mErrRate,
        p95LatencyMs: mP95,
        checksPassed: mPass,
        checksFailed: mFail,
        state,
      }
    })

  const limitations: string[] = [
    'Los SLO configurados internamente no equivalen a acuerdos SLA contractuales aprobados.',
    'La ausencia de muestras se reporta como «Sin información suficiente», nunca como 100 % de disponibilidad.',
  ]
  if (requestsTotal === 0) {
    limitations.push(
      `No hay tráfico HTTP real registrado en el ambiente «${filters.environment}» para la ventana seleccionada.`,
    )
  }
  if (availabilityChecks.length === 0) {
    limitations.push(
      `No hay comprobaciones sintéticas de disponibilidad ejecutadas en «${filters.environment}» durante este periodo.`,
    )
  }
  if (checksNotExecuted > 0) {
    limitations.push(
      `${checksNotExecuted} comprobación(es) quedó/quedaron como «No ejecutada» (p. ej. credenciales sintéticas o URL Web no configuradas); no se contabilizan como caída del servicio.`,
    )
  }
  if (
    (samples.logsTruncated && currentLogs.length === samples.logs.length) ||
    (samples.checksTruncated && currentChecks.length === samples.checks.length)
  ) {
    limitations.push('Los totales y percentiles se basan en las muestras más recientes de la ventana. Selecciona un periodo menor para evitar el límite de lectura.')
  }

  return {
    environment: filters.environment,
    period: filters.period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    generatedAt: now.toISOString(),
    services,
    kpis: {
      availabilityPct,
      avgLatencyMs: round(mean(durations), 1),
      p50LatencyMs: round(percentile(durations, 50), 1),
      p95LatencyMs: round(percentile(durations, 95), 1),
      p99LatencyMs: round(percentile(durations, 99), 1),
      requestsTotal,
      requestsSucceeded,
      requestsFailed,
      errorRatePct,
      checksPassed,
      checksFailed,
      checksNotExecuted,
      slosMet: evaluatedSlos.filter((s) => s.complianceStatus === 'met').length,
      slosUnmet: evaluatedSlos.filter((s) => s.complianceStatus === 'unmet')
        .length,
      slosInsufficient: evaluatedSlos.filter(
        (s) => s.complianceStatus === 'insufficient_data',
      ).length,
      openIncidents: activeIncidents.length,
    },
    modules,
    history: buildTimeSeries(filters.period, filteredLogs, filteredChecks),
    activeIncidents,
    slos: evaluatedSlos,
    limitations,
  }
}

export async function queryLogs(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
) {
  const filters = validateLogsQuery(query, defaultEnv())
  return repo.queryLogsPage(pool, identity, { ...filters, runtimeEnvironment: defaultEnv() })
}

export async function getLogDetail(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
) {
  validateUuidParam(id, 'registro')
  return repo.getLogDetailAndCorrelation(pool, identity, id, defaultEnv())
}

export async function exportLogs(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
): Promise<{ format: 'csv' | 'json'; content: string; filename: string }> {
  const format = query.format === 'csv' ? 'csv' : 'json'
  const filters = validateLogsQuery(
    { ...query, page: 1, pageSize: 100 },
    defaultEnv(),
  )
  const page1 = await repo.queryLogsPage(pool, identity, { ...filters, runtimeEnvironment: defaultEnv() })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

  if (format === 'json') {
    return {
      format: 'json',
      filename: `couchonefit-logs-${stamp}.json`,
      content: `${JSON.stringify({ exportedAt: new Date().toISOString(), total: page1.total, items: page1.items }, null, 2)}\n`,
    }
  }

  const header = [
    'id',
    'category',
    'correlationId',
    'occurredAt',
    'environment',
    'service',
    'module',
    'eventType',
    'severity',
    'operation',
    'normalizedPath',
    'httpMethod',
    'statusCode',
    'durationMs',
    'outcome',
    'errorCode',
    'errorMessage',
  ]
  const rows = [
    header.map((h) => csvCell(h)).join(','),
    ...page1.items.map((item) =>
      [
        item.id,
        item.category,
        item.correlationId,
        item.occurredAt,
        item.environment,
        item.service,
        item.module,
        item.eventType,
        item.severity,
        item.operation,
        item.normalizedPath,
        item.httpMethod,
        item.statusCode,
        item.durationMs,
        item.outcome,
        item.errorCode,
        item.errorMessage,
      ]
        .map((v) => csvCell(v))
        .join(','),
    ),
  ]
  return {
    format: 'csv',
    filename: `couchonefit-logs-${stamp}.csv`,
    content: `${rows.join('\n')}\n`,
  }
}

export async function listSlisWithValues(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now: Date = new Date(),
) {
  const environment = parseEnvironment(query.environment, defaultEnv())
  const period = query.period === undefined ? undefined : parsePeriod(query.period, '7d')
  const { start, end } = periodWindow(period ?? '30d', now)
  const [configured, snapshot] = await Promise.all([
    repo.listSlis(pool, identity),
    repo.readEvaluationSnapshot(pool, identity, environment, start, end),
  ])
  const activeById = new Map(snapshot.slis.map((sli) => [sli.id, sli]))
  const definitions = configured.map((sli) => activeById.get(sli.id) ?? sli)
  return {
    environment,
    period: period ?? '7d',
    items: evaluateSlis(definitions, snapshot, now, period),
  }
}

export async function createSli(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
) {
  const validated = validateSliInput(input, false)
  return repo.createSli(pool, identity, {
    ...validated,
    code: validated.code!,
  })
}

export async function updateSli(
  pool: Pool,
  identity: SessionIdentity,
  sliId: string,
  input: unknown,
) {
  validateUuidParam(sliId, 'SLI')
  const validated = validateSliInput(input, true)
  return repo.updateSli(pool, identity, sliId, validated)
}

export async function toggleSliStatus(
  pool: Pool,
  identity: SessionIdentity,
  sliId: string,
  input: unknown,
) {
  validateUuidParam(sliId, 'SLI')
  const { active, reason } = validateStatusToggle(input)
  return repo.setSliActiveStatus(pool, identity, sliId, active, reason)
}

export async function getSliVersions(
  pool: Pool,
  identity: SessionIdentity,
  sliId: string,
) {
  validateUuidParam(sliId, 'SLI')
  return repo.listSliVersions(pool, identity, sliId)
}

async function currentSloSnapshot(
  pool: Pool,
  identity: SessionIdentity,
  environment: ObservabilityEnvironment,
  now: Date,
  period?: ObservabilityPeriod,
) {
  const { previousStart, end } = periodWindow(period ?? '30d', now)
  const [configured, snapshot] = await Promise.all([
    repo.listSlos(pool, identity),
    repo.readEvaluationSnapshot(pool, identity, environment, previousStart, end),
  ])
  const currentById = new Map(snapshot.slos.map((slo) => [slo.id, slo]))
  const definitions = configured.map((slo) => currentById.get(slo.id) ?? slo)
  return { snapshot, definitions, sliById: new Map(snapshot.slis.map((sli) => [sli.id, sli])) }
}

export async function listSlosWithEvaluation(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now: Date = new Date(),
) {
  const environment = parseEnvironment(query.environment, defaultEnv())
  const period = query.period === undefined ? undefined : parsePeriod(query.period, '7d')
  const { snapshot, definitions, sliById } = await currentSloSnapshot(pool, identity, environment, now, period)
  return {
    environment,
    period: period ?? '7d',
    items: evaluateSlos(definitions, sliById, snapshot, now, period),
  }
}

export async function createSlo(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
) {
  const validated = validateSloInput(input, false)
  return repo.createSlo(pool, identity, {
    ...validated,
    code: validated.code!,
  })
}

export async function updateSlo(
  pool: Pool,
  identity: SessionIdentity,
  sloId: string,
  input: unknown,
) {
  validateUuidParam(sloId, 'SLO')
  const validated = validateSloInput(input, true)
  return repo.updateSlo(pool, identity, sloId, validated)
}

export async function toggleSloStatus(
  pool: Pool,
  identity: SessionIdentity,
  sloId: string,
  input: unknown,
) {
  validateUuidParam(sloId, 'SLO')
  const { active, reason } = validateStatusToggle(input)
  return repo.setSloStatus(pool, identity, sloId, active, reason)
}

function evaluationPayloads(slos: SloEvaluated[], environment: ObservabilityEnvironment, automatic = false) {
  return slos
    .filter((slo) => slo.status === 'active' && slo.periodStart < slo.periodEnd)
    .map((slo) => ({
      sloId: slo.id,
      sloVersion: slo.currentVersion,
      environment,
      periodStart: slo.periodStart,
      periodEnd: slo.periodEnd,
      targetValue: slo.targetValue,
      observedValue: slo.observedValue,
      deltaValue: slo.deltaValue,
      samples: slo.samples,
      notExecutedCount: slo.notExecutedCount,
      complianceStatus: slo.complianceStatus,
      errorBudgetTotal: slo.errorBudgetTotal,
      errorBudgetConsumed: slo.errorBudgetConsumed,
      errorBudgetRemainingPct: slo.errorBudgetRemainingPct,
      notes: slo.notes,
      evaluatedAt: slo.periodEnd,
      automatic,
    }))
}

function incidentSignals(
  environment: ObservabilityEnvironment,
  snapshot: EvaluationSnapshot,
  evaluatedSlos: SloEvaluated[],
  now: Date,
) {
  const logsAtCutoff = snapshot.logs.at(-1)?.occurredAt
  const logsTruncatedInAlertWindow = snapshot.logsTruncated &&
    logsAtCutoff !== undefined &&
    new Date(logsAtCutoff).getTime() >= now.getTime() - 15 * 60_000
  return detectIncidentSignals({
    environment,
    settings: snapshot.settings,
    recentChecks: snapshot.checks,
    recentLogs: logsTruncatedInAlertWindow ? [] : snapshot.logs,
    evaluatedSlos,
    now,
  })
}

export async function evaluateAndPersistSlos(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
  now: Date = new Date(),
) {
  const body = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const environment = parseEnvironment(body.environment, defaultEnv())
  const period = body.period === undefined ? undefined : parsePeriod(body.period, '7d')
  const { snapshot, definitions, sliById } = await currentSloSnapshot(pool, identity, environment, now, period)
  const evaluated = evaluateSlos(definitions, sliById, snapshot, now, period)
  const signals = incidentSignals(environment, snapshot, evaluated, now)
  const evaluations = evaluationPayloads(evaluated, environment)
  await repo.persistSignalsAndEvaluations(pool, signals, evaluations, identity)
  return { environment, period: period ?? '7d', items: evaluated, persisted: evaluations.length }
}

export async function getSloHistory(
  pool: Pool,
  identity: SessionIdentity,
  sloId: string,
  query: Record<string, unknown>,
) {
  validateUuidParam(sloId, 'SLO')
  const environment = parseEnvironment(query.environment, defaultEnv())
  return repo.listSloHistory(pool, identity, sloId, environment)
}

export async function listSlasWithCompliance(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now: Date = new Date(),
): Promise<{
  environment: ObservabilityEnvironment
  period: ObservabilityPeriod
  items: SlaAgreement[]
}> {
  const environment = parseEnvironment(query.environment, defaultEnv())
  const period = parsePeriod(query.period, '7d')
  const [rawSlas, { snapshot, definitions, sliById }] = await Promise.all([
    repo.listSlas(pool, identity),
    currentSloSnapshot(pool, identity, environment, now, period),
  ])
  const items = evaluateSlas(rawSlas, definitions, sliById, snapshot, now, period)
  return { environment, period, items }
}

function evaluateSlas(
  rawSlas: Array<Omit<SlaAgreement, 'slos' | 'observedCompliance'>>,
  definitions: SloDefinition[],
  sliById: Map<string, SliDefinition>,
  snapshot: EvaluationSnapshot,
  now: Date,
  period: ObservabilityPeriod,
): SlaAgreement[] {
  return rawSlas.map((sla) => {
    const active = sla.isActive &&
      (sla.approvalStatus === 'formally_approved' || sla.approvalStatus === 'internal_reference') &&
      now >= new Date(sla.effectiveFrom) &&
      (!sla.effectiveTo || now < new Date(sla.effectiveTo))
    const targets = definitions.filter((slo) => sla.sloIds.includes(slo.id))
    const associatedSlos = evaluateSlos(targets, sliById, snapshot, now, period, sla.effectiveFrom)
    let observedCompliance: ComplianceStatus = 'insufficient_data'
    if (active && associatedSlos.some((slo) => slo.complianceStatus === 'unmet')) {
      observedCompliance = 'unmet'
    } else if (active && sla.sloIds.length > 0 && associatedSlos.length === sla.sloIds.length &&
      associatedSlos.every((slo) => slo.complianceStatus === 'met')) {
      observedCompliance = 'met'
    }
    return { ...sla, slos: associatedSlos, observedCompliance }
  })
}

export async function createSla(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
) {
  const validated = validateSlaInput(input)
  const id = await repo.createSla(pool, identity, validated)
  return { id }
}

export async function updateSla(
  pool: Pool,
  identity: SessionIdentity,
  slaId: string,
  input: unknown,
) {
  validateUuidParam(slaId, 'SLA')
  const validated = validateSlaInput(input)
  await repo.updateSla(pool, identity, slaId, validated)
  return { id: slaId }
}

export async function toggleSlaStatus(
  pool: Pool,
  identity: SessionIdentity,
  slaId: string,
  input: unknown,
) {
  validateUuidParam(slaId, 'SLA')
  const { active, reason } = validateStatusToggle(input)
  await repo.setSlaActiveStatus(pool, identity, slaId, active, reason)
  return { id: slaId, isActive: active }
}

export async function getChecksOverview(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now: Date = new Date(),
) {
  const runtimeEnvironment = defaultEnv()
  const { environment, service, module } = validateDashboardQuery(query, runtimeEnvironment)
  const period = parsePeriod(query.period, '7d')
  const { start, end } = periodWindow(period, now)
  const page = Math.min(1_000_000, Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1))
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(query.pageSize ?? '20'), 10) || 20))
  const runId = typeof query.runId === 'string' ? query.runId : undefined
  if (runId !== undefined) validateUuidParam(runId, 'corrida')
  const [settings, history] = await Promise.all([
    repo.readRuntimeSettings(pool, identity),
    repo.listTestRunsAndResults(pool, identity, environment, start.toISOString(), end.toISOString(), page, pageSize, runId, service, module),
  ])
  return {
    environment,
    runtimeEnvironment,
    period,
    page,
    pageSize,
    settings,
    authorizedChecks: listAuthorizedChecks(),
    ...history,
  }
}

export async function executeManualChecks(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
) {
  const { environment, checkKeys } = validateManualChecksRun(input, defaultEnv())
  const startedAt = new Date()
  const checks = await runAuthorizedChecks(pool, checkKeys)
  const finishedAt = new Date()
  const passed = checks.filter((c) => c.status === 'passed').length
  const failed = checks.filter((c) => c.status === 'failed').length
  const notExecuted = checks.filter((c) => c.status === 'not_executed').length
  const runStatus =
    failed > 0 && passed > 0
      ? 'partial'
      : failed > 0
        ? 'failed'
        : passed > 0
          ? 'passed'
          : 'not_executed'

  const ingestRes = await repo.ingestManualRun(
    pool,
    identity,
    {
      category: 'manual_admin',
      environment,
      triggerSource: 'admin_manual',
      status: runStatus,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      totalChecks: checks.length,
      passedChecks: passed,
      failedChecks: failed,
      notExecutedChecks: notExecuted,
      skippedChecks: 0,
      commitSha: config.appVersion,
      notes: 'Ejecución manual autorizada desde panel administrativo.',
    },
    checks.map((c) => ({ ...c, environment })),
  )

  return {
    runId: ingestRes.runId,
    environment,
    status: runStatus,
    checks,
  }
}

export async function updateObservabilitySettings(
  pool: Pool,
  identity: SessionIdentity,
  input: unknown,
) {
  const validated = validateSettingsInput(input)
  return repo.updateSettings(pool, identity, validated)
}

export async function runMaintenancePrune(
  pool: Pool,
  identity: SessionIdentity,
) {
  return repo.pruneRetentionData(pool, identity)
}

export async function listIncidents(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
) {
  const environment =
    query.environment === 'all'
      ? undefined
      : parseEnvironment(query.environment, defaultEnv())
  const status =
    typeof query.status === 'string' &&
    ['open', 'acknowledged', 'resolved'].includes(query.status)
      ? (query.status as 'open' | 'acknowledged' | 'resolved')
      : undefined
  return {
    items: await repo.listIncidents(pool, identity, { environment, status }),
  }
}

export async function updateIncident(
  pool: Pool,
  identity: SessionIdentity,
  incidentId: string,
  input: unknown,
) {
  validateUuidParam(incidentId, 'incidente')
  const { status, resolutionNotes } = validateIncidentUpdate(input)
  return repo.updateIncidentStatus(
    pool,
    identity,
    incidentId,
    status as 'acknowledged' | 'resolved',
    resolutionNotes,
  )
}

export async function listAudit(pool: Pool, identity: SessionIdentity) {
  return { items: await repo.listAuditEntries(pool, identity, 60) }
}

export async function ingestExternalRun(pool: Pool, input: unknown) {
  const { run, checks } = validateIngestPayload(input, defaultEnv())
  const refDate = new Date(run.finishedAt)
  const { previousStart } = periodWindow('30d', refDate)
  return repo.ingestAndEvaluate(
    pool,
    run,
    checks,
    previousStart,
    refDate,
    run.category === 'synthetic_periodic' && run.status !== 'not_executed'
      ? (snapshot, includeSlos) => {
          const sliById = new Map(snapshot.slis.map((sli) => [sli.id, sli]))
          const evaluated = includeSlos ? evaluateSlos(snapshot.slos, sliById, snapshot, refDate) : []
          return {
            signals: incidentSignals(run.environment, snapshot, evaluated, refDate),
            evaluations: evaluationPayloads(evaluated, run.environment, true),
          }
        }
      : undefined,
  )
}

export async function readMonitorConfig(pool: Pool) {
  return repo.readRuntimeSettings(pool)
}

export async function recordClientTelemetry(
  pool: Pool,
  correlationId: string,
  role: string,
  input: unknown,
) {
  const validated = validateClientTelemetryPayload(input, defaultEnv())
  const severity =
    validated.eventType === 'client.sync_failed'
      ? 'error'
      : validated.eventType === 'client.sync_conflict'
        ? 'warn'
        : 'info'
  const outcome =
    validated.eventType === 'client.sync_recovered'
      ? 'recovered'
      : validated.eventType === 'client.sync_failed'
        ? 'server_error'
        : 'client_error'

  await repo.insertSanitizedLogsBatch(pool, [
    {
      correlationId,
      occurredAt: new Date().toISOString(),
      environment: validated.environment,
      service: validated.client,
      module: validated.module,
      source: 'client_telemetry',
      eventType: validated.eventType,
      severity,
      operation: validated.operation,
      statusCode: validated.statusCode ?? undefined,
      outcome,
      errorCode: validated.errorCode ?? undefined,
      systemVersion: config.appVersion,
      metadata: { actorRole: role, client: validated.client },
    },
  ])
  return { recorded: true }
}

export async function buildPeriodReport(
  pool: Pool,
  identity: SessionIdentity,
  query: Record<string, unknown>,
  now: Date = new Date(),
) {
  const filters = validateDashboardQuery(query, defaultEnv())
  const { environment, period, service, module } = filters
  const { previousStart, start, end } = periodWindow(period, now)
  const from = start.toISOString()
  const to = end.toISOString()
  const [snapshot, rawSlas, checksOverview, logsPage, incidents] = await Promise.all([
    repo.readEvaluationSnapshot(pool, identity, environment, previousStart, end),
    repo.listSlas(pool, identity),
    getChecksOverview(pool, identity, { ...filters, page: 1, pageSize: 20 }, now),
    repo.queryLogsPage(pool, identity, {
      runtimeEnvironment: defaultEnv(), environment, service, module, from, to,
      category: 'error', page: 1, pageSize: 20, excludeSynthetic: true,
    }),
    repo.listIncidents(pool, identity, { environment, service, from, to }),
  ])
  const dashboard = await getDashboardSummary(pool, identity, query, now, snapshot)
  const slis = evaluateSlis(snapshot.slis.filter((sli) =>
    sli.isActive && (!service || sli.service === service) &&
      (!module || sli.calculationMethod.module === module || sli.service === module),
  ), snapshot, now, period)
  const sliById = new Map(snapshot.slis.map((sli) => [sli.id, sli]))
  const selectedIds = new Set(dashboard.slos.map((slo) => slo.id))
  const selectedSlas = service || module
    ? rawSlas.filter((sla) => sla.sloIds.some((id) => selectedIds.has(id)))
    : rawSlas
  const slas = evaluateSlas(selectedSlas, snapshot.slos, sliById, snapshot, now, period)
  const cell = (value: unknown) => String(value ?? 'n/d').replace(/[\r\n]+/g, ' ').replaceAll('|', '\\|')

  const markdownLines = [
    `# Reporte de Observabilidad y Niveles de Servicio — CouchOne Fit`,
    '',
    `- **Generado:** ${dashboard.generatedAt}`,
    `- **Ambiente:** ${dashboard.environment}`,
    `- **Periodo:** ${dashboard.period} (${dashboard.periodStart} a ${dashboard.periodEnd})`,
    '',
    '## Estado de servicios',
    '',
    '| Servicio | Estado | Disponibilidad % | Latencia P95 ms | Última comprobación |',
    '| --- | --- | --- | --- | --- |',
    ...dashboard.services.map(
      (s) =>
        `| ${s.name} | ${s.state} | ${s.availabilityPct ?? 'n/d'} | ${s.latencyP95Ms ?? 'n/d'} | ${s.lastCheckedAt ?? 'n/d'} |`,
    ),
    '',
    '## Métricas operativas y pruebas',
    '',
    `- Disponibilidad observada: ${dashboard.kpis.availabilityPct ?? 'n/d'} %`,
    `- Solicitudes HTTP: ${dashboard.kpis.requestsTotal} (${dashboard.kpis.requestsSucceeded} exitosas, ${dashboard.kpis.requestsFailed} fallidas, tasa de error HTTP 5xx ${dashboard.kpis.errorRatePct ?? 'n/d'} %)`,
    `- Latencias API (ms): promedio ${dashboard.kpis.avgLatencyMs ?? 'n/d'} · P50 ${dashboard.kpis.p50LatencyMs ?? 'n/d'} · P95 ${dashboard.kpis.p95LatencyMs ?? 'n/d'} · P99 ${dashboard.kpis.p99LatencyMs ?? 'n/d'}`,
    `- Pruebas ejecutadas: ${dashboard.kpis.checksPassed} aprobadas, ${dashboard.kpis.checksFailed} fallidas, ${dashboard.kpis.checksNotExecuted} no ejecutadas`,
    '',
    '## Últimas corridas del periodo',
    '',
    `Se muestran ${checksOverview.runs.length} de ${checksOverview.totalRuns} corridas.`,
    '',
    '| Fecha | Categoría | Estado | Aprobadas | Fallidas | Sin ejecutar | Duración ms |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...checksOverview.runs.map((run) =>
      `| ${run.startedAt} | ${run.category} | ${run.status} | ${run.passedChecks} | ${run.failedChecks} | ${run.notExecutedChecks} | ${run.durationMs} |`),
    '',
    '## Errores registrados',
    '',
    `Se muestran ${logsPage.items.length} de ${logsPage.total} registros de error.`,
    '',
    '| Fecha | Servicio | Operación | Código | Detalle |',
    '| --- | --- | --- | --- | --- |',
    ...logsPage.items.map((log) =>
      `| ${log.occurredAt} | ${cell(log.service)} | ${cell(log.operation)} | ${cell(log.errorCode ?? log.statusCode)} | ${cell(log.errorMessage)} |`),
    '',
    '## SLI calculados',
    '',
    '| SLI | Fuente | Valor | Muestras |',
    '| --- | --- | --- | --- |',
    ...slis.map(
      (sli) =>
        `| ${cell(sli.name)} | ${sli.dataSource} | ${sli.observedValue ?? 'n/d'} ${sli.unit} | ${sli.samples} |`,
    ),
    '',
    '## Evaluación de SLO internos',
    '',
    '| SLO | Objetivo | Observado | Diferencia | Muestras | Estado |',
    '| --- | --- | --- | --- | --- | --- |',
    ...dashboard.slos.map(
      (slo) =>
        `| ${cell(slo.name)} | ${slo.comparisonOperator} ${slo.targetValue} ${slo.unit} | ${slo.observedValue ?? 'n/d'} ${slo.unit} | ${slo.deltaValue ?? 'n/d'} | ${slo.samples} | ${slo.complianceStatus} |`,
    ),
    '',
    '## Compromisos SLA',
    '',
    ...(slas.length
      ? slas.map(
          (sla) =>
            `- **${sla.name}** (${sla.coveredService}, estado: ${sla.approvalStatus}): cumplimiento observado **${sla.observedCompliance}**`,
        )
      : ['- Sin acuerdos SLA registrados formalmente.']),
    '',
    '## Incidentes del periodo',
    '',
    ...(incidents.length
      ? incidents.slice(0, 20).map(
          (inc) =>
            `- [${inc.status}] ${inc.service} · ${inc.title} (${inc.occurrenceCount} ocurrencias, inicio ${inc.startedAt})`,
        )
      : ['- Sin incidentes registrados.']),
    '',
    '## Limitaciones de la medición',
    '',
    ...dashboard.limitations.map((l) => `- ${l}`),
    '',
  ]

  return {
    generatedAt: dashboard.generatedAt,
    environment: dashboard.environment,
    period: dashboard.period,
    periodStart: dashboard.periodStart,
    periodEnd: dashboard.periodEnd,
    dashboard,
    slis,
    slas,
    runs: checksOverview.runs,
    totalRuns: checksOverview.totalRuns,
    recentErrors: logsPage.items,
    totalErrors: logsPage.total,
    incidents,
    markdown: markdownLines.join('\n'),
  }
}

import { AuthError } from '../../auth/types/errors.js'
import { sanitizeLogValue } from '../../../shared/utils/logger.js'
import type {
  CheckKind,
  CheckRunCategory,
  CheckStatus,
  ComparisonOperator,
  IncidentSeverity,
  IncidentStatus,
  ObservabilityEnvironment,
  ObservabilityPeriod,
  SlaApprovalStatus,
  SliCalculationMethod,
  SliDataSource,
  SliIndicatorType,
  SliUnit,
  SloStatus,
} from '../types/observability.js'

const ENVIRONMENTS = new Set<ObservabilityEnvironment>([
  'production',
  'staging',
  'development',
  'local',
  'ci',
  'test',
])
const PERIODS = new Set<ObservabilityPeriod>(['1h', '24h', '7d', '30d'])
const DATA_SOURCES = new Set<SliDataSource>([
  'operational_http',
  'synthetic_availability',
  'synthetic_functional',
  'automated_tests',
  'client_telemetry',
])
const INDICATOR_TYPES = new Set<SliIndicatorType>([
  'availability',
  'latency_mean',
  'latency_percentile',
  'latency_threshold_pct',
  'error_rate',
  'operation_success_rate',
  'reliability',
  'recovery_time',
  'functional_test_success',
])
const UNITS = new Set<SliUnit>(['%', 'ms', 's', 'rps'])
const OPERATORS = new Set<ComparisonOperator>(['>=', '<=', '>', '<'])
const SLO_STATUSES = new Set<SloStatus>(['active', 'inactive', 'archived'])
const SLA_APPROVALS = new Set<SlaApprovalStatus>([
  'draft',
  'internal_reference',
  'formally_approved',
  'expired',
])
const INCIDENT_STATUSES = new Set<IncidentStatus>([
  'open',
  'acknowledged',
  'resolved',
])
const RUN_CATEGORIES = new Set<CheckRunCategory>([
  'synthetic_periodic',
  'functional_automated',
  'manual_admin',
  'load_controlled',
  'ci_suite',
])
const CHECK_KINDS = new Set<CheckKind>([
  'synthetic_availability',
  'synthetic_functional',
  'automated_test',
  'load_scenario',
])
const CHECK_STATUSES = new Set<CheckStatus>([
  'passed',
  'failed',
  'not_executed',
  'skipped',
  'blocked',
])
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[a-z0-9_]{3,60}$/
const PATH_PREFIX_RE = /^\/[a-z0-9_/:.-]{0,99}$/i
const TELEMETRY_OPERATIONS = new Set([
  'sync', 'client.create', 'client.edit', 'client.status', 'training.save',
  'training.activate', 'training.zone', 'nutrition.save', 'nutrition.activate',
  'followup.visibility', 'evaluation.create',
])
const TELEMETRY_ERROR_CODES = new Set([
  'SERVICE_UNAVAILABLE', 'DATABASE_UNAVAILABLE', 'VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT', 'UNAUTHORIZED', 'FORBIDDEN', 'INVALID_INPUT',
  'CSRF_INVALID', 'NETWORK_ERROR', 'OFFLINE', 'TIMEOUT', 'INTERNAL_ERROR',
])

function badInput(message: string, fields?: Record<string, string>): never {
  throw new AuthError(400, 'INVALID_INPUT', message, fields)
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    badInput('El cuerpo de la solicitud debe ser un objeto válido.')
  }
  return value as Record<string, unknown>
}

function text(
  value: unknown,
  label: string,
  min: number,
  max: number,
  required = true,
): string {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) {
    if (!required) return ''
    badInput(`El campo ${label} es obligatorio.`)
  }
  if (str.length < min || str.length > max) {
    badInput(`El campo ${label} debe tener entre ${min} y ${max} caracteres.`)
  }
  return str
}

function optionalIsoDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') badInput(`La fecha de ${label} no es válida.`)
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) badInput(`La fecha de ${label} no es válida.`)
  return new Date(parsed).toISOString()
}

export function parseEnvironment(
  value: unknown,
  fallback: ObservabilityEnvironment = 'production',
): ObservabilityEnvironment {
  if (typeof value === 'string' && ENVIRONMENTS.has(value as ObservabilityEnvironment)) {
    return value as ObservabilityEnvironment
  }
  return fallback
}

function knownEnvironment(value: unknown, fallback: ObservabilityEnvironment) {
  if (value !== undefined && !ENVIRONMENTS.has(value as ObservabilityEnvironment)) {
    badInput('El ambiente indicado no está configurado.')
  }
  return parseEnvironment(value, fallback)
}

export function parsePeriod(
  value: unknown,
  fallback: ObservabilityPeriod = '24h',
): ObservabilityPeriod {
  if (typeof value === 'string' && PERIODS.has(value as ObservabilityPeriod)) {
    return value as ObservabilityPeriod
  }
  return fallback
}

export function validateDashboardQuery(
  query: Record<string, unknown>,
  defaultEnv: ObservabilityEnvironment,
) {
  return {
    environment: parseEnvironment(query.environment, defaultEnv),
    period: parsePeriod(query.period, '24h'),
    service:
      typeof query.service === 'string' && query.service.trim()
        ? query.service.trim().slice(0, 60)
        : undefined,
    module:
      typeof query.module === 'string' && query.module.trim()
        ? query.module.trim().slice(0, 60)
        : undefined,
  }
}

export function validateLogsQuery(
  query: Record<string, unknown>,
  defaultEnv: ObservabilityEnvironment,
) {
  const page = Math.min(1_000_000, Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1))
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.pageSize ?? '25'), 10) || 25),
  )
  const category =
    typeof query.category === 'string' &&
    [
      'all',
      'operational',
      'error',
      'audit',
      'test_result',
      'client_telemetry',
    ].includes(query.category)
      ? (query.category as
          | 'all'
          | 'operational'
          | 'error'
          | 'audit'
          | 'test_result'
          | 'client_telemetry')
      : 'all'

  return {
    environment:
      query.environment === 'all'
        ? undefined
        : parseEnvironment(query.environment, defaultEnv),
    category,
    from: optionalIsoDate(query.from, 'inicio'),
    to: optionalIsoDate(query.to, 'fin'),
    module:
      typeof query.module === 'string' && query.module.trim()
        ? query.module.trim().slice(0, 60)
        : undefined,
    service:
      typeof query.service === 'string' && query.service.trim()
        ? query.service.trim().slice(0, 60)
        : undefined,
    operation:
      typeof query.operation === 'string' && query.operation.trim()
        ? query.operation.trim().slice(0, 120)
        : undefined,
    severity:
      typeof query.severity === 'string' &&
      ['debug', 'info', 'warn', 'error', 'critical'].includes(query.severity)
        ? query.severity
        : undefined,
    outcome:
      typeof query.outcome === 'string' &&
      [
        'success',
        'client_error',
        'server_error',
        'aborted',
        'timeout',
        'recovered',
        'info',
      ].includes(query.outcome)
        ? query.outcome
        : undefined,
    correlationId:
      typeof query.correlationId === 'string' && query.correlationId.trim()
        ? query.correlationId.trim().slice(0, 128)
        : undefined,
    search:
      typeof query.search === 'string' && query.search.trim()
        ? query.search.trim().slice(0, 120)
        : undefined,
    page,
    pageSize,
  }
}

function validateCalculationMethod(raw: unknown): SliCalculationMethod {
  if (raw === undefined || raw === null) return {}
  const obj = asObject(raw)
  const out: SliCalculationMethod = {}
  if (obj.percentile !== undefined) {
    const p = Number(obj.percentile)
    if (!Number.isInteger(p) || p < 1 || p > 99) {
      badInput('El percentil debe ser un entero entre 1 y 99.')
    }
    out.percentile = p
  }
  if (obj.thresholdMs !== undefined) {
    const t = Number(obj.thresholdMs)
    if (!Number.isFinite(t) || t <= 0 || t > 120_000) {
      badInput('El umbral de latencia debe estar entre 1 y 120,000 ms.')
    }
    out.thresholdMs = t
  }
  if (typeof obj.module === 'string' && obj.module.trim()) {
    out.module = obj.module.trim().slice(0, 60)
  }
  if (Array.isArray(obj.methods)) {
    out.methods = obj.methods
      .map((m) => String(m).toUpperCase().trim())
      .filter((m) => HTTP_METHODS.has(m))
  }
  if (obj.pathPrefix !== undefined) {
    const prefix = text(obj.pathPrefix, 'prefijo de ruta', 1, 100)
    if (!PATH_PREFIX_RE.test(prefix)) badInput('El filtro de ruta debe ser un prefijo literal.')
    out.pathPrefix = prefix
  }
  if (obj.statusCodes !== undefined) {
    if (!Array.isArray(obj.statusCodes) || obj.statusCodes.some((code) => !Number.isInteger(code) || code < 100 || code > 599)) {
      badInput('Los códigos HTTP deben ser números enteros de 100 a 599.')
    }
    out.statusCodes = [...new Set<number>(obj.statusCodes)]
  }
  if (Array.isArray(obj.excludePaths)) {
    out.excludePaths = obj.excludePaths
      .slice(0, 10)
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0 && item.length <= 100)
    if (out.excludePaths.some((pattern) => !PATH_PREFIX_RE.test(pattern.replace(/^\^|\*$/g, '')))) {
      badInput('Las rutas excluidas deben ser prefijos literales.')
    }
  }
  if (typeof obj.includeNotExecuted === 'boolean') {
    out.includeNotExecuted = obj.includeNotExecuted
  }
  return out
}

export function validateSliInput(input: unknown, isUpdate = false) {
  const body = asObject(input)
  const code = isUpdate
    ? undefined
    : text(body.code, 'código del SLI', 3, 60).toLowerCase()
  if (code !== undefined && !CODE_RE.test(code)) {
    badInput(
      'El código del SLI solo puede usar minúsculas, números y guiones bajos (3-60).',
    )
  }
  const dataSource = String(body.dataSource ?? '') as SliDataSource
  if (!DATA_SOURCES.has(dataSource)) {
    badInput('La fuente de información del SLI no es válida.')
  }
  const indicatorType = String(body.indicatorType ?? '') as SliIndicatorType
  if (!INDICATOR_TYPES.has(indicatorType)) {
    badInput('El tipo de indicador SLI no es válido.')
  }
  const unit = String(body.unit ?? '') as SliUnit
  if (!UNITS.has(unit)) {
    badInput('La unidad de medida del SLI no es válida.')
  }
  const expectedUnit =
    indicatorType === 'recovery_time'
      ? 's'
      : indicatorType === 'latency_mean' || indicatorType === 'latency_percentile'
        ? 'ms'
        : '%'
  if (unit !== expectedUnit) badInput(`La unidad para este indicador debe ser ${expectedUnit}.`)
  if (
    (dataSource === 'client_telemetry' && !['error_rate', 'operation_success_rate', 'reliability'].includes(indicatorType)) ||
    (dataSource === 'operational_http' && ['recovery_time', 'functional_test_success'].includes(indicatorType))
  ) {
    badInput('La fuente elegida no admite el cálculo de este indicador.')
  }
  const evaluationPeriod = String(
    body.evaluationPeriod ?? '7d',
  ) as ObservabilityPeriod
  if (!PERIODS.has(evaluationPeriod)) {
    badInput('El periodo de evaluación del SLI debe ser 1h, 24h, 7d o 30d.')
  }
  const calculationMethod = validateCalculationMethod(body.calculationMethod)
  if (
    indicatorType === 'latency_percentile' &&
    calculationMethod.percentile === undefined
  ) {
    calculationMethod.percentile = 95
  }
  if (
    indicatorType === 'latency_threshold_pct' &&
    calculationMethod.thresholdMs === undefined
  ) {
    badInput(
      'Para un indicador de porcentaje bajo umbral de latencia debes indicar thresholdMs.',
    )
  }

  return {
    code,
    name: text(body.name, 'nombre', 3, 120),
    description: text(body.description, 'descripción', 3, 500),
    service: text(body.service, 'servicio', 2, 60),
    characteristic: text(body.characteristic, 'característica', 2, 100),
    dataSource,
    indicatorType,
    unit,
    calculationMethod,
    inclusionCriteria: text(
      body.inclusionCriteria,
      'criterios de inclusión',
      3,
      400,
    ),
    exclusionCriteria: text(
      body.exclusionCriteria,
      'criterios de exclusión',
      3,
      400,
    ),
    evaluationPeriod,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    changeReason:
      text(body.changeReason, 'motivo del cambio', 3, 300, false) || null,
  }
}

export function validateSloInput(input: unknown, isUpdate = false) {
  const body = asObject(input)
  const code = isUpdate
    ? undefined
    : text(body.code, 'código del SLO', 3, 60).toLowerCase()
  if (code !== undefined && !CODE_RE.test(code)) {
    badInput(
      'El código del SLO solo puede usar minúsculas, números y guiones bajos (3-60).',
    )
  }
  const sliId = text(body.sliId, 'SLI asociado', 36, 36)
  if (!UUID_RE.test(sliId)) {
    badInput('El identificador del SLI asociado no es válido.')
  }
  const targetValue = Number(body.targetValue)
  if (!Number.isFinite(targetValue) || targetValue < 0 || targetValue > 1_000_000) {
    badInput('El valor objetivo del SLO debe ser un número válido no negativo.')
  }
  const comparisonOperator = String(
    body.comparisonOperator ?? '',
  ) as ComparisonOperator
  if (!OPERATORS.has(comparisonOperator)) {
    badInput('El operador de comparación del SLO debe ser >=, <=, > o <.')
  }
  const unit = String(body.unit ?? '') as SliUnit
  if (!UNITS.has(unit)) {
    badInput('La unidad de medida del SLO no es válida.')
  }
  if (unit === '%' && targetValue > 100) badInput('Un objetivo porcentual debe estar entre 0 y 100.')
  const evaluationPeriod = String(
    body.evaluationPeriod ?? '7d',
  ) as ObservabilityPeriod
  if (!PERIODS.has(evaluationPeriod)) {
    badInput('El periodo de evaluación del SLO debe ser 1h, 24h, 7d o 30d.')
  }
  const minSamples = Number(body.minSamples ?? 1)
  if (!Number.isInteger(minSamples) || minSamples < 1 || minSamples > 100_000) {
    badInput('El mínimo de muestras debe ser un entero positivo.')
  }
  const effectiveFrom =
    optionalIsoDate(body.effectiveFrom, 'inicio de vigencia') ??
    new Date().toISOString()
  const effectiveTo = optionalIsoDate(body.effectiveTo, 'fin de vigencia')
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    badInput('La fecha de fin de vigencia debe ser posterior al inicio.')
  }
  const status = String(body.status ?? 'active') as SloStatus
  if (!SLO_STATUSES.has(status)) {
    badInput('El estado del SLO no es válido.')
  }

  return {
    code,
    sliId,
    name: text(body.name, 'nombre', 3, 140),
    description: text(body.description, 'descripción', 3, 600),
    targetValue: Math.round(targetValue * 1000) / 1000,
    comparisonOperator,
    unit,
    evaluationPeriod,
    minSamples,
    effectiveFrom,
    effectiveTo,
    status,
    // Los SLO configurados internamente nunca se promocionan automáticamente a SLA contractual.
    isContractual: false as const,
    changeReason:
      text(body.changeReason, 'motivo del cambio', 3, 300, false) || null,
  }
}

export function validateSlaInput(input: unknown) {
  const body = asObject(input)
  const approvalStatus = String(
    body.approvalStatus ?? 'draft',
  ) as SlaApprovalStatus
  if (!SLA_APPROVALS.has(approvalStatus)) {
    badInput('El estado de aprobación del SLA no es válido.')
  }
  const effectiveFrom =
    optionalIsoDate(body.effectiveFrom, 'inicio de vigencia') ??
    new Date().toISOString()
  const effectiveTo = optionalIsoDate(body.effectiveTo, 'fin de vigencia')
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    badInput('La fecha de fin de vigencia del SLA debe ser posterior al inicio.')
  }
  const rawSloIds = Array.isArray(body.sloIds) ? body.sloIds : []
  const sloIds = [...new Set(rawSloIds.map((id) => String(id).trim()))]
  if (sloIds.some((id) => !UUID_RE.test(id))) {
    badInput('Todos los SLO asociados al SLA deben ser identificadores válidos.')
  }

  return {
    name: text(body.name, 'nombre del acuerdo', 3, 160),
    coveredService: text(body.coveredService, 'servicio cubierto', 2, 120),
    commitments: text(body.commitments, 'compromisos establecidos', 3, 2000),
    approvalStatus,
    effectiveFrom,
    effectiveTo,
    responsibilities: text(body.responsibilities, 'responsabilidades', 3, 2000),
    exclusions: text(body.exclusions, 'exclusiones', 3, 2000),
    breachConsequences:
      text(body.breachConsequences, 'consecuencias por incumplimiento', 1, 2000, false) ||
      null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    sloIds,
  }
}

export function validateStatusToggle(input: unknown): {
  active: boolean
  reason: string | null
} {
  const body = asObject(input)
  if (typeof body.active !== 'boolean') {
    badInput('Debes indicar active como booleano.')
  }
  return {
    active: body.active,
    reason: text(body.reason, 'motivo', 3, 300, false) || null,
  }
}

export function validateSettingsInput(input: unknown) {
  const body = asObject(input)
  const interval = Number(body.checkIntervalMinutes)
  if (![5, 10, 15, 30, 60].includes(interval)) {
    badInput('La frecuencia permitida es 5, 10, 15, 30 o 60 minutos.')
  }
  const logRetentionDays = Number(body.logRetentionDays)
  if (!Number.isInteger(logRetentionDays) || logRetentionDays < 7 || logRetentionDays > 365) {
    badInput('La retención de logs debe estar entre 7 y 365 días.')
  }
  const checkRetentionDays = Number(body.checkRetentionDays)
  if (!Number.isInteger(checkRetentionDays) || checkRetentionDays < 14 || checkRetentionDays > 365) {
    badInput('La retención de pruebas debe estar entre 14 y 365 días.')
  }
  const evaluationRetentionDays = Number(body.evaluationRetentionDays)
  if (
    !Number.isInteger(evaluationRetentionDays) ||
    evaluationRetentionDays < 30 ||
    evaluationRetentionDays > 1095
  ) {
    badInput('La retención de evaluaciones debe estar entre 30 y 1095 días.')
  }
  const incidentErrorRateThresholdPct = Number(body.incidentErrorRateThresholdPct)
  if (
    !Number.isFinite(incidentErrorRateThresholdPct) ||
    incidentErrorRateThresholdPct <= 0 ||
    incidentErrorRateThresholdPct > 100
  ) {
    badInput('El umbral de error para incidentes debe estar entre 0.1 y 100 %.')
  }
  const incidentLatencyP95ThresholdMs = Number(body.incidentLatencyP95ThresholdMs)
  if (
    !Number.isInteger(incidentLatencyP95ThresholdMs) ||
    incidentLatencyP95ThresholdMs < 100 ||
    incidentLatencyP95ThresholdMs > 60_000
  ) {
    badInput('El umbral P95 de incidentes debe estar entre 100 y 60,000 ms.')
  }
  const incidentConsecutiveFailures = Number(body.incidentConsecutiveFailures)
  if (
    !Number.isInteger(incidentConsecutiveFailures) ||
    incidentConsecutiveFailures < 1 ||
    incidentConsecutiveFailures > 20
  ) {
    badInput('Los fallos consecutivos deben estar entre 1 y 20.')
  }

  return {
    monitorEnabled:
      typeof body.monitorEnabled === 'boolean' ? body.monitorEnabled : true,
    checkIntervalMinutes: interval as 5 | 10 | 15 | 30 | 60,
    logRetentionDays,
    checkRetentionDays,
    evaluationRetentionDays,
    incidentErrorRateThresholdPct:
      Math.round(incidentErrorRateThresholdPct * 100) / 100,
    incidentLatencyP95ThresholdMs,
    incidentConsecutiveFailures,
  }
}

export function validateIncidentUpdate(input: unknown) {
  const body = asObject(input)
  const status = String(body.status ?? '') as IncidentStatus
  if (!INCIDENT_STATUSES.has(status) || status === 'open') {
    badInput('Solo puedes cambiar el incidente a acknowledged o resolved.')
  }
  return {
    status,
    resolutionNotes:
      text(body.resolutionNotes, 'notas de seguimiento', 3, 500, false) || null,
  }
}

export function validateManualChecksRun(
  input: unknown,
  defaultEnv: ObservabilityEnvironment,
) {
  const body = input === undefined ? {} : asObject(input)
  if (knownEnvironment(body.environment, defaultEnv) !== defaultEnv) {
    badInput('Las comprobaciones manuales sólo pueden ejecutarse en el ambiente de esta instancia.')
  }
  const rawKeys = Array.isArray(body.checkKeys) ? body.checkKeys : undefined
  const checkKeys = rawKeys
    ? rawKeys.map((item) => String(item).trim()).filter(Boolean)
    : undefined
  return {
    environment: defaultEnv,
    checkKeys,
  }
}

export function validateIngestPayload(
  input: unknown,
  defaultEnv: ObservabilityEnvironment,
) {
  const body = asObject(input)
  const runRaw = asObject(body.run)
  const checksRaw = Array.isArray(body.checks) ? body.checks : null
  if (!checksRaw || checksRaw.length === 0 || checksRaw.length > 500) {
    badInput('La ingesta debe incluir entre 1 y 500 resultados de comprobación.')
  }
  const category = String(runRaw.category ?? 'synthetic_periodic') as CheckRunCategory
  if (!RUN_CATEGORIES.has(category) || category === 'manual_admin') {
    badInput('La categoría de la corrida no es válida.')
  }
  const environment = knownEnvironment(runRaw.environment, defaultEnv)
  if (environment === 'production' && (category === 'ci_suite' || category === 'load_controlled')) {
    badInput('Las corridas de CI y de carga deben usar un ambiente de pruebas.')
  }
  const startedAt =
    optionalIsoDate(runRaw.startedAt, 'inicio de corrida') ??
    new Date().toISOString()
  const finishedAt =
    optionalIsoDate(runRaw.finishedAt, 'fin de corrida') ??
    new Date().toISOString()
  if (Date.parse(finishedAt) < Date.parse(startedAt) || Date.parse(finishedAt) > Date.now() + 5 * 60_000) {
    badInput('La fecha de fin de corrida no es válida.')
  }

  const checks = checksRaw.map((raw) => {
    const item = asObject(raw)
    const kind = String(item.checkKind ?? 'synthetic_availability') as CheckKind
    const status = String(item.status ?? 'failed') as CheckStatus
    if (!CHECK_KINDS.has(kind)) badInput('checkKind inválido en ingesta.')
    if (!CHECK_STATUSES.has(status)) badInput('status inválido en ingesta.')
    if (knownEnvironment(item.environment, environment) !== environment) {
      badInput('Todos los resultados deben pertenecer al ambiente de la corrida.')
    }
    const executedAt = optionalIsoDate(item.executedAt, 'fecha de ejecución') ?? finishedAt
    if (Date.parse(executedAt) > Date.parse(finishedAt)) {
      badInput('Un resultado no puede ser posterior al fin de su corrida.')
    }
    return {
      externalEventId: text(item.externalEventId, 'externalEventId', 4, 160),
      correlationId: text(
        item.correlationId ?? runRaw.externalRunId ?? 'external-run',
        'correlationId',
        1,
        128,
      ),
      checkKey: text(item.checkKey, 'checkKey', 2, 100),
      checkName: sanitizedText(item.checkName, 'checkName', 2, 160),
      checkKind: kind,
      service: text(item.service ?? 'api', 'service', 1, 60),
      module: text(item.module ?? 'system', 'module', 1, 60),
      environment,
      target: sanitizedTarget(item.target),
      phase: text(item.phase ?? 'regular', 'phase', 1, 40),
      executedAt,
      expectedResult: sanitizedText(item.expectedResult, 'resultado esperado', 1, 400),
      actualResult: sanitizedText(item.actualResult, 'resultado obtenido', 1, 400),
      status,
      durationMs:
        item.durationMs === null || item.durationMs === undefined
          ? null
          : Math.max(0, Math.round(Number(item.durationMs) * 10) / 10),
      httpStatus:
        typeof item.httpStatus === 'number' &&
        Number.isInteger(item.httpStatus) &&
        item.httpStatus >= 100 &&
        item.httpStatus <= 599
          ? item.httpStatus
          : null,
      errorCode: text(item.errorCode, 'errorCode', 1, 120, false) || null,
      errorMessage: sanitizedText(item.errorMessage, 'errorMessage', 1, 500, false) || null,
      assertions: Array.isArray(item.assertions)
        ? item.assertions.slice(0, 20).map((assertion) => {
          const fields = asObject(assertion)
          if (typeof fields.ok !== 'boolean') badInput('El resultado de la aserción debe ser booleano.')
          return {
            name: sanitizedText(fields.name, 'aserción', 1, 120),
            ok: fields.ok,
          }
        })
        : [],
    }
  })
  if (new Set(checks.map((check) => check.externalEventId)).size !== checks.length) {
    badInput('Los identificadores de resultados de una corrida deben ser únicos.')
  }

  const passedChecks = checks.filter((c) => c.status === 'passed').length
  const failedChecks = checks.filter((c) => c.status === 'failed').length
  const notExecutedChecks = checks.filter((c) => c.status === 'not_executed' || c.status === 'blocked').length
  const skippedChecks = checks.filter((c) => c.status === 'skipped').length
  const runStatus =
    typeof runRaw.status === 'string' &&
    ['passed', 'failed', 'partial', 'not_executed', 'blocked'].includes(
      runRaw.status,
    )
      ? runRaw.status
      : failedChecks > 0 && passedChecks > 0
        ? 'partial'
        : failedChecks > 0
          ? 'failed'
          : passedChecks > 0
            ? 'passed'
            : 'not_executed'

  return {
    run: {
      externalRunId: text(runRaw.externalRunId, 'externalRunId', 4, 160),
      category,
      environment,
      triggerSource:
        typeof runRaw.triggerSource === 'string' &&
        [
          'github_actions',
          'external_cli',
          'admin_manual',
          'local_runner',
          'ci',
        ].includes(runRaw.triggerSource)
          ? runRaw.triggerSource
          : 'external_cli',
      status: runStatus,
      startedAt,
      finishedAt,
      durationMs: Math.max(0, Math.round(Number(runRaw.durationMs ?? 0) * 10) / 10),
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      notExecutedChecks,
      skippedChecks,
      commitSha: text(runRaw.commitSha, 'commitSha', 1, 80, false) || null,
      notes: sanitizedText(runRaw.notes, 'notes', 1, 400, false) || null,
    },
    checks,
  }
}

function sanitizedText(value: unknown, label: string, min: number, max: number, required = true): string {
  return String(sanitizeLogValue(text(value, label, min, max, required))).slice(0, max)
}

function sanitizedTarget(value: unknown): string | null {
  const target = text(value, 'target', 1, 300, false)
  if (!target) return null
  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target)
      return sanitizedText(`${url.origin}${url.pathname}`, 'target', 1, 300)
    } catch {
      return null
    }
  }
  return sanitizedText(target.split(/[?#]/, 1)[0], 'target', 1, 300, false) || null
}

export function validateClientTelemetryPayload(
  input: unknown,
  defaultEnv: ObservabilityEnvironment,
) {
  const body = asObject(input)
  const eventType = String(body.eventType ?? '')
  if (
    ![
      'client.sync_failed',
      'client.sync_conflict',
      'client.sync_recovered',
      'client.network_error',
    ].includes(eventType)
  ) {
    badInput('Tipo de evento cliente no soportado.')
  }
  if (knownEnvironment(body.environment, defaultEnv) !== defaultEnv) {
    badInput('La telemetría debe pertenecer al ambiente de esta instancia.')
  }
  const operation = typeof body.operation === 'string' && TELEMETRY_OPERATIONS.has(body.operation) ? body.operation : 'sync'
  const code = typeof body.errorCode === 'string' && TELEMETRY_ERROR_CODES.has(body.errorCode) ? body.errorCode : null
  return {
    environment: defaultEnv,
    client: body.client === 'mobile' ? 'mobile' : 'web',
    eventType,
    module: 'offline_sync',
    operation,
    errorCode: code,
    statusCode:
      typeof body.statusCode === 'number' &&
      Number.isInteger(body.statusCode) &&
      body.statusCode >= 100 &&
      body.statusCode <= 599
        ? body.statusCode
        : null,
  }
}

export function validateUuidParam(value: string, label: string): string {
  if (!UUID_RE.test(value)) {
    badInput(`El identificador de ${label} no es válido.`)
  }
  return value
}

export function validateIncidentSeverity(value: unknown): IncidentSeverity {
  if (
    typeof value === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(value)
  ) {
    return value as IncidentSeverity
  }
  return 'medium'
}

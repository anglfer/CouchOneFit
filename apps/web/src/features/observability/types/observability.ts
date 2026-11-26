export type ObservabilityEnvironment =
  'production' | 'staging' | 'development' | 'local' | 'ci' | 'test';

export type ObservabilityPeriod = '1h' | '24h' | '7d' | '30d';
export type ServiceHealthState =
  'operational' | 'degraded' | 'unavailable' | 'insufficient_data';
export type ComplianceStatus = 'met' | 'unmet' | 'insufficient_data';

export type SliDataSource =
  | 'operational_http'
  | 'synthetic_availability'
  | 'synthetic_functional'
  | 'automated_tests'
  | 'client_telemetry';

export type SliIndicatorType =
  | 'availability'
  | 'latency_mean'
  | 'latency_percentile'
  | 'latency_threshold_pct'
  | 'error_rate'
  | 'operation_success_rate'
  | 'reliability'
  | 'recovery_time'
  | 'functional_test_success';

export type SliUnit = '%' | 'ms' | 's' | 'rps';
export type ComparisonOperator = '>=' | '<=' | '>' | '<';
export type SloStatus = 'active' | 'inactive' | 'archived';
export type SlaApprovalStatus =
  'draft' | 'internal_reference' | 'formally_approved' | 'expired';

export interface ServiceStatusSummary {
  id: 'web' | 'api' | 'database';
  name: string;
  state: ServiceHealthState;
  lastCheckedAt: string | null;
  availabilityPct: number | null;
  latencyP95Ms: number | null;
  detail: string;
}

export interface TimeSeriesPoint {
  bucket: string;
  requestsTotal: number;
  errorRatePct: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  availabilityPct: number | null;
  checksPassed: number;
  checksFailed: number;
}

export interface SliCalculationMethod {
  percentile?: number;
  thresholdMs?: number;
  module?: string;
  methods?: string[];
  pathPrefix?: string;
  statusCodes?: number[];
  excludePaths?: string[];
  includeNotExecuted?: boolean;
}

export interface SliWithValue {
  id: string;
  code: string;
  currentVersion: number;
  name: string;
  description: string;
  service: string;
  characteristic: string;
  dataSource: SliDataSource;
  indicatorType: SliIndicatorType;
  unit: SliUnit;
  calculationMethod: SliCalculationMethod;
  inclusionCriteria: string;
  exclusionCriteria: string;
  evaluationPeriod: ObservabilityPeriod;
  isActive: boolean;
  observedValue: number | null;
  samples: number;
  notExecutedCount: number;
  note: string | null;
}

export interface SliVersionRecord {
  id: string;
  sliId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedByUsername: string | null;
  changeReason: string | null;
  createdAt: string;
}

export interface SloEvaluated {
  id: string;
  code: string;
  sliId: string;
  sliCode?: string;
  sliName?: string;
  currentVersion: number;
  name: string;
  description: string;
  targetValue: number;
  comparisonOperator: ComparisonOperator;
  unit: SliUnit;
  evaluationPeriod: ObservabilityPeriod;
  minSamples: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: SloStatus;
  isContractual: boolean;
  periodStart: string;
  periodEnd: string;
  observedValue: number | null;
  deltaValue: number | null;
  samples: number;
  notExecutedCount: number;
  complianceStatus: ComplianceStatus;
  errorBudgetTotal: number | null;
  errorBudgetConsumed: number | null;
  errorBudgetRemainingPct: number | null;
  trendDirection: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  previousObservedValue: number | null;
  notes: string | null;
}

export interface SloVersionRecord {
  id: string;
  sloId: string;
  version: number;
  sliVersion: number;
  targetValue: number;
  comparisonOperator: ComparisonOperator;
  unit: string;
  evaluationPeriod: string;
  minSamples: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changedByUsername: string | null;
  changeReason: string | null;
  createdAt: string;
}

export interface SloEvaluationRecord {
  id: string;
  sloId: string;
  sloVersion: number;
  environment: ObservabilityEnvironment;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  observedValue: number | null;
  deltaValue: number | null;
  samples: number;
  notExecutedCount: number;
  complianceStatus: ComplianceStatus;
  errorBudgetRemainingPct: number | null;
  notes: string | null;
  evaluatedAt: string;
}

export interface SlaAgreement {
  id: string;
  name: string;
  coveredService: string;
  commitments: string;
  approvalStatus: SlaApprovalStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  responsibilities: string;
  exclusions: string;
  breachConsequences: string | null;
  isActive: boolean;
  sloIds: string[];
  slos: SloEvaluated[];
  observedCompliance: ComplianceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LogRecordItem {
  id: string;
  category:
    'operational' | 'error' | 'audit' | 'test_result' | 'client_telemetry';
  correlationId: string;
  occurredAt: string;
  environment: string;
  service: string;
  module: string;
  source: string;
  eventType: string;
  severity: string;
  operation: string;
  normalizedPath: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  durationMs: number | null;
  outcome: string;
  errorCode: string | null;
  errorMessage: string | null;
  systemVersion: string | null;
  metadata: Record<string, unknown>;
}

export interface IncidentRecord {
  id: string;
  dedupeKey: string;
  environment: ObservabilityEnvironment;
  service: string;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  summary: string;
  startedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  recoveryDurationS: number | null;
  occurrenceCount: number;
  correlationId: string | null;
  sloId: string | null;
  acknowledgedByUsername: string | null;
  resolutionNotes: string | null;
  updatedAt: string;
}

export interface DashboardSummary {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  services: ServiceStatusSummary[];
  kpis: {
    availabilityPct: number | null;
    avgLatencyMs: number | null;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    requestsTotal: number;
    requestsSucceeded: number;
    requestsFailed: number;
    errorRatePct: number | null;
    checksPassed: number;
    checksFailed: number;
    checksNotExecuted: number;
    slosMet: number;
    slosUnmet: number;
    slosInsufficient: number;
    openIncidents: number;
  };
  modules: Array<{
    module: string;
    requestsTotal: number;
    errorRatePct: number | null;
    p95LatencyMs: number | null;
    checksPassed: number;
    checksFailed: number;
    state: ServiceHealthState;
  }>;
  history: TimeSeriesPoint[];
  activeIncidents: IncidentRecord[];
  slos: SloEvaluated[];
  limitations: string[];
}

export interface AuthorizedCheckDescriptor {
  key: string;
  name: string;
  description: string;
  service: string;
  module: string;
  kind: string;
  safeInProduction: boolean;
  configured: boolean;
}

export type CheckRunStatus =
  'passed' | 'failed' | 'partial' | 'not_executed' | 'blocked';

export interface CheckRunRecord {
  id: string;
  externalRunId: string | null;
  category: string;
  environment: ObservabilityEnvironment;
  triggerSource: string;
  status: CheckRunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  notExecutedChecks: number;
  skippedChecks: number;
  commitSha: string | null;
  notes: string | null;
}

export interface ChecksOverview {
  environment: ObservabilityEnvironment;
  runtimeEnvironment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
  page: number;
  pageSize: number;
  totalRuns: number;
  settings: ObservabilitySettings;
  authorizedChecks: AuthorizedCheckDescriptor[];
  runs: CheckRunRecord[];
  latestChecks: CheckResultRecord[];
}

export interface CheckResultRecord {
  id: string;
  runId: string;
  correlationId: string;
  checkKey: string;
  checkName: string;
  checkKind: string;
  service: string;
  module: string;
  environment: ObservabilityEnvironment;
  target: string | null;
  phase: string;
  executedAt: string;
  expectedResult: string;
  actualResult: string;
  status: 'passed' | 'failed' | 'not_executed' | 'skipped' | 'blocked';
  durationMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  assertions: Array<{ name: string; ok: boolean; detail?: string }>;
}

export interface ObservabilitySettings {
  monitorEnabled: boolean;
  checkIntervalMinutes: 5 | 10 | 15 | 30 | 60;
  logRetentionDays: number;
  checkRetentionDays: number;
  evaluationRetentionDays: number;
  incidentErrorRateThresholdPct: number;
  incidentLatencyP95ThresholdMs: number;
  incidentConsecutiveFailures: number;
  updatedAt: string;
}

export interface PeriodReportPayload {
  generatedAt: string;
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
  periodStart: string;
  periodEnd: string;
  dashboard: DashboardSummary;
  slis: SliWithValue[];
  slas: SlaAgreement[];
  runs: CheckRunRecord[];
  totalRuns: number;
  recentErrors: LogRecordItem[];
  totalErrors: number;
  incidents: IncidentRecord[];
  markdown: string;
}

// ---------------------------------------------------------------------------
// SLA v3.0 (cumplimiento mensual, bitácora y exportaciones)
// ---------------------------------------------------------------------------

export const SLA_RECORD_KINDS = [
  'maintenance_window',
  'provider_incident',
  'support_incident',
  'backup',
  'restore_drill',
  'access_cleanup',
  'storage_measurement',
  'load_test',
  'monthly_report',
  'deployment',
] as const;
export type SlaRecordKind = (typeof SLA_RECORD_KINDS)[number];

export const SLA_SLI_STATUSES = [
  'met',
  'unmet',
  'insufficient_sample',
  'no_data',
  'unverified',
] as const;
export type SlaSliStatus = (typeof SLA_SLI_STATUSES)[number];

const SLA_GROUPS = [
  'function',
  'platform',
  'capacity',
  'continuity',
  'operation',
] as const;
export type SlaSliGroup = (typeof SLA_GROUPS)[number];
export type SlaSeverity = 'alta' | 'media' | 'baja';
export type SlaUnit = '%' | 'ms' | 's' | 'h';

export interface SlaRecord {
  id: string;
  kind: SlaRecordKind;
  occurredAt: string;
  endedAt: string | null;
  details: Record<string, unknown>;
  source: 'admin' | 'automation';
}

export interface SlaSli {
  id: string;
  group: SlaSliGroup;
  category: string;
  name: string;
  slo: string;
  comparison: '>=' | '<=';
  target: number;
  unit: SlaUnit;
  observed: number | null;
  attributable: number | null;
  samples: number;
  status: SlaSliStatus;
  details?: string;
}

export interface SlaIncidentResult {
  id: string;
  severity: SlaSeverity;
  receivedAt: string;
  ackDeadline: string;
  acknowledgedAt: string | null;
  ackOnTime: boolean | null;
  resolveDeadline: string;
  resolvedAt: string | null;
  resolvedOnTime: boolean | null;
  attributable: boolean;
  cause: string;
}

export interface SlaMaintenanceResult {
  id: string;
  start: string;
  end: string;
  notifiedAt: string | null;
  counted: boolean;
  reason: string;
}

export interface SlaV3Report {
  version: '3.0';
  month: string;
  timeZone: 'America/Mexico_City';
  period: { start: string; end: string };
  generatedAt: string;
  slis: SlaSli[];
  incidents: SlaIncidentResult[];
  maintenanceWindows: SlaMaintenanceResult[];
  compensation: { due: boolean; reasons: string[] };
  summary: {
    total: number;
    met: number;
    unmet: number;
    insufficient: number;
    noData: number;
    unverified: number;
  };
}

type JsonObject = Record<string, unknown>;

function invalid(what: string): never {
  throw new Error(`Respuesta de SLA v3.0 no válida: ${what}.`);
}

function asObject(value: unknown, what: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    invalid(what);
  return value as JsonObject;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) invalid(what);
  return value;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string') invalid(what);
  return value;
}

function asNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(what);
  return value;
}

function asBoolean(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') invalid(what);
  return value;
}

function asNullable<T>(
  value: unknown,
  parse: (item: unknown, what: string) => T,
  what: string
): T | null {
  return value === null || value === undefined ? null : parse(value, what);
}

function asOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  what: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(what);
  return value as T;
}

export function parseSlaRecord(input: unknown): SlaRecord {
  const item = asObject(input, 'registro');
  return {
    id: asString(item.id, 'registro.id'),
    kind: asOneOf(item.kind, SLA_RECORD_KINDS, 'registro.kind'),
    occurredAt: asString(item.occurredAt, 'registro.occurredAt'),
    endedAt: asNullable(item.endedAt, asString, 'registro.endedAt'),
    details: asObject(item.details ?? {}, 'registro.details'),
    source: asOneOf(item.source, ['admin', 'automation'], 'registro.source'),
  };
}

export function parseSlaRecords(input: unknown): SlaRecord[] {
  const body = asObject(input, 'respuesta');
  return asArray(body.records, 'records').map(parseSlaRecord);
}

function parseSlaSli(input: unknown): SlaSli {
  const item = asObject(input, 'indicador');
  const sli: SlaSli = {
    id: asString(item.id, 'indicador.id'),
    group: asOneOf(item.group, SLA_GROUPS, 'indicador.group'),
    category: asString(item.category ?? '', 'indicador.category'),
    name: asString(item.name, 'indicador.name'),
    slo: asString(item.slo, 'indicador.slo'),
    comparison: asOneOf(item.comparison, ['>=', '<='], 'indicador.comparison'),
    target: asNumber(item.target, 'indicador.target'),
    unit: asOneOf(item.unit, ['%', 'ms', 's', 'h'], 'indicador.unit'),
    observed: asNullable(item.observed, asNumber, 'indicador.observed'),
    attributable: asNullable(
      item.attributable,
      asNumber,
      'indicador.attributable'
    ),
    samples: asNumber(item.samples, 'indicador.samples'),
    status: asOneOf(item.status, SLA_SLI_STATUSES, 'indicador.status'),
  };
  if (typeof item.details === 'string' && item.details)
    sli.details = item.details;
  return sli;
}

function parseSlaIncident(input: unknown): SlaIncidentResult {
  const item = asObject(input, 'incidente');
  return {
    id: asString(item.id, 'incidente.id'),
    severity: asOneOf(
      item.severity,
      ['alta', 'media', 'baja'],
      'incidente.severity'
    ),
    receivedAt: asString(item.receivedAt, 'incidente.receivedAt'),
    ackDeadline: asString(item.ackDeadline, 'incidente.ackDeadline'),
    acknowledgedAt: asNullable(
      item.acknowledgedAt,
      asString,
      'incidente.acknowledgedAt'
    ),
    ackOnTime: asNullable(item.ackOnTime, asBoolean, 'incidente.ackOnTime'),
    resolveDeadline: asString(
      item.resolveDeadline,
      'incidente.resolveDeadline'
    ),
    resolvedAt: asNullable(item.resolvedAt, asString, 'incidente.resolvedAt'),
    resolvedOnTime: asNullable(
      item.resolvedOnTime,
      asBoolean,
      'incidente.resolvedOnTime'
    ),
    attributable: asBoolean(item.attributable, 'incidente.attributable'),
    cause: asString(item.cause ?? '', 'incidente.cause'),
  };
}

function parseSlaMaintenance(input: unknown): SlaMaintenanceResult {
  const item = asObject(input, 'ventana');
  return {
    id: asString(item.id, 'ventana.id'),
    start: asString(item.start, 'ventana.start'),
    end: asString(item.end, 'ventana.end'),
    notifiedAt: asNullable(item.notifiedAt, asString, 'ventana.notifiedAt'),
    counted: asBoolean(item.counted, 'ventana.counted'),
    reason: asString(item.reason ?? '', 'ventana.reason'),
  };
}

export function parseSlaV3Report(input: unknown): SlaV3Report {
  const body = asObject(input, 'respuesta');
  const report = asObject(body.report, 'report');
  const period = asObject(report.period, 'report.period');
  const compensation = asObject(report.compensation, 'report.compensation');
  const summary = asObject(report.summary, 'report.summary');
  return {
    version: asOneOf(report.version, ['3.0'], 'report.version'),
    month: asString(report.month, 'report.month'),
    timeZone: asOneOf(
      report.timeZone,
      ['America/Mexico_City'],
      'report.timeZone'
    ),
    period: {
      start: asString(period.start, 'period.start'),
      end: asString(period.end, 'period.end'),
    },
    generatedAt: asString(report.generatedAt, 'report.generatedAt'),
    slis: asArray(report.slis, 'report.slis').map(parseSlaSli),
    incidents: asArray(report.incidents ?? [], 'report.incidents').map(
      parseSlaIncident
    ),
    maintenanceWindows: asArray(
      report.maintenanceWindows ?? [],
      'report.maintenanceWindows'
    ).map(parseSlaMaintenance),
    compensation: {
      due: asBoolean(compensation.due, 'compensation.due'),
      reasons: asArray(compensation.reasons ?? [], 'compensation.reasons').map(
        (reason) => asString(reason, 'compensation.reasons[]')
      ),
    },
    summary: {
      total: asNumber(summary.total, 'summary.total'),
      met: asNumber(summary.met, 'summary.met'),
      unmet: asNumber(summary.unmet, 'summary.unmet'),
      insufficient: asNumber(summary.insufficient, 'summary.insufficient'),
      noData: asNumber(summary.noData, 'summary.noData'),
      unverified: asNumber(summary.unverified, 'summary.unverified'),
    },
  };
}

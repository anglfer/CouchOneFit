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

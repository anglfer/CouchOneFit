import { sessionMutation, sessionRequest } from '../../auth/services/session';
import type {
  CheckResultRecord,
  CheckRunStatus,
  ChecksOverview,
  DashboardSummary,
  IncidentRecord,
  LogRecordItem,
  ObservabilityEnvironment,
  ObservabilityPeriod,
  ObservabilitySettings,
  PeriodReportPayload,
  SlaAgreement,
  SlaRecord,
  SlaRecordKind,
  SlaV3Report,
  SliVersionRecord,
  SliWithValue,
  SloEvaluated,
  SloEvaluationRecord,
  SloVersionRecord,
} from '../types/observability';
import {
  parseSlaRecord,
  parseSlaRecords,
  parseSlaV3Report,
} from '../types/observability';

const BASE = '/api/admin/observability';

function qs(
  params: Record<string, string | number | undefined | null>
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      sp.set(key, String(value));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}

export function readDashboard(params: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
  service?: string;
  module?: string;
}) {
  return sessionRequest<DashboardSummary>(`${BASE}/dashboard${qs(params)}`);
}

export function readLogs(params: {
  environment?: ObservabilityEnvironment | 'all';
  category?: string;
  from?: string;
  to?: string;
  module?: string;
  service?: string;
  operation?: string;
  severity?: string;
  outcome?: string;
  correlationId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return sessionRequest<{
    total: number;
    page: number;
    pageSize: number;
    items: LogRecordItem[];
  }>(`${BASE}/logs${qs(params)}`);
}

export function readLogDetail(id: string) {
  return sessionRequest<{ item: LogRecordItem; related: LogRecordItem[] }>(
    `${BASE}/logs/${encodeURIComponent(id)}`
  );
}

export function exportLogsUrl(
  params: Record<string, string | number | undefined | null>,
  format: 'csv' | 'json'
): string {
  return `${BASE}/logs/export${qs({ ...params, format })}`;
}

export function readSlis(
  environment: ObservabilityEnvironment,
  period: ObservabilityPeriod
) {
  return sessionRequest<{
    environment: ObservabilityEnvironment;
    period: ObservabilityPeriod;
    items: SliWithValue[];
  }>(`${BASE}/slis${qs({ environment, period })}`);
}

export function createSli(body: Record<string, unknown>) {
  return sessionMutation<{ sli: SliWithValue }>(`${BASE}/slis`, body, 'POST');
}

export function updateSli(id: string, body: Record<string, unknown>) {
  return sessionMutation<{ sli: SliWithValue }>(
    `${BASE}/slis/${encodeURIComponent(id)}`,
    body,
    'PUT'
  );
}

export function toggleSliStatus(id: string, active: boolean, reason?: string) {
  return sessionMutation<{ sli: SliWithValue }>(
    `${BASE}/slis/${encodeURIComponent(id)}/status`,
    { active, reason },
    'PATCH'
  );
}

export function readSliVersions(id: string) {
  return sessionRequest<{ versions: SliVersionRecord[] }>(
    `${BASE}/slis/${encodeURIComponent(id)}/versions`
  );
}

export function readSlos(
  environment: ObservabilityEnvironment,
  period: ObservabilityPeriod
) {
  return sessionRequest<{
    environment: ObservabilityEnvironment;
    period: ObservabilityPeriod;
    items: SloEvaluated[];
  }>(`${BASE}/slos${qs({ environment, period })}`);
}

export function createSlo(body: Record<string, unknown>) {
  return sessionMutation<{ slo: SloEvaluated }>(`${BASE}/slos`, body, 'POST');
}

export function updateSlo(id: string, body: Record<string, unknown>) {
  return sessionMutation<{ slo: SloEvaluated }>(
    `${BASE}/slos/${encodeURIComponent(id)}`,
    body,
    'PUT'
  );
}

export function toggleSloStatus(id: string, active: boolean, reason?: string) {
  return sessionMutation<{ slo: SloEvaluated }>(
    `${BASE}/slos/${encodeURIComponent(id)}/status`,
    { active, reason },
    'PATCH'
  );
}

export function evaluateSlosNow(
  environment: ObservabilityEnvironment,
  period: ObservabilityPeriod
) {
  return sessionMutation<{
    environment: ObservabilityEnvironment;
    period: ObservabilityPeriod;
    items: SloEvaluated[];
    persisted: number;
  }>(`${BASE}/slos/evaluate`, { environment, period }, 'POST');
}

export function readSloHistory(
  id: string,
  environment: ObservabilityEnvironment
) {
  return sessionRequest<{
    versions: SloVersionRecord[];
    evaluations: SloEvaluationRecord[];
  }>(`${BASE}/slos/${encodeURIComponent(id)}/history${qs({ environment })}`);
}

export function readSlas(
  environment: ObservabilityEnvironment,
  period: ObservabilityPeriod
) {
  return sessionRequest<{
    environment: ObservabilityEnvironment;
    period: ObservabilityPeriod;
    items: SlaAgreement[];
  }>(`${BASE}/slas${qs({ environment, period })}`);
}

export function createSla(body: Record<string, unknown>) {
  return sessionMutation<{ id: string }>(`${BASE}/slas`, body, 'POST');
}

export function updateSla(id: string, body: Record<string, unknown>) {
  return sessionMutation<{ id: string }>(
    `${BASE}/slas/${encodeURIComponent(id)}`,
    body,
    'PUT'
  );
}

export function toggleSlaStatus(id: string, active: boolean, reason?: string) {
  return sessionMutation<{ id: string; isActive: boolean }>(
    `${BASE}/slas/${encodeURIComponent(id)}/status`,
    { active, reason },
    'PATCH'
  );
}

export function readChecks(params: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
  page: number;
  pageSize: number;
  runId?: string;
}) {
  return sessionRequest<ChecksOverview>(`${BASE}/checks${qs(params)}`);
}

export function runManualChecks(
  environment: ObservabilityEnvironment,
  checkKeys?: string[]
) {
  return sessionMutation<{
    runId: string;
    environment: ObservabilityEnvironment;
    status: CheckRunStatus;
    checks: Array<Pick<CheckResultRecord, 'checkKey' | 'status'>>;
  }>(`${BASE}/checks/run`, { environment, checkKeys }, 'POST');
}

export function updateObservabilitySettings(body: Record<string, unknown>) {
  return sessionMutation<{ settings: ObservabilitySettings }>(
    `${BASE}/settings`,
    body,
    'PUT'
  );
}

export function runMaintenancePrune() {
  return sessionMutation<{
    deletedLogs: number;
    deletedChecks: number;
    deletedEvaluations: number;
  }>(`${BASE}/maintenance/prune`, {}, 'POST');
}

export function readIncidents(
  environment: ObservabilityEnvironment | 'all',
  status?: string
) {
  return sessionRequest<{ items: IncidentRecord[] }>(
    `${BASE}/incidents${qs({ environment, status })}`
  );
}

export function updateIncident(
  id: string,
  status: 'acknowledged' | 'resolved',
  resolutionNotes?: string
) {
  return sessionMutation<{ incident: IncidentRecord }>(
    `${BASE}/incidents/${encodeURIComponent(id)}`,
    { status, resolutionNotes },
    'PATCH'
  );
}

export function readPeriodReport(
  environment: ObservabilityEnvironment,
  period: ObservabilityPeriod
) {
  return sessionRequest<PeriodReportPayload>(
    `${BASE}/reports${qs({ environment, period })}`
  );
}

export type SlaExportKind = 'requests' | 'probes' | 'incidents' | 'operations';

export async function readSlaV3Report(
  environment: ObservabilityEnvironment,
  month: string
): Promise<SlaV3Report> {
  const body = await sessionRequest<unknown>(
    `${BASE}/sla-v3/report${qs({ environment, month })}`
  );
  return parseSlaV3Report(body);
}

export function slaV3ExportUrl(
  kind: SlaExportKind,
  environment: ObservabilityEnvironment,
  month: string
): string {
  return `${BASE}/sla-v3/export/${kind}.csv${qs({ environment, month })}`;
}

export async function readSlaRecords(
  environment: ObservabilityEnvironment,
  month: string
): Promise<SlaRecord[]> {
  const body = await sessionRequest<unknown>(
    `${BASE}/sla-v3/records${qs({ environment, month })}`
  );
  return parseSlaRecords(body);
}

export async function createSlaRecord(body: {
  environment: ObservabilityEnvironment;
  kind: SlaRecordKind;
  occurredAt: string;
  endedAt?: string;
  details: Record<string, unknown>;
}): Promise<SlaRecord> {
  const res = await sessionMutation<unknown>(
    `${BASE}/sla-v3/records`,
    body,
    'POST'
  );
  const wrapper = res as { record?: unknown } | null;
  return parseSlaRecord(wrapper?.record);
}

export function deleteSlaRecord(id: string) {
  return sessionMutation<void>(
    `${BASE}/sla-v3/records/${encodeURIComponent(id)}`,
    {},
    'DELETE'
  );
}

export async function measureSlaStorage(
  environment: ObservabilityEnvironment
): Promise<SlaRecord> {
  const res = await sessionMutation<unknown>(
    `${BASE}/sla-v3/storage`,
    { environment },
    'POST'
  );
  const wrapper = res as { record?: unknown } | null;
  return parseSlaRecord(wrapper?.record);
}

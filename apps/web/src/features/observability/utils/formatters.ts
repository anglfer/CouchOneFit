import type { Tone } from '../../../components/ui';
import type {
  CheckResultRecord,
  CheckRunStatus,
  ComplianceStatus,
  ObservabilityEnvironment,
  ObservabilityPeriod,
  ServiceHealthState,
  SlaApprovalStatus,
} from '../types/observability';

export const ENVIRONMENT_OPTIONS: Array<{
  value: ObservabilityEnvironment;
  label: string;
}> = [
  { value: 'production', label: 'Producción' },
  { value: 'local', label: 'Local' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'ci', label: 'CI' },
  { value: 'staging', label: 'Staging' },
  { value: 'test', label: 'Pruebas' },
];

export const PERIOD_OPTIONS: Array<{
  value: ObservabilityPeriod;
  label: string;
}> = [
  { value: '1h', label: 'Última hora' },
  { value: '24h', label: 'Últimas 24 h' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
];

export function healthStateMeta(state: ServiceHealthState): {
  label: string;
  tone: Tone;
} {
  switch (state) {
    case 'operational':
      return { label: 'Operativo', tone: 'ok' };
    case 'degraded':
      return { label: 'Degradado', tone: 'warn' };
    case 'unavailable':
      return { label: 'No disponible', tone: 'bad' };
    case 'insufficient_data':
      return { label: 'Sin información suficiente', tone: 'neutral' };
  }
}

export function complianceMeta(status: ComplianceStatus): {
  label: string;
  tone: Tone;
} {
  switch (status) {
    case 'met':
      return { label: 'Cumple', tone: 'ok' };
    case 'unmet':
      return { label: 'No cumple', tone: 'bad' };
    case 'insufficient_data':
      return { label: 'Datos insuficientes', tone: 'neutral' };
  }
}

export function checkStatusMeta(
  status: CheckResultRecord['status'] | CheckRunStatus
): { label: string; tone: Tone } {
  switch (status) {
    case 'passed':
      return { label: 'Exitosa', tone: 'ok' };
    case 'failed':
      return { label: 'Fallida', tone: 'bad' };
    case 'partial':
      return { label: 'Parcial', tone: 'warn' };
    case 'not_executed':
      return { label: 'No ejecutada', tone: 'warn' };
    case 'blocked':
      return { label: 'Bloqueada', tone: 'bad' };
    case 'skipped':
      return { label: 'Omitida', tone: 'neutral' };
  }
}

export function slaApprovalLabel(status: SlaApprovalStatus): string {
  switch (status) {
    case 'draft':
      return 'Borrador';
    case 'internal_reference':
      return 'Referencia interna';
    case 'formally_approved':
      return 'Formalmente aprobado';
    case 'expired':
      return 'Vencido';
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Sin registros';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export function formatMetric(
  value: number | null | undefined,
  unit = ''
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Sin datos';
  }
  return unit ? `${value} ${unit}` : String(value);
}

import { API_BASE_URL } from './api';

export interface ClientTelemetryEvent {
  eventType:
    | 'client.sync_failed'
    | 'client.sync_conflict'
    | 'client.sync_recovered'
    | 'client.network_error';
  module: string;
  operation: string;
  errorCode?: string;
  statusCode?: number;
}

const recentSent = new Map<string, number>();

/**
 * Envío best-effort de eventos técnicos del cliente PWA sin bloquear la operación
 * ni registrar datos personales, cuerpos de solicitud ni credenciales.
 */
export function reportClientTelemetry(event: ClientTelemetryEvent): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  const nodeEnv = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  if (nodeEnv?.NODE_TEST_CONTEXT) {
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const csrfMatch = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('cof_csrf='));
  if (!csrfMatch) return;

  const key = `${event.eventType}:${event.module}:${event.operation}:${event.errorCode ?? ''}`;
  const now = Date.now();
  const prev = recentSent.get(key) ?? 0;
  if (now - prev < 3000) return;
  recentSent.set(key, now);
  if (recentSent.size > 40) {
    const firstKey = recentSent.keys().next().value;
    if (firstKey) recentSent.delete(firstKey);
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': decodeURIComponent(csrfMatch.slice('cof_csrf='.length)),
  };

  void fetch(`${base}/api/observability/client-events`, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers,
    body: JSON.stringify({
      client: 'web',
      eventType: event.eventType,
      module: event.module,
      operation: event.operation,
      errorCode: event.errorCode,
      statusCode: event.statusCode,
    }),
  }).catch(() => undefined);
}

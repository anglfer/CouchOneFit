import type {
  IncidentSeverity,
  IncidentType,
  ObservabilityEnvironment,
  ObservabilitySettings,
  RawCheckSample,
  RawLogSample,
  SloEvaluated,
} from '../types/observability.js'
import { isOperationalRequest, isServiceAvailabilityCheck, percentile, round } from '../utils/classify.js'

export interface IncidentSignal {
  action: 'upsert' | 'resolve'
  dedupeKey: string
  environment: ObservabilityEnvironment
  service: string
  incidentType: IncidentType
  severity: IncidentSeverity
  title: string
  summary: string
  observedAt: string
  correlationId: string | null
  sloId: string | null
  resolutionNotes?: string
}

export function detectIncidentSignals(params: {
  environment: ObservabilityEnvironment
  settings: ObservabilitySettings
  recentChecks: RawCheckSample[]
  recentLogs: RawLogSample[]
  evaluatedSlos: SloEvaluated[]
  now?: Date
}): IncidentSignal[] {
  const {
    environment,
    settings,
    recentChecks,
    recentLogs,
    evaluatedSlos,
    now = new Date(),
  } = params
  const signals: IncidentSignal[] = []
  const nowIso = now.toISOString()

  // Health and functional probes are independent. A successful functional or CI
  // test does not recover a failed liveness check.
  const groups = new Map<string, { checkType: IncidentType; observations: RawCheckSample[] }>()
  const freshnessMs = (settings.incidentConsecutiveFailures + 2) * settings.checkIntervalMinutes * 60_000
  const cutoff = now.getTime() - freshnessMs
  for (const check of recentChecks) {
    if (new Date(check.executedAt).getTime() < cutoff) continue
    if (check.phase === 'recovery-drill' || check.runCategory !== 'synthetic_periodic') continue
    const availability = isServiceAvailabilityCheck(check)
    if (!availability && check.checkKind !== 'synthetic_functional' && check.checkKey !== 'web_proxy_readiness') continue
    const checkType = availability ? 'service_outage' : 'consecutive_check_failure'
    const key = availability
      ? `${environment}:${check.service}:service_outage`
      : `${environment}:${check.service}:consecutive_check_failure:${check.checkKey}`
    const group = groups.get(key)
    if (group) group.observations.push(check)
    else groups.set(key, { checkType, observations: [check] })
  }
  for (const [dedupeKey, { checkType, observations }] of groups) {
    observations.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
    const [latest] = observations
    const { service, correlationId, executedAt: observedAt } = latest
    const outage = checkType === 'service_outage'
    let consecutive = 0
    for (const observation of observations) {
      if (observation.status !== 'failed') break
      consecutive += 1
    }
    if (latest.status === 'failed' && (outage || consecutive >= settings.incidentConsecutiveFailures)) {
      signals.push({
        action: 'upsert',
        dedupeKey, environment, service, incidentType: checkType, correlationId, observedAt, sloId: null,
        severity: outage && consecutive >= 2 ? 'critical' : 'high',
        title: outage ? `Interrupción detectada en ${service}` : `Fallos consecutivos en ${latest.checkName}`,
        summary: `${latest.checkName}: ${latest.errorMessage ?? `estado HTTP ${latest.httpStatus ?? 'n/d'}`} (${consecutive} fallo(s) consecutivo(s)).`,
      })
    } else if (latest.status === 'passed') {
      signals.push({
        action: 'resolve',
        dedupeKey, environment, service, incidentType: checkType, correlationId, observedAt, sloId: null,
        severity: 'low',
        title: `Recuperación observada en ${service}`,
        summary: 'Comprobación exitosa.',
        resolutionNotes: `Recuperación automática observada tras comprobación exitosa (${latest.checkName}).`,
      })
    }
  }

  // 2. Tasa elevada de errores 5xx e incrementos de latencia P95 en últimos 15 min
  const windowCutoff = now.getTime() - 15 * 60_000
  const recentHttp = recentLogs.filter(
    (l) =>
      l.eventType === 'http.request' &&
      new Date(l.occurredAt).getTime() >= windowCutoff && isOperationalRequest(l),
  )
  if (recentHttp.length >= 10) {
    const errors = recentHttp.filter((l) => (l.statusCode ?? 0) >= 500).length
    const errorRatePct = round((errors / recentHttp.length) * 100, 2) ?? 0
    const errKey = `${environment}:api:high_error_rate`
    if (errorRatePct >= settings.incidentErrorRateThresholdPct) {
      signals.push({
        action: 'upsert',
        dedupeKey: errKey,
        environment,
        service: 'api',
        incidentType: 'high_error_rate',
        severity: errorRatePct >= 20 ? 'critical' : 'high',
        title: 'Tasa elevada de errores 5xx en API',
        summary: `Se registró ${errorRatePct}% de errores 5xx (${errors}/${recentHttp.length} solicitudes en 15 min; umbral ${settings.incidentErrorRateThresholdPct}%).`,
        observedAt: nowIso,
        correlationId: null,
        sloId: null,
      })
    } else {
      signals.push({
        action: 'resolve',
        dedupeKey: errKey,
        environment,
        service: 'api',
        incidentType: 'high_error_rate',
        severity: 'low',
        title: 'Tasa de errores estabilizada',
        summary: 'Tasa de errores dentro del umbral.',
        observedAt: nowIso,
        correlationId: null,
        sloId: null,
        resolutionNotes: `Tasa 5xx normalizada en ${errorRatePct}% (< ${settings.incidentErrorRateThresholdPct}%).`,
      })
    }

    const durations = recentHttp
      .map((l) => l.durationMs)
      .filter((d): d is number => typeof d === 'number' && Number.isFinite(d))
    const p95 = percentile(durations, 95)
    const latKey = `${environment}:api:latency_spike`
    if (p95 !== null && p95 > settings.incidentLatencyP95ThresholdMs) {
      signals.push({
        action: 'upsert',
        dedupeKey: latKey,
        environment,
        service: 'api',
        incidentType: 'latency_spike',
        severity:
          p95 > settings.incidentLatencyP95ThresholdMs * 2 ? 'high' : 'medium',
        title: 'Incremento anormal de latencia P95 en API',
        summary: `Latencia P95 observada de ${round(p95, 1)} ms en los últimos 15 min (umbral ${settings.incidentLatencyP95ThresholdMs} ms).`,
        observedAt: nowIso,
        correlationId: null,
        sloId: null,
      })
    } else if (p95 !== null) {
      signals.push({
        action: 'resolve',
        dedupeKey: latKey,
        environment,
        service: 'api',
        incidentType: 'latency_spike',
        severity: 'low',
        title: 'Latencia API normalizada',
        summary: 'Latencia dentro del umbral.',
        observedAt: nowIso,
        correlationId: null,
        sloId: null,
        resolutionNotes: `Latencia P95 normalizada en ${round(p95, 1)} ms.`,
      })
    }
  }

  // 3. Incumplimiento de SLO
  for (const slo of evaluatedSlos) {
    const sloKey = `${environment}:slo:${slo.id}:slo_breach`
    if (slo.complianceStatus === 'unmet') {
      signals.push({
        action: 'upsert',
        dedupeKey: sloKey,
        environment,
        service: slo.sliService ?? 'platform',
        incidentType: 'slo_breach',
        severity: 'medium',
        title: `Incumplimiento de SLO: ${slo.name}`,
        summary: `Observado ${slo.observedValue ?? 'n/d'} ${slo.unit} frente a objetivo ${slo.comparisonOperator} ${slo.targetValue} ${slo.unit} (${slo.samples} muestras).`,
        observedAt: nowIso,
        correlationId: null,
        sloId: slo.id,
      })
    } else if (slo.complianceStatus === 'met') {
      signals.push({
        action: 'resolve',
        dedupeKey: sloKey,
        environment,
        service: slo.sliService ?? 'platform',
        incidentType: 'slo_breach',
        severity: 'low',
        title: `SLO recuperado: ${slo.name}`,
        summary: 'El SLO volvió a estado de cumplimiento.',
        observedAt: nowIso,
        correlationId: null,
        sloId: slo.id,
        resolutionNotes: `SLO cumplido nuevamente (${slo.observedValue ?? 'n/d'} ${slo.unit}).`,
      })
    }
  }

  return signals
}

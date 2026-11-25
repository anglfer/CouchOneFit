import type { ObservabilityPeriod, RawCheckSample, RawLogSample } from '../types/observability.js'

const PERIOD_HOURS: Record<ObservabilityPeriod, number> = {
  '1h': 1,
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

export function periodWindow(
  period: ObservabilityPeriod,
  now: Date = new Date(),
): { start: Date; end: Date; previousStart: Date } {
  const hours = PERIOD_HOURS[period]
  const ms = hours * 3_600_000
  const end = new Date(now.getTime())
  const start = new Date(end.getTime() - ms)
  const previousStart = new Date(start.getTime() - ms)
  return { start, end, previousStart }
}

export function isOperationalRequest(log: RawLogSample): boolean {
  const path = log.normalizedPath ?? ''
  return (
    (log.eventType === 'http.request' || log.eventType === 'http.aborted') &&
    !path.startsWith('/api/health') &&
    !path.startsWith('/api/observability') &&
    !path.startsWith('/api/admin/observability')
  )
}

export function isServiceAvailabilityCheck(check: RawCheckSample): boolean {
  return (
    check.checkKind === 'synthetic_availability' &&
    check.runCategory === 'synthetic_periodic' &&
    check.phase !== 'recovery-drill' &&
    (
      (check.service === 'web' && check.checkKey === 'web_availability') ||
      (check.service === 'api' && check.checkKey === 'api_liveness') ||
      (check.service === 'database' && check.checkKey === 'api_db_readiness')
    )
  )
}

export function round(value: number | null | undefined, digits = 2): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function mean(values: number[]): number | null {
  if (!values.length) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

/** Nearest-rank percentile matching scripts/quality/lib/common.mjs. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(
    sorted.length,
    Math.max(1, Math.ceil((p / 100) * sorted.length)),
  )
  return sorted[rank - 1]
}

export function csvCell(value: unknown): string {
  const raw =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${neutralized.replaceAll('"', '""')}"`
}

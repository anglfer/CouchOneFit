import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import {
  sanitizeLogValue,
  type LogRecord,
} from '../../../shared/utils/logger.js'
import { resolveModuleFromPath } from '../../../shared/middleware/request-logger.js'

const VALID_ENVIRONMENTS = new Set([
  'production',
  'staging',
  'development',
  'local',
  'ci',
  'test',
])

const VALID_HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
])

const VALID_OUTCOMES = new Set([
  'success',
  'client_error',
  'server_error',
  'aborted',
  'timeout',
  'recovered',
  'info',
])

const RESERVED_KEYS = new Set([
  'ts',
  'level',
  'service',
  'env',
  'event',
  'version',
  'requestId',
  'module',
  'operation',
  'method',
  'path',
  'status',
  'durationMs',
  'outcome',
  'errorCode',
  'errorType',
  'message',
  'stack',
])

export interface PersistedLogEntry {
  correlationId: string
  occurredAt: string
  environment: string
  service: string
  module: string
  source: 'operational' | 'error' | 'client_telemetry' | 'system'
  eventType: string
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  operation: string
  normalizedPath?: string
  httpMethod?: string
  statusCode?: number
  durationMs?: number
  outcome: string
  errorCode?: string
  errorMessage?: string
  systemVersion?: string
  metadata: Record<string, unknown>
}

export interface DatabaseLogSinkOptions {
  flushIntervalMs?: number
  maxBatchSize?: number
  maxQueueSize?: number
  defaultVersion?: string
}

function normalizeEnvironment(raw: unknown): string {
  const candidate = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (VALID_ENVIRONMENTS.has(candidate)) return candidate
  return 'development'
}

function normalizeSeverity(
  raw: unknown,
): 'debug' | 'info' | 'warn' | 'error' | 'critical' {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : 'info'
  if (
    value === 'debug' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error' ||
    value === 'critical'
  ) {
    return value
  }
  return 'info'
}

export function mapLogRecordToEntry(
  record: LogRecord,
  defaultVersion?: string,
): PersistedLogEntry {
  const eventType =
    typeof record.event === 'string' && record.event.trim()
      ? record.event.trim()
      : 'http.request'
  const normalizedPath =
    typeof record.path === 'string' && record.path.trim()
      ? record.path.trim()
      : undefined
  const httpMethod =
    typeof record.method === 'string' &&
    VALID_HTTP_METHODS.has(record.method.toUpperCase())
      ? record.method.toUpperCase()
      : undefined
  const severity = normalizeSeverity(record.level)
  const moduleName =
    typeof record.module === 'string' && record.module.trim()
      ? record.module.trim()
      : normalizedPath
        ? resolveModuleFromPath(normalizedPath)
        : eventType.startsWith('auth.')
          ? 'auth'
          : eventType.startsWith('db.')
            ? 'database'
            : 'system'
  const source: PersistedLogEntry['source'] =
    eventType.startsWith('db.') ||
    eventType.startsWith('process.') ||
    eventType === 'http.error' ||
    severity === 'error' ||
    severity === 'critical'
      ? 'error'
      : eventType.startsWith('server.') || eventType.startsWith('system.')
        ? 'system'
        : 'operational'

  const rawOutcome =
    typeof record.outcome === 'string' ? record.outcome.trim() : ''
  const outcome = VALID_OUTCOMES.has(rawOutcome)
    ? rawOutcome
    : eventType === 'http.aborted'
      ? 'aborted'
      : eventType === 'system.recovery'
        ? 'recovered'
        : severity === 'error' || severity === 'critical'
          ? 'server_error'
          : 'info'

  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!RESERVED_KEYS.has(key) && value !== undefined) {
      metadata[key] = value
    }
  }
  if (typeof record.errorName === 'string') {
    metadata.errorName = record.errorName
  }

  return {
    correlationId:
      typeof record.requestId === 'string' && record.requestId.trim()
        ? record.requestId.trim()
        : typeof record.id === 'string' ? record.id : randomUUID(),
    occurredAt:
      typeof record.ts === 'string' && !Number.isNaN(Date.parse(record.ts))
        ? record.ts
        : new Date().toISOString(),
    environment: normalizeEnvironment(record.env),
    service:
      typeof record.service === 'string' && record.service.trim()
        ? record.service.trim()
        : 'api',
    module: moduleName,
    source,
    eventType,
    severity,
    operation:
      typeof record.operation === 'string' && record.operation.trim()
        ? record.operation.trim()
        : httpMethod && normalizedPath
          ? `${httpMethod} ${normalizedPath}`
          : eventType,
    normalizedPath,
    httpMethod,
    statusCode:
      typeof record.status === 'number' &&
      Number.isInteger(record.status) &&
      record.status >= 100 &&
      record.status <= 599
        ? record.status
        : undefined,
    durationMs:
      typeof record.durationMs === 'number' &&
      Number.isFinite(record.durationMs) &&
      record.durationMs >= 0
        ? Math.round(record.durationMs * 10) / 10
        : undefined,
    outcome,
    errorCode:
      typeof record.errorCode === 'string'
        ? record.errorCode
        : typeof record.errorType === 'string'
          ? record.errorType
          : undefined,
    errorMessage:
      typeof record.message === 'string'
        ? String(sanitizeLogValue(record.message)).slice(0, 500)
        : undefined,
    systemVersion:
      typeof record.version === 'string' ? record.version : defaultVersion,
    metadata: sanitizeLogValue(metadata) as Record<string, unknown>,
  }
}

export class DatabaseLogSink {
  private readonly pool: Pool
  private readonly maxBatchSize: number
  private readonly maxQueueSize: number
  private readonly defaultVersion?: string
  private queue: PersistedLogEntry[] = []
  private timer: NodeJS.Timeout | null = null
  private flushing: Promise<void> | null = null
  private consecutiveFailures = 0
  private nextAttemptAt = 0
  private hadFailure = false
  private warned = false
  private closed = false

  constructor(pool: Pool, options: DatabaseLogSinkOptions = {}) {
    this.pool = pool
    this.maxBatchSize = options.maxBatchSize ?? 25
    this.maxQueueSize = options.maxQueueSize ?? 500
    this.defaultVersion = options.defaultVersion
    const intervalMs = options.flushIntervalMs ?? 2000
    this.timer = setInterval(() => {
      void this.flush()
    }, intervalMs)
    this.timer.unref()
  }

  enqueue = (record: LogRecord): void => {
    if (this.closed) return
    const entry = mapLogRecordToEntry(record, this.defaultVersion)
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift()
    }
    this.queue.push(entry)
    if (this.queue.length >= this.maxBatchSize && Date.now() >= this.nextAttemptAt) {
      void this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (this.queue.length === 0) return
    if (Date.now() < this.nextAttemptAt) return

    this.flushing = (async () => {
      while (this.queue.length > 0 && Date.now() >= this.nextAttemptAt) {
        const batch = this.queue.splice(0, this.maxBatchSize)
        const payload = [...batch]
        if (this.hadFailure) {
          payload.push({
            correlationId: randomUUID(),
            occurredAt: new Date().toISOString(),
            environment: batch[0]?.environment ?? 'development',
            service: 'api',
            module: 'database',
            source: 'system',
            eventType: 'system.recovery',
            severity: 'info',
            operation: 'database_log_sink_recovery',
            outcome: 'recovered',
            systemVersion: this.defaultVersion,
            metadata: { recoveredAfterFailures: this.consecutiveFailures },
          })
        }
        try {
          await this.pool.query(
            'SELECT private.insert_observability_logs($1::jsonb)',
            [JSON.stringify(payload)],
          )
          this.hadFailure = false
          this.consecutiveFailures = 0
          this.nextAttemptAt = 0
          this.warned = false
        } catch (error) {
          this.consecutiveFailures += 1
          this.hadFailure = true
          const backoffMs = Math.min(60_000, 5_000 * 2 ** (this.consecutiveFailures - 1))
          this.nextAttemptAt = Date.now() + backoffMs
          // Conservar solo los eventos recientes en memoria para evitar crecimiento sin límite.
          this.queue = [...batch, ...this.queue].slice(-this.maxQueueSize)
          if (!this.warned) {
            this.warned = true
            try {
              process.stderr.write(
                `DatabaseLogSink: fallo al persistir logs (${
                  error instanceof Error ? error.name : 'error'
                }); se reintentará en segundo plano.\n`,
              )
            } catch {
              // Sin canal stderr disponible.
            }
          }
          break
        }
      }
    })().finally(() => {
      this.flushing = null
    })

    return this.flushing
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.nextAttemptAt = 0
    await this.flush()
  }
}

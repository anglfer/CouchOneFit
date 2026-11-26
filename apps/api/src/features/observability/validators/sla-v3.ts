import { AuthError } from '../../auth/types/errors.js'
import type { ObservabilityEnvironment } from '../types/observability.js'
import { currentSlaMonth, parseSlaMonth } from '../services/sla-v3.js'
import type { SlaRecordKind } from '../services/sla-v3.js'
import { parseEnvironment } from './observability.js'

const ENVIRONMENTS = ['production', 'staging', 'development', 'local', 'ci', 'test']
const KINDS: SlaRecordKind[] = [
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
]
export const AUTOMATION_KINDS: SlaRecordKind[] = [
  'backup',
  'access_cleanup',
  'deployment',
  'load_test',
  'storage_measurement',
]
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXTERNAL_ID_RE = /^[A-Za-z0-9_.:/#@-]{1,160}$/
const DEFAULT_LIMIT_BYTES = 524_288_000
const MAX_BYTES = 1e15

function bad(message: string, fields?: Record<string, string>): never {
  throw new AuthError(400, 'VALIDATION_ERROR', message, fields)
}

function asObject(value: unknown, label = 'cuerpo de la solicitud'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    bad(`El ${label} debe ser un objeto válido.`)
  }
  return value as Record<string, unknown>
}

function environmentOf(value: unknown, fallback: ObservabilityEnvironment): ObservabilityEnvironment {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string' || !ENVIRONMENTS.includes(value)) {
    bad('El ambiente indicado no está configurado.')
  }
  return parseEnvironment(value, fallback)
}

function isoDate(value: unknown, label: string, required: true): string
function isoDate(value: unknown, label: string, required: false): string | null
function isoDate(value: unknown, label: string, required: boolean): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) bad(`La fecha ${label} es obligatoria.`)
    return null
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    bad(`La fecha ${label} no es válida.`)
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) bad(`La fecha ${label} no es válida.`)
  return new Date(parsed).toISOString()
}

function optionalText(source: Record<string, unknown>, key: string, max: number): string | undefined {
  const value = source[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') bad(`El campo ${key} debe ser texto.`)
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length > max) bad(`El campo ${key} admite hasta ${max} caracteres.`)
  return trimmed
}

function requiredText(source: Record<string, unknown>, key: string, max: number): string {
  const value = optionalText(source, key, max)
  if (value === undefined) bad(`El campo ${key} es obligatorio.`)
  return value
}

function booleanField(source: Record<string, unknown>, key: string): boolean {
  const value = source[key]
  if (typeof value !== 'boolean') bad(`El campo ${key} debe ser verdadero o falso.`)
  return value
}

function optionalBoolean(source: Record<string, unknown>, key: string): boolean | undefined {
  return source[key] === undefined || source[key] === null ? undefined : booleanField(source, key)
}

function numberField(
  source: Record<string, unknown>,
  key: string,
  options: { integer?: boolean; min?: number; max?: number; required?: boolean } = {},
): number | undefined {
  const value = source[key]
  if (value === undefined || value === null) {
    if (options.required === false) return undefined
    bad(`El campo ${key} es obligatorio.`)
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) bad(`El campo ${key} debe ser numérico.`)
  if (options.integer && !Number.isInteger(value)) bad(`El campo ${key} debe ser un entero.`)
  if (value < (options.min ?? 0)) bad(`El campo ${key} no puede ser menor a ${options.min ?? 0}.`)
  if (value > (options.max ?? MAX_BYTES)) bad(`El campo ${key} excede el máximo permitido.`)
  return value
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

function normalizeDetails(
  kind: SlaRecordKind,
  raw: Record<string, unknown>,
  endedAt: string | null,
): Record<string, unknown> {
  switch (kind) {
    case 'maintenance_window':
      if (!endedAt) bad('La ventana de mantenimiento requiere fecha de fin.')
      return { notifiedAt: isoDate(raw.notifiedAt, 'de aviso (notifiedAt)', true) }
    case 'provider_incident': {
      const provider = raw.provider
      if (provider !== 'render' && provider !== 'vercel' && provider !== 'supabase') {
        bad('El proveedor debe ser render, vercel o supabase.')
      }
      return compact({ provider, url: optionalText(raw, 'url', 500) })
    }
    case 'support_incident': {
      const severity = raw.severity
      if (severity !== 'alta' && severity !== 'media' && severity !== 'baja') {
        bad('La severidad debe ser alta, media o baja.')
      }
      return compact({
        severity,
        acknowledgedAt: isoDate(raw.acknowledgedAt, 'de acuse (acknowledgedAt)', false),
        cause: optionalText(raw, 'cause', 500) ?? '',
        attributable: booleanField(raw, 'attributable'),
        requiresRestore: optionalBoolean(raw, 'requiresRestore'),
      })
    }
    case 'backup':
      return compact({
        ok: booleanField(raw, 'ok'),
        responsible: optionalText(raw, 'responsible', 120),
        sizeBytes: numberField(raw, 'sizeBytes', { required: false, integer: true }),
        note: optionalText(raw, 'note', 500),
      })
    case 'restore_drill':
      return compact({
        ok: booleanField(raw, 'ok'),
        responsible: optionalText(raw, 'responsible', 120),
        note: optionalText(raw, 'note', 500),
      })
    case 'access_cleanup':
      return compact({
        ok: booleanField(raw, 'ok'),
        responsible: optionalText(raw, 'responsible', 120),
        deleted: numberField(raw, 'deleted', { required: false, integer: true, max: 1e9 }),
        note: optionalText(raw, 'note', 500),
      })
    case 'storage_measurement':
      return {
        bytes: numberField(raw, 'bytes', { integer: true }),
        limitBytes: numberField(raw, 'limitBytes', { integer: true, min: 1 }),
      }
    case 'load_test':
      return {
        version: requiredText(raw, 'version', 60),
        readP95Ms: numberField(raw, 'readP95Ms', { max: 1e7 }),
        writeP95Ms: numberField(raw, 'writeP95Ms', { max: 1e7 }),
        readSamples: numberField(raw, 'readSamples', { integer: true, max: 1e9 }),
        writeSamples: numberField(raw, 'writeSamples', { integer: true, max: 1e9 }),
        concurrency: numberField(raw, 'concurrency', { integer: true, max: 1e6 }),
        rps: numberField(raw, 'rps', { max: 1e7 }),
        durationS: numberField(raw, 'durationS', { max: 1e7 }),
      }
    case 'monthly_report': {
      const period = raw.period
      if (typeof period !== 'string' || !parseSlaMonth(period)) {
        bad('El periodo debe tener el formato AAAA-MM.')
      }
      return compact({ period, recipient: optionalText(raw, 'recipient', 200) })
    }
    case 'deployment':
      return {
        version: requiredText(raw, 'version', 60),
        healthOk: booleanField(raw, 'healthOk'),
        readinessOk: booleanField(raw, 'readinessOk'),
        functionalOk: booleanField(raw, 'functionalOk'),
      }
  }
}

export type SlaRecordInput = {
  environment: ObservabilityEnvironment
  kind: SlaRecordKind
  occurredAt: string
  endedAt: string | null
  details: Record<string, unknown>
}

function recordFields(
  body: Record<string, unknown>,
  fallback: ObservabilityEnvironment,
  allowedKinds: SlaRecordKind[],
): SlaRecordInput {
  const kind = body.kind
  if (typeof kind !== 'string' || !allowedKinds.includes(kind as SlaRecordKind)) {
    bad(`El tipo debe ser uno de: ${allowedKinds.join(', ')}.`)
  }
  const occurredAt = isoDate(body.occurredAt, 'de ocurrencia (occurredAt)', true)
  const endedAt = isoDate(body.endedAt, 'de fin (endedAt)', false)
  if (endedAt && Date.parse(endedAt) < Date.parse(occurredAt)) {
    bad('La fecha de fin no puede ser anterior al inicio.')
  }
  return {
    environment: environmentOf(body.environment, fallback),
    kind: kind as SlaRecordKind,
    occurredAt,
    endedAt,
    details: normalizeDetails(kind as SlaRecordKind, asObject(body.details ?? {}, 'campo details'), endedAt),
  }
}

export function validateSlaRecordInput(
  input: unknown,
  fallback: ObservabilityEnvironment,
): SlaRecordInput {
  return recordFields(asObject(input), fallback, KINDS)
}

export function validateSlaOperationInput(
  input: unknown,
  fallback: ObservabilityEnvironment,
): SlaRecordInput & { externalId: string } {
  const body = asObject(input)
  const externalId = body.externalId
  if (typeof externalId !== 'string' || !EXTERNAL_ID_RE.test(externalId)) {
    bad('El campo externalId es obligatorio (1 a 160 caracteres sin espacios).')
  }
  const record = recordFields(body, fallback, AUTOMATION_KINDS)
  return { ...record, endedAt: null, externalId }
}

export function validateSlaMonthQuery(
  query: unknown,
  fallback: ObservabilityEnvironment,
  now: Date,
): { environment: ObservabilityEnvironment; month: string; start: Date; end: Date } {
  const params = asObject(query ?? {}, 'filtro')
  const rawMonth = params.month
  const month = rawMonth === undefined || rawMonth === '' ? currentSlaMonth(now) : rawMonth
  const bounds = typeof month === 'string' ? parseSlaMonth(month) : null
  if (!bounds || typeof month !== 'string') bad('El mes debe tener el formato AAAA-MM.')
  return { environment: environmentOf(params.environment, fallback), month, ...bounds }
}

export function validateSlaStorageInput(
  input: unknown,
  fallback: ObservabilityEnvironment,
): { environment: ObservabilityEnvironment; limitBytes: number } {
  const body = asObject(input ?? {})
  const limitBytes =
    body.limitBytes === undefined || body.limitBytes === null
      ? DEFAULT_LIMIT_BYTES
      : numberField(body, 'limitBytes', { integer: true, min: 1 })!
  return { environment: environmentOf(body.environment, fallback), limitBytes }
}

export function validateSlaRecordId(value: string): string {
  if (!UUID_RE.test(value)) bad('El identificador del registro no es válido.')
  return value
}

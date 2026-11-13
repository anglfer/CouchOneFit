import { createHmac, timingSafeEqual } from 'node:crypto'
import { invalidInput, payload } from '../../auth/validators/lifecycle.js'
import type {
  EvolutionPosition,
  EvolutionQuery,
  EvolutionScope,
} from '../types/evolution.js'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function isEvolutionDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}
/** Canonical UTC microseconds preserve PostgreSQL tie-break precision; no Date truncation. */
export function evolutionTimestamp(value: string): string {
  const m =
    /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?Z$/.exec(
      value,
    )
  if (!m || !isEvolutionDate(m[1]))
    return invalidInput('Fecha técnica de evolución inválida.')
  return `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${(m[5] ?? '').padEnd(6, '0')}Z`
}
function position(value: unknown): EvolutionPosition {
  const p = payload(value, ['date', 'createdAt', 'id'])
  if (
    !isEvolutionDate(p.date) ||
    typeof p.createdAt !== 'string' ||
    typeof p.id !== 'string' ||
    !uuid.test(p.id)
  )
    return invalidInput('La página de evolución no es válida.')
  return {
    date: p.date,
    createdAt: evolutionTimestamp(p.createdAt),
    id: p.id.toLowerCase(),
  }
}
function scopeValue(scope: EvolutionScope): EvolutionScope {
  if (!uuid.test(scope.subjectId) || !uuid.test(scope.clientId))
    return invalidInput('Contexto de evolución inválido.')
  return {
    subjectId: scope.subjectId.toLowerCase(),
    clientId: scope.clientId.toLowerCase(),
  }
}
function signature(encoded: string, key: Uint8Array): string {
  if (key.byteLength < 32)
    throw new Error(
      'Evolution cursor signing key must contain at least 32 bytes',
    )
  return createHmac('sha256', key)
    .update(`evaluation-history:v1:${encoded}`)
    .digest('base64url')
}
/** Same HMAC pattern as portfolioQuery, with injected key for configuration-free pure tests. */
export function evolutionQuery(
  input: unknown,
  scope: EvolutionScope,
  key: Uint8Array,
): EvolutionQuery {
  const trusted = scopeValue(scope)
  const q = payload(input, ['from', 'to', 'method', 'pageSize', 'cursor'])
  const read = (name: string): string | undefined => {
    const value = q[name]
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !value.length)
      return invalidInput('Los filtros de evolución no son válidos.')
    return value
  }
  const from = read('from') ?? null,
    to = read('to') ?? null
  if (
    (from !== null && !isEvolutionDate(from)) ||
    (to !== null && !isEvolutionDate(to)) ||
    (from !== null && to !== null && from > to)
  )
    return invalidInput('El periodo de evolución no es válido.')
  const method = read('method') ?? null
  if (
    method !== null &&
    !['perimetros', 'pliegues', 'bioimpedancia', 'legacy'].includes(method)
  )
    return invalidInput('El método de evolución no es válido.')
  const size = read('pageSize') ?? '20'
  if (!/^(?:[1-9]\d?|100)$/.test(size))
    return invalidInput('El tamaño de página no es válido.')
  const result: EvolutionQuery = {
    from,
    to,
    method: method as EvolutionQuery['method'],
    pageSize: Number(size),
    after: null,
  }
  const token = read('cursor')
  if (token === undefined) return result
  if (token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))
    return invalidInput('La página de evolución no es válida.')
  const [encoded, mac] = token.split('.')
  const expected = signature(encoded, key)
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected)))
    return invalidInput('La página de evolución no es válida.')
  try {
    const decoded = Buffer.from(encoded, 'base64url')
    if (decoded.toString('base64url') !== encoded) throw Error()
    const data = payload(JSON.parse(decoded.toString('utf8')), [
      'v',
      'subjectId',
      'clientId',
      'from',
      'to',
      'method',
      'pageSize',
      'after',
    ])
    if (
      data.v !== 1 ||
      data.subjectId !== trusted.subjectId ||
      data.clientId !== trusted.clientId ||
      data.from !== from ||
      data.to !== to ||
      data.method !== method ||
      data.pageSize !== result.pageSize
    )
      throw Error()
    const after = position(data.after)
    if (
      (from !== null && after.date < from) ||
      (to !== null && after.date > to)
    )
      throw Error()
    result.after = after
  } catch {
    return invalidInput('La página de evolución no es válida.')
  }
  return result
}
export function evolutionCursor(
  scope: EvolutionScope,
  query: EvolutionQuery,
  after: EvolutionPosition,
  key: Uint8Array,
): string {
  // Reuse validation even for internally assembled filters.
  const raw = {
    ...(query.from === null ? {} : { from: query.from }),
    ...(query.to === null ? {} : { to: query.to }),
    ...(query.method === null ? {} : { method: query.method }),
    pageSize: String(query.pageSize),
  }
  const normalized = evolutionQuery(raw, scope, key)
  const last = position({
    date: after.date,
    createdAt: after.createdAt,
    id: after.id,
  })
  if (
    (normalized.from !== null && last.date < normalized.from) ||
    (normalized.to !== null && last.date > normalized.to)
  )
    return invalidInput('La posición está fuera del periodo.')
  const encoded = Buffer.from(
    JSON.stringify({
      v: 1,
      ...scopeValue(scope),
      from: normalized.from,
      to: normalized.to,
      method: normalized.method,
      pageSize: normalized.pageSize,
      after: last,
    }),
  ).toString('base64url')
  return `${encoded}.${signature(encoded, key)}`
}

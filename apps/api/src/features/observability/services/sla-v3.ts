// Pure calculator for the SLA v3.0 (SLIs of section 7, deadlines of section 9,
// maintenance of section 10, compensation of section 13). No I/O, no dependencies.

export type SlaRequestRow = {
  ts: string
  method: string
  route: string
  status: number
  durationMs: number
  uptimeS: number | null
}
export type SlaProbeRow = {
  ts: string
  target: string
  status: number | null
  durationMs: number | null
  contentOk: boolean
  coldStart: boolean
}
export type SlaRecordKind =
  | 'maintenance_window'
  | 'provider_incident'
  | 'support_incident'
  | 'backup'
  | 'restore_drill'
  | 'access_cleanup'
  | 'storage_measurement'
  | 'load_test'
  | 'monthly_report'
  | 'deployment'
export type SlaRecord = {
  id: string
  kind: SlaRecordKind
  occurredAt: string
  endedAt: string | null
  details: Record<string, unknown>
  source: 'admin' | 'automation'
}
export type SlaSliStatus =
  | 'met'
  | 'unmet'
  | 'insufficient_sample'
  | 'no_data'
  | 'unverified'
export type SlaSli = {
  id: string
  group: 'function' | 'platform' | 'capacity' | 'continuity' | 'operation'
  category: string
  name: string
  slo: string
  comparison: '>=' | '<='
  target: number
  unit: '%' | 'ms' | 's' | 'h'
  observed: number | null
  attributable: number | null
  samples: number
  status: SlaSliStatus
  details?: string
}
export type SlaIncidentResult = {
  id: string
  severity: 'alta' | 'media' | 'baja'
  receivedAt: string
  ackDeadline: string
  acknowledgedAt: string | null
  ackOnTime: boolean | null
  resolveDeadline: string
  resolvedAt: string | null
  resolvedOnTime: boolean | null
  attributable: boolean
  cause: string
}
export type SlaMaintenanceResult = {
  id: string
  start: string
  end: string
  notifiedAt: string | null
  counted: boolean
  reason: string
}
export type SlaV3Report = {
  version: '3.0'
  month: string
  timeZone: 'America/Mexico_City'
  period: { start: string; end: string }
  generatedAt: string
  slis: SlaSli[]
  incidents: SlaIncidentResult[]
  maintenanceWindows: SlaMaintenanceResult[]
  compensation: { due: boolean; reasons: string[] }
  summary: {
    total: number
    met: number
    unmet: number
    insufficient: number
    noData: number
    unverified: number
  }
}

type FunctionType = 'read' | 'write'
type CatalogFunction = {
  id: string
  name: string
  category: string
  type: FunctionType
  transactions: ReadonlyArray<{ method: string; route: string }>
}

function fn(
  id: string,
  category: string,
  name: string,
  type: FunctionType,
  transactions: string[],
): CatalogFunction {
  return {
    id,
    name,
    category,
    type,
    transactions: transactions.map((value) => {
      const [method, route] = value.split(' ')
      return { method, route }
    }),
  }
}

const C = {
  identity: 'Identidad y acceso',
  subscription: 'Suscripción simulada',
  portfolio: 'Cartera y expediente',
  linking: 'Vinculación',
  training: 'Entrenamiento: profesional',
  mobile: 'Aplicación móvil del cliente',
  admin: 'Administración',
}

// SLA table 7.2. Routes use the SLA notation; the log stores every parameter as `:id`.
export const SLA_V3_FUNCTIONS: ReadonlyArray<CatalogFunction> = [
  fn('F-01', C.identity, 'Registro de profesional', 'write', ['POST /api/auth/professionals']),
  fn('F-02', C.identity, 'Inicio de sesión Web', 'write', ['POST /api/auth/login']),
  fn('F-03', C.identity, 'Inicio de sesión móvil', 'write', ['POST /api/auth/client/login']),
  fn('F-04', C.identity, 'Renovación de sesión', 'write', ['POST /api/auth/refresh', 'POST /api/auth/client/refresh']),
  fn('F-05', C.identity, 'Recuperación de acceso', 'write', ['POST /api/auth/recovery/reset']),
  fn('F-06', C.identity, 'Cambio de credenciales del cliente', 'write', ['PATCH /api/me/credentials']),
  fn('F-07', C.subscription, 'Catálogo público de planes', 'read', ['GET /api/plans']),
  fn('F-08', C.subscription, 'Pago simulado', 'write', ['POST /api/me/payments', 'POST /api/me/payments/:id/confirm']),
  fn('F-09', C.subscription, 'Consulta de suscripción', 'read', ['GET /api/me/subscription']),
  fn('F-10', C.subscription, 'Cambio de suscripción', 'write', ['PATCH /api/me/subscription', 'POST /api/me/subscription/downgrade']),
  fn('F-11', C.portfolio, 'Consulta de cartera y expediente', 'read', ['GET /api/clients', 'GET /api/clients/:clientId', 'GET /api/clients/:clientId/record']),
  fn('F-12', C.portfolio, 'Alta de expediente', 'write', ['POST /api/clients']),
  fn('F-13', C.portfolio, 'Edición de expediente', 'write', ['PATCH /api/clients/:clientId']),
  fn('F-14', C.portfolio, 'Estado de expediente y baja lógica', 'write', ['PATCH /api/clients/:clientId/status', 'PATCH /api/clients/:clientId/account']),
  fn('F-15', C.linking, 'Emitir y revocar código', 'write', ['POST /api/clients/:clientId/invitations', 'DELETE /api/clients/:clientId/invitations']),
  fn('F-16', C.linking, 'Activación móvil', 'write', ['POST /api/auth/activation/prevalidate', 'POST /api/auth/activation']),
  fn('F-17', C.training, 'Catálogo y plantillas', 'read', ['GET /api/training/exercises', 'GET /api/training/templates']),
  fn('F-18', C.training, 'Planes y sesiones del cliente', 'read', ['GET /api/clients/:clientId/training-plans', 'GET /api/clients/:clientId/training-sessions']),
  fn('F-19', C.training, 'Crear y versionar plan', 'write', [
    'POST /api/clients/:clientId/training-plans',
    'POST /api/clients/:clientId/training-plans/:planId/versions',
    'PATCH /api/clients/:clientId/training-plans/:planId/versions/:versionId',
  ]),
  fn('F-20', C.training, 'Activar versión del plan', 'write', ['POST /api/clients/:clientId/training-plans/:planId/versions/:versionId/activate']),
  fn('F-21', C.mobile, 'Perfil base', 'read', ['GET /api/me/record']),
  fn('F-22', C.mobile, 'Rutina vigente', 'read', ['GET /api/me/training-plan', 'GET /api/me/training-sessions/context']),
  fn('F-23', C.mobile, 'Registro de sesión por serie', 'write', ['POST /api/me/training-sessions']),
  fn('F-24', C.mobile, 'Historial de entrenamiento', 'read', ['GET /api/me/training-history']),
  fn('F-25', C.admin, 'Consulta de profesionales y soporte', 'read', ['GET /api/admin/professionals', 'GET /api/admin/support/clients', 'GET /api/admin/support/log']),
  fn('F-26', C.admin, 'Gestión del catálogo de planes', 'write', ['POST /api/admin/plans', 'PUT /api/admin/plans/:id']),
]

const MIN_SAMPLES = 50
const MIN_COLD_STARTS = 5
const MIN_LOAD_SAMPLES = 500
const DEFAULT_STORAGE_LIMIT_BYTES = 524_288_000
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const MX_OFFSET_MS = 6 * HOUR_MS // America/Mexico_City is UTC-6 all year (no DST).

// ---------------------------------------------------------------- time helpers

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export function parseSlaMonth(month: string): { start: Date; end: Date } | null {
  const match = typeof month === 'string' ? MONTH_RE.exec(month) : null
  if (!match) return null
  const year = Number(match[1])
  const index = Number(match[2]) - 1
  if (year < 2000 || year > 2200) return null
  return {
    start: new Date(Date.UTC(year, index, 1) + MX_OFFSET_MS),
    end: new Date(Date.UTC(year, index + 1, 1) + MX_OFFSET_MS),
  }
}

export function currentSlaMonth(now: Date): string {
  return new Date(now.getTime() - MX_OFFSET_MS).toISOString().slice(0, 7)
}

function previousMonth(month: string, back: number): string {
  const [year, index] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1]
  return new Date(Date.UTC(year, index - back, 1)).toISOString().slice(0, 7)
}

/** Local (UTC-6) wall clock expressed as epoch milliseconds; use getUTC* or day maths on it. */
function toLocal(ms: number): number {
  return ms - MX_OFFSET_MS
}
function fromLocal(local: number): number {
  return local + MX_OFFSET_MS
}
function dayStartLocal(local: number): number {
  return Math.floor(local / DAY_MS) * DAY_MS
}
function localDateKey(ms: number): string {
  return new Date(toLocal(ms)).toISOString().slice(0, 10)
}

function nthMonday(year: number, monthIndex: number, nth: number): number {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  return 1 + ((8 - firstDow) % 7) + 7 * (nth - 1)
}

const holidayCache = new Map<number, Set<string>>()

/** Mandatory rest days (Ley Federal del Trabajo, art. 74) as `MM-DD` keys. */
function holidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const pad = (value: number) => String(value).padStart(2, '0')
  const set = new Set<string>([
    '01-01',
    `02-${pad(nthMonday(year, 1, 1))}`,
    `03-${pad(nthMonday(year, 2, 3))}`,
    '05-01',
    '09-16',
    `11-${pad(nthMonday(year, 10, 3))}`,
    '12-25',
  ])
  if (year >= 2024 && (year - 2024) % 6 === 0) set.add('10-01')
  holidayCache.set(year, set)
  return set
}

function isBusinessDayKey(key: string): boolean {
  const year = Number(key.slice(0, 4))
  const dow = new Date(`${key}T00:00:00Z`).getUTCDay()
  return dow >= 1 && dow <= 5 && !holidays(year).has(key.slice(5))
}

const BUSINESS_START = 9 * HOUR_MS
const BUSINESS_END = 18 * HOUR_MS

/** First local instant at or after `local` that falls inside business hours. */
function alignBusiness(local: number): number {
  let cursor = local
  for (let i = 0; i < 800; i += 1) {
    const dayStart = dayStartLocal(cursor)
    if (isBusinessDayKey(new Date(cursor).toISOString().slice(0, 10))) {
      const timeOfDay = cursor - dayStart
      if (timeOfDay < BUSINESS_START) return dayStart + BUSINESS_START
      if (timeOfDay < BUSINESS_END) return cursor
    }
    cursor = dayStart + DAY_MS
  }
  return cursor
}

/** Adds business milliseconds to `start`; a report outside hours starts counting at the next business hour. */
function addBusinessTime(start: Date, durationMs: number): Date {
  let cursor = alignBusiness(toLocal(start.getTime()))
  let remaining = durationMs
  for (let i = 0; i < 2000; i += 1) {
    const dayEnd = dayStartLocal(cursor) + BUSINESS_END
    const available = dayEnd - cursor
    if (remaining <= available) return new Date(fromLocal(cursor + remaining))
    remaining -= available
    cursor = alignBusiness(dayEnd)
  }
  return new Date(fromLocal(cursor))
}

/** Business milliseconds elapsed between two instants. */
function businessTimeBetween(from: Date, to: Date): number {
  const end = toLocal(to.getTime())
  let cursor = toLocal(from.getTime())
  let total = 0
  for (let i = 0; i < 2000 && cursor < end; i += 1) {
    cursor = alignBusiness(cursor)
    if (cursor >= end) break
    const dayEnd = dayStartLocal(cursor) + BUSINESS_END
    total += Math.min(dayEnd, end) - cursor
    cursor = dayEnd
  }
  return total
}

// ------------------------------------------------------------- route notation

export function toLoggedRoute(slaRoute: string): string {
  return slaRoute.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':id')
}

const SLA_ROUTE_BY_LOGGED = new Map<string, string>()
for (const item of SLA_V3_FUNCTIONS) {
  for (const tx of item.transactions) {
    SLA_ROUTE_BY_LOGGED.set(`${tx.method} ${toLoggedRoute(tx.route)}`, tx.route)
  }
}

export function toSlaRoute(method: string, loggedRoute: string): string {
  return SLA_ROUTE_BY_LOGGED.get(`${method.toUpperCase()} ${loggedRoute}`) ?? loggedRoute
}

// ------------------------------------------------------------- record helpers

type Interval = { start: number; end: number }

function ms(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}
function detailString(record: SlaRecord, key: string): string | null {
  const value = record.details[key]
  return typeof value === 'string' && value ? value : null
}
function detailNumber(record: SlaRecord, key: string): number | null {
  const value = record.details[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
function detailOk(record: SlaRecord): boolean {
  return record.details.ok === true
}

function assessMaintenance(record: SlaRecord): { counted: boolean; reason: string } {
  const start = ms(record.occurredAt)
  const end = ms(record.endedAt)
  if (start === null || end === null || end < start) {
    return { counted: false, reason: 'Ventana sin inicio o fin válidos.' }
  }
  const notified = ms(detailString(record, 'notifiedAt'))
  if (notified === null) return { counted: false, reason: 'Sin aviso registrado.' }
  if (notified > start - 48 * HOUR_MS) {
    return { counted: false, reason: 'Avisada con menos de 48 horas de anticipación.' }
  }
  const localStart = toLocal(start)
  const dayStart = dayStartLocal(localStart)
  const withinSaturday =
    new Date(localStart).getUTCDay() === 6 &&
    localStart >= dayStart + HOUR_MS &&
    toLocal(end) <= dayStart + 4 * HOUR_MS
  if (!withinSaturday) {
    return { counted: false, reason: 'Fuera de la ventana de sábado de 1:00 a 4:00 h (hora de Ciudad de México).' }
  }
  return { counted: true, reason: 'Avisada a tiempo y dentro de la ventana permitida.' }
}

function countedWindows(records: SlaRecord[]): Interval[] {
  return records
    .filter((r) => r.kind === 'maintenance_window' && assessMaintenance(r).counted)
    .map((r) => ({ start: Date.parse(r.occurredAt), end: Date.parse(r.endedAt as string) }))
}

function inside(time: number, windows: Interval[]): boolean {
  return windows.some((w) => time >= w.start && time < w.end)
}

export function isCountedMaintenance(ts: Date, records: SlaRecord[]): boolean {
  return inside(ts.getTime(), countedWindows(records))
}

// ----------------------------------------------------------------- math helpers

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
const pct = (good: number, total: number): number => round((100 * good) / total, 2)

/** Nearest-rank percentile: position ceil(p * n) of the ascending series (1-based). */
function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(0.95 * sorted.length) - 1]
}

function evaluate(value: number, comparison: '>=' | '<=', target: number): SlaSliStatus {
  return (comparison === '>=' ? value >= target : value <= target) ? 'met' : 'unmet'
}

type SliInput = Omit<SlaSli, 'status' | 'observed' | 'attributable' | 'samples'> &
  Partial<Pick<SlaSli, 'observed' | 'attributable' | 'samples' | 'status'>>

function makeSli(input: SliInput): SlaSli {
  const sli: SlaSli = {
    observed: null,
    attributable: null,
    samples: 0,
    status: 'no_data',
    ...input,
  }
  if (sli.details === undefined) delete sli.details
  return sli
}

/** Percentage SLI whose status is judged with the attributable value. */
function percentageSli(
  base: Omit<SliInput, 'observed' | 'attributable' | 'samples' | 'status'>,
  counts: { good: number; total: number; goodAttr?: number; totalAttr?: number },
  minSamples = 1,
): SlaSli {
  const { good, total } = counts
  const goodAttr = counts.goodAttr ?? good
  const totalAttr = counts.totalAttr ?? total
  const observed = total > 0 ? pct(good, total) : null
  const attributable = totalAttr > 0 ? pct(goodAttr, totalAttr) : null
  let status: SlaSliStatus
  if (total < minSamples) status = minSamples > 1 ? 'insufficient_sample' : 'no_data'
  else if (attributable === null) status = 'no_data'
  else status = evaluate(attributable, base.comparison, base.target)
  return makeSli({ ...base, observed, attributable, samples: total, status })
}

// ---------------------------------------------------------------- the calculator

type ValidRequest = SlaRequestRow & { time: number }

export function computeSlaV3(input: {
  month: string
  now: Date
  requests: SlaRequestRow[]
  probes: SlaProbeRow[]
  records: SlaRecord[]
}): SlaV3Report {
  const bounds = parseSlaMonth(input.month)
  if (!bounds) throw new Error(`Invalid SLA month: ${input.month}`)
  const periodStart = bounds.start.getTime()
  const periodEnd = bounds.end.getTime()
  const nowMs = input.now.getTime()
  const inPeriod = (record: SlaRecord) => {
    const at = ms(record.occurredAt)
    return at !== null && at >= periodStart && at < periodEnd
  }
  const monthRecords = input.records.filter(inPeriod)
  const ofKind = (kind: SlaRecordKind) => monthRecords.filter((r) => r.kind === kind)

  const maintenance = countedWindows(input.records)
  const providerWindows: Interval[] = input.records
    .filter((r) => r.kind === 'provider_incident')
    .flatMap((r) => {
      const start = ms(r.occurredAt)
      return start === null ? [] : [{ start, end: ms(r.endedAt) ?? Number.POSITIVE_INFINITY }]
    })

  // Requests inside the month, excluding 429 and counted maintenance (SLA 7.1: valid).
  const valid: ValidRequest[] = []
  for (const row of input.requests) {
    const time = Date.parse(row.ts)
    if (Number.isNaN(time) || time < periodStart || time >= periodEnd) continue
    if (row.status === 429 || inside(time, maintenance)) continue
    valid.push({ ...row, method: row.method.toUpperCase(), time })
  }
  const isProviderFailure = (row: ValidRequest) =>
    row.status >= 500 && inside(row.time, providerWindows)

  const byTransaction = new Map<string, ValidRequest[]>()
  for (const row of valid) {
    const key = `${row.method} ${row.route}`
    const list = byTransaction.get(key)
    if (list) list.push(row)
    else byTransaction.set(key, [row])
  }

  const slis: SlaSli[] = []

  for (const item of SLA_V3_FUNCTIONS) {
    const rows = item.transactions.flatMap(
      (tx) => byTransaction.get(`${tx.method} ${toLoggedRoute(tx.route)}`) ?? [],
    )
    const good = rows.filter((r) => r.status < 500).length
    const providerFailures = rows.filter(isProviderFailure).length
    const lowSample = rows.length < MIN_SAMPLES
    slis.push(
      percentageSli(
        {
          id: `${item.id}-E`,
          group: 'function',
          category: item.category,
          name: `${item.name}: éxito`,
          slo: '≥ 98 %',
          comparison: '>=',
          target: 98,
          unit: '%',
        },
        { good, total: rows.length, totalAttr: rows.length - providerFailures },
        MIN_SAMPLES,
      ),
    )

    const series = rows
      .filter((r) => r.status < 500 && r.uptimeS !== null && r.uptimeS >= 60)
      .map((r) => r.durationMs)
    const target = item.type === 'read' ? 800 : 1500
    const p95 = series.length ? round(percentile95(series), 1) : null
    slis.push(
      makeSli({
        id: `${item.id}-L`,
        group: 'function',
        category: item.category,
        name: `${item.name}: latencia p95`,
        slo: `≤ ${target} ms`,
        comparison: '<=',
        target,
        unit: 'ms',
        observed: p95,
        attributable: p95,
        samples: series.length,
        status:
          lowSample || p95 === null ? 'insufficient_sample' : evaluate(p95, '<=', target),
      }),
    )
  }

  // G-01: global error rate over every http.request.
  const serverErrors = valid.filter((r) => r.status >= 500).length
  const globalProvider = valid.filter(isProviderFailure).length
  const globalObserved = valid.length ? pct(serverErrors, valid.length) : null
  const globalAttr =
    valid.length - globalProvider > 0
      ? pct(serverErrors - globalProvider, valid.length - globalProvider)
      : null
  slis.push(
    makeSli({
      id: 'G-01',
      group: 'platform',
      category: 'Plataforma',
      name: 'Tasa global de error de la API',
      slo: '≤ 2 %',
      comparison: '<=',
      target: 2,
      unit: '%',
      observed: globalObserved,
      attributable: globalAttr,
      samples: valid.length,
      status:
        valid.length < MIN_SAMPLES || globalAttr === null
          ? 'insufficient_sample'
          : evaluate(globalAttr, '<=', 2),
    }),
  )

  // D-01..D-04: probes of the external monitor.
  const monthProbes = input.probes
    .map((p) => ({ ...p, time: Date.parse(p.ts) }))
    .filter((p) => p.time >= periodStart && p.time < periodEnd)
  const probesOf = (targets: string[]) =>
    monthProbes.filter((p) => targets.includes(p.target) && !inside(p.time, maintenance))
  const availability = (
    id: string,
    name: string,
    targets: string[],
    limitMs: number,
    needsContent: boolean,
  ) => {
    const probes = probesOf(targets)
    const isGood = (p: SlaProbeRow) =>
      p.status === 200 &&
      p.durationMs !== null &&
      p.durationMs <= limitMs &&
      (!needsContent || p.contentOk)
    const good = probes.filter(isGood).length
    const providerFailures = probes.filter(
      (p) => !isGood(p) && inside(p.time, providerWindows),
    ).length
    return percentageSli(
      {
        id,
        group: 'platform',
        category: 'Plataforma',
        name,
        slo: '≥ 98 %',
        comparison: '>=',
        target: 98,
        unit: '%',
      },
      { good, total: probes.length, totalAttr: probes.length - providerFailures },
    )
  }
  slis.push(
    availability('D-01', 'Disponibilidad de la API y la base de datos', ['api:/api/ready', 'api:/api/health/ready'], 65_000, false),
    availability('D-02', 'Disponibilidad de la Web', ['web:/'], 20_000, true),
    availability('D-03', 'Conexión de la Web hacia la API', ['web:/api/health', 'web:/api/health/ready'], 65_000, true),
  )

  const coldStarts = monthProbes
    .filter((p) => p.coldStart && p.durationMs !== null)
    .map((p) => p.durationMs as number)
  const slowestCold = coldStarts.length ? round(Math.max(...coldStarts) / 1000, 2) : null
  slis.push(
    makeSli({
      id: 'D-04',
      group: 'platform',
      category: 'Plataforma',
      name: 'Arranque en frío',
      slo: '≤ 60 s',
      comparison: '<=',
      target: 60,
      unit: 's',
      observed: slowestCold,
      attributable: slowestCold,
      samples: coldStarts.length,
      status:
        slowestCold === null || coldStarts.length < MIN_COLD_STARTS
          ? 'insufficient_sample'
          : evaluate(slowestCold, '<=', 60),
      details: `Se requieren al menos ${MIN_COLD_STARTS} arranques en frío medidos.`,
    }),
  )

  // C-01: storage.
  const measurements = ofKind('storage_measurement')
    .map((r) => ({ bytes: detailNumber(r, 'bytes'), limit: detailNumber(r, 'limitBytes') }))
    .filter((m): m is { bytes: number; limit: number | null } => m.bytes !== null)
  const peak = measurements.reduce<{ bytes: number; limit: number | null } | null>(
    (best, m) => (best === null || m.bytes > best.bytes ? m : best),
    null,
  )
  const storagePct = peak ? round((100 * peak.bytes) / (peak.limit ?? DEFAULT_STORAGE_LIMIT_BYTES), 2) : null
  slis.push(
    makeSli({
      id: 'C-01',
      group: 'capacity',
      category: 'Capacidad',
      name: 'Uso de almacenamiento',
      slo: '≤ 80 %',
      comparison: '<=',
      target: 80,
      unit: '%',
      observed: storagePct,
      attributable: storagePct,
      samples: measurements.length,
      status: storagePct === null ? 'no_data' : evaluate(storagePct, '<=', 80),
      details: peak
        ? `Mayor medición: ${peak.bytes} bytes de ${peak.limit ?? DEFAULT_STORAGE_LIMIT_BYTES}.`
        : 'Sin mediciones en el mes.',
    }),
  )

  // C-02: latest load test up to the end of the month.
  const loadTest = input.records
    .filter((r) => r.kind === 'load_test' && (ms(r.occurredAt) ?? Infinity) < periodEnd)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
  let loadSli = makeSli({
    id: 'C-02',
    group: 'capacity',
    category: 'Capacidad',
    name: 'Latencia bajo carga de referencia',
    slo: 'Lectura ≤ 800 ms y escritura ≤ 1500 ms con ≥ 500 muestras cada una',
    comparison: '<=',
    target: 800,
    unit: 'ms',
    details: 'Sin prueba de carga registrada.',
  })
  if (loadTest) {
    const readP95 = detailNumber(loadTest, 'readP95Ms')
    const writeP95 = detailNumber(loadTest, 'writeP95Ms')
    const readSamples = detailNumber(loadTest, 'readSamples') ?? 0
    const writeSamples = detailNumber(loadTest, 'writeSamples') ?? 0
    const enough = readSamples >= MIN_LOAD_SAMPLES && writeSamples >= MIN_LOAD_SAMPLES
    const met = readP95 !== null && writeP95 !== null && readP95 <= 800 && writeP95 <= 1500
    loadSli = {
      ...loadSli,
      observed: readP95,
      attributable: readP95,
      samples: readSamples + writeSamples,
      status: !enough ? 'insufficient_sample' : met ? 'met' : 'unmet',
      details: `Versión ${detailString(loadTest, 'version') ?? 'n/d'} del ${loadTest.occurredAt}: lectura p95 ${readP95 ?? 'n/d'} ms (${readSamples} muestras), escritura p95 ${writeP95 ?? 'n/d'} ms (${writeSamples} muestras).`,
    }
  }
  slis.push(loadSli)

  // R-01: daily backups (calendar days elapsed in Mexico City time).
  const elapsedUntil = Math.min(periodEnd, nowMs)
  const elapsedDays: string[] = []
  for (
    let day = toLocal(periodStart);
    day < toLocal(elapsedUntil);
    day += DAY_MS
  ) {
    elapsedDays.push(new Date(day).toISOString().slice(0, 10))
  }
  const dayHasOk = (kind: SlaRecordKind) =>
    new Set(
      ofKind(kind)
        .filter((r) => detailOk(r) && (ms(r.occurredAt) as number) <= nowMs)
        .map((r) => localDateKey(Date.parse(r.occurredAt))),
    )
  const backupDays = dayHasOk('backup')
  const daysWithBackup = elapsedDays.filter((d) => backupDays.has(d)).length
  slis.push(
    percentageSli(
      {
        id: 'R-01',
        group: 'continuity',
        category: 'Continuidad',
        name: 'Respaldos diarios',
        slo: '100 %',
        comparison: '>=',
        target: 100,
        unit: '%',
        details: `${daysWithBackup} de ${elapsedDays.length} días con respaldo correcto.`,
      },
      { good: daysWithBackup, total: elapsedDays.length },
    ),
  )

  // R-02: latest successful restore drill within the three months ending at the month end.
  const drillWindowStart = parseSlaMonth(previousMonth(input.month, 2))!.start.getTime()
  const drill = input.records
    .filter((r) => {
      const at = ms(r.occurredAt)
      return (
        r.kind === 'restore_drill' &&
        detailOk(r) &&
        r.endedAt !== null &&
        at !== null &&
        at >= drillWindowStart &&
        at < periodEnd
      )
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
  const drillHours = drill
    ? round((Date.parse(drill.endedAt as string) - Date.parse(drill.occurredAt)) / HOUR_MS, 2)
    : null
  slis.push(
    makeSli({
      id: 'R-02',
      group: 'continuity',
      category: 'Continuidad',
      name: 'Restauración (RTO)',
      slo: '≤ 4 h',
      comparison: '<=',
      target: 4,
      unit: 'h',
      observed: drillHours,
      attributable: drillHours,
      samples: drill ? 1 : 0,
      status: drillHours === null ? 'unverified' : evaluate(drillHours, '<=', 4),
      details:
        drillHours === null
          ? 'Objetivo sin comprobar: no hay simulacro correcto en los últimos tres meses.'
          : `Simulacro del ${drill.occurredAt}.`,
    }),
  )

  // R-03: cleanup of expired codes on business days.
  const businessDays = elapsedDays.filter(isBusinessDayKey)
  const cleanupDays = dayHasOk('access_cleanup')
  const daysWithCleanup = businessDays.filter((d) => cleanupDays.has(d)).length
  slis.push(
    percentageSli(
      {
        id: 'R-03',
        group: 'continuity',
        category: 'Continuidad',
        name: 'Depuración de códigos caducados',
        slo: '≥ 95 %',
        comparison: '>=',
        target: 95,
        unit: '%',
        details: `${daysWithCleanup} de ${businessDays.length} días hábiles con depuración correcta.`,
      },
      { good: daysWithCleanup, total: businessDays.length },
    ),
  )

  // Incidents (section 9) and O-01 / O-02.
  const incidents: SlaIncidentResult[] = []
  for (const record of ofKind('support_incident')) {
    const severity = detailString(record, 'severity')
    if (severity !== 'alta' && severity !== 'media' && severity !== 'baja') continue
    const received = new Date(record.occurredAt)
    const ackWindow = { alta: 0.5, media: 1, baja: 4 }[severity] * HOUR_MS
    const ackDeadline = addBusinessTime(received, ackWindow)
    const resolveDeadline =
      severity === 'alta' && record.details.requiresRestore === true
        ? new Date(ackDeadline.getTime() + 4 * HOUR_MS)
        : addBusinessTime(received, { alta: 4, media: 9, baja: 45 }[severity] * HOUR_MS)
    const acknowledged = ms(detailString(record, 'acknowledgedAt'))
    const resolved = ms(record.endedAt)
    const verdict = (at: number | null, deadline: Date): boolean | null =>
      at !== null ? at <= deadline.getTime() : nowMs > deadline.getTime() ? false : null
    incidents.push({
      id: record.id,
      severity,
      receivedAt: received.toISOString(),
      ackDeadline: ackDeadline.toISOString(),
      acknowledgedAt: acknowledged === null ? null : new Date(acknowledged).toISOString(),
      ackOnTime: verdict(acknowledged, ackDeadline),
      resolveDeadline: resolveDeadline.toISOString(),
      resolvedAt: resolved === null ? null : new Date(resolved).toISOString(),
      resolvedOnTime: verdict(resolved, resolveDeadline),
      attributable: record.details.attributable === true,
      cause: detailString(record, 'cause') ?? '',
    })
  }
  const incidentSli = (id: string, name: string, target: number, field: 'ackOnTime' | 'resolvedOnTime') => {
    const judged = incidents.filter((i) => i[field] !== null)
    const onTime = judged.filter((i) => i[field] === true).length
    const perSeverity = (['alta', 'media', 'baja'] as const)
      .map((severity) => {
        const group = judged.filter((i) => i.severity === severity)
        const ok = group.filter((i) => i[field] === true).length
        return { severity, total: group.length, ok }
      })
      .filter((g) => g.total > 0)
    const met = perSeverity.every((g) => (100 * g.ok) / g.total >= target)
    const observed = judged.length ? pct(onTime, judged.length) : null
    return makeSli({
      id,
      group: 'operation',
      category: 'Operación',
      name,
      slo: `≥ ${target} %`,
      comparison: '>=',
      target,
      unit: '%',
      observed,
      attributable: observed,
      samples: judged.length,
      status: judged.length === 0 ? 'no_data' : met ? 'met' : 'unmet',
      details: perSeverity.length
        ? perSeverity.map((g) => `${g.severity}: ${g.ok}/${g.total}`).join('; ')
        : 'Sin incidentes en el mes.',
    })
  }
  slis.push(
    incidentSli('O-01', 'Acuse de incidentes', 95, 'ackOnTime'),
    incidentSli('O-02', 'Resolución de incidentes', 90, 'resolvedOnTime'),
  )

  // Maintenance (section 10) and O-03.
  const maintenanceWindows: SlaMaintenanceResult[] = ofKind('maintenance_window').map((r) => {
    const assessment = assessMaintenance(r)
    return {
      id: r.id,
      start: r.occurredAt,
      end: r.endedAt ?? r.occurredAt,
      notifiedAt: detailString(r, 'notifiedAt'),
      counted: assessment.counted,
      reason: assessment.reason,
    }
  })
  const noticed = ofKind('maintenance_window').filter((r) => {
    const notified = ms(detailString(r, 'notifiedAt'))
    return notified !== null && notified <= Date.parse(r.occurredAt) - 48 * HOUR_MS
  }).length
  slis.push(
    percentageSli(
      {
        id: 'O-03',
        group: 'operation',
        category: 'Operación',
        name: 'Aviso de mantenimiento',
        slo: '100 %',
        comparison: '>=',
        target: 100,
        unit: '%',
        details: 'Sin ventanas de mantenimiento en el mes.',
      },
      { good: noticed, total: maintenanceWindows.length },
    ),
  )

  // O-04: report of month M-1 sent before 18:00 of the fifth business day of M.
  const dueDay = nthBusinessDay(input.month, 5)
  const deadline = Date.UTC(
    Number(dueDay.slice(0, 4)),
    Number(dueDay.slice(5, 7)) - 1,
    Number(dueDay.slice(8, 10)),
    18,
  ) + MX_OFFSET_MS
  const reportPeriod = previousMonth(input.month, 1)
  const report = input.records
    .filter((r) => r.kind === 'monthly_report' && detailString(r, 'period') === reportPeriod)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))[0]
  slis.push(
    makeSli({
      id: 'O-04',
      group: 'operation',
      category: 'Operación',
      name: 'Puntualidad del reporte mensual',
      slo: '100 %',
      comparison: '>=',
      target: 100,
      unit: '%',
      observed: report ? (Date.parse(report.occurredAt) <= deadline ? 100 : 0) : null,
      attributable: report ? (Date.parse(report.occurredAt) <= deadline ? 100 : 0) : null,
      samples: report ? 1 : 0,
      status: report
        ? Date.parse(report.occurredAt) <= deadline
          ? 'met'
          : 'unmet'
        : 'no_data',
      details: report
        ? `Reporte de ${reportPeriod} enviado el ${report.occurredAt}; plazo ${new Date(deadline).toISOString()}.`
        : `Sin registro del envío del reporte de ${reportPeriod} (plazo ${new Date(deadline).toISOString()}).`,
    }),
  )

  // O-05: verified deployments.
  const deployments = ofKind('deployment')
  const verified = deployments.filter(
    (r) =>
      r.details.healthOk === true &&
      r.details.readinessOk === true &&
      r.details.functionalOk === true,
  ).length
  slis.push(
    percentageSli(
      {
        id: 'O-05',
        group: 'operation',
        category: 'Operación',
        name: 'Despliegues verificados',
        slo: '100 %',
        comparison: '>=',
        target: 100,
        unit: '%',
        details: 'Sin despliegues en el mes.',
      },
      { good: verified, total: deployments.length },
    ),
  )

  // Compensation (section 13).
  const reasons: string[] = []
  const availabilitySli = slis.find((s) => s.id === 'D-01')
  if (availabilitySli?.attributable != null && availabilitySli.attributable < 95) {
    reasons.push(`D-01 atribuible ${availabilitySli.attributable} % es menor a 95 %.`)
  }
  for (const incident of incidents) {
    if (incident.severity !== 'alta' || !incident.attributable) continue
    const until = incident.resolvedAt ? new Date(incident.resolvedAt) : input.now
    const hours = businessTimeBetween(new Date(incident.receivedAt), until) / HOUR_MS
    if (hours > 8) {
      reasons.push(
        `El incidente de severidad alta ${incident.id} tardó ${round(hours, 2)} horas hábiles en resolverse (máximo 8).`,
      )
    }
  }

  const count = (status: SlaSliStatus) => slis.filter((s) => s.status === status).length
  return {
    version: '3.0',
    month: input.month,
    timeZone: 'America/Mexico_City',
    period: { start: bounds.start.toISOString(), end: bounds.end.toISOString() },
    generatedAt: input.now.toISOString(),
    slis,
    incidents,
    maintenanceWindows,
    compensation: { due: reasons.length > 0, reasons },
    summary: {
      total: slis.length,
      met: count('met'),
      unmet: count('unmet'),
      insufficient: count('insufficient_sample'),
      noData: count('no_data'),
      unverified: count('unverified'),
    },
  }
}

/** Local date key (`YYYY-MM-DD`) of the nth business day of the month. */
function nthBusinessDay(month: string, nth: number): string {
  const start = toLocal(parseSlaMonth(month)!.start.getTime())
  let seen = 0
  for (let day = start; ; day += DAY_MS) {
    const key = new Date(day).toISOString().slice(0, 10)
    if (isBusinessDayKey(key)) seen += 1
    if (seen === nth) return key
  }
}

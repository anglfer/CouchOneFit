import type {
  ComparisonOperator,
  ComplianceStatus,
  EvaluationSnapshot,
  ObservabilityPeriod,
  RawCheckSample,
  RawLogSample,
  SliDefinition,
  SliWithValue,
  SloDefinition,
  SloEvaluated,
} from '../types/observability.js'
import { isOperationalRequest, isServiceAvailabilityCheck, mean, percentile, periodWindow, round } from '../utils/classify.js'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function matchesExclusion(path: string | null, patterns: string[] = []): boolean {
  if (!path) return false
  return patterns.some((pattern) => path.startsWith(pattern.replace(/^\^|\*$/g, '')))
}

function matchesSliCheck(sli: SliDefinition, check: RawCheckSample): boolean {
  if (check.phase === 'recovery-drill' || check.runCategory === 'manual_admin') return false
  if (sli.dataSource === 'synthetic_availability' && !isServiceAvailabilityCheck(check)) return false
  if (sli.dataSource === 'synthetic_functional' && check.checkKind !== 'synthetic_functional') return false
  if (sli.dataSource === 'automated_tests' && check.checkKind !== 'automated_test' && check.checkKind !== 'load_scenario') return false
  if (sli.service !== 'platform' && sli.service !== 'all' && check.service !== sli.service && check.module !== sli.service) return false
  const module = sli.calculationMethod.module?.trim().toLowerCase()
  return !module || check.module.toLowerCase() === module
}

export interface OutageWindow {
  target: string
  from: string
  to: string | null
  durationS: number
  open: boolean
}

export function computeSyntheticOutages(checks: RawCheckSample[]): OutageWindow[] {
  const byTarget = new Map<string, RawCheckSample[]>()
  for (const check of checks) {
    if (check.phase === 'recovery-drill') continue
    if (check.status !== 'passed' && check.status !== 'failed') continue
    const key = check.target || check.checkKey
    const list = byTarget.get(key)
    if (list) list.push(check)
    else byTarget.set(key, [check])
  }

  const windows: OutageWindow[] = []
  for (const [target, list] of byTarget) {
    const sorted = [...list].sort(
      (a, b) => Date.parse(a.executedAt) - Date.parse(b.executedAt),
    )
    let openSince: string | null = null
    for (const item of sorted) {
      if (item.status === 'failed') {
        if (openSince === null) openSince = item.executedAt
      } else if (openSince !== null) {
        windows.push({
          target,
          from: openSince,
          to: item.executedAt,
          durationS:
            Math.max(0, Date.parse(item.executedAt) - Date.parse(openSince)) / 1000,
          open: false,
        })
        openSince = null
      }
    }
    if (openSince !== null) {
      const lastTs = sorted.at(-1)?.executedAt ?? openSince
      windows.push({
        target,
        from: openSince,
        to: null,
        durationS:
          Math.max(0, Date.parse(lastTs) - Date.parse(openSince)) / 1000,
        open: true,
      })
    }
  }
  return windows
}

export function computeSliValue(
  sli: SliDefinition,
  logs: RawLogSample[],
  checks: RawCheckSample[],
): {
  value: number | null
  samples: number
  notExecutedCount: number
  openOutages: number
  note: string | null
  matchingCount?: number
} {
  const method = sli.calculationMethod ?? {}
  const targetModule = method.module?.trim().toLowerCase()
  const excludePaths = method.excludePaths

  if (
    sli.dataSource === 'operational_http' ||
    sli.dataSource === 'client_telemetry'
  ) {
    const filteredLogs = logs.filter((entry) => {
      if (sli.dataSource === 'client_telemetry') {
        if (entry.source !== 'client_telemetry') return false
      } else {
        if (!isOperationalRequest(entry)) return false
        if (matchesExclusion(entry.normalizedPath, excludePaths)) return false
        if (method.methods?.length && !method.methods.includes(entry.httpMethod ?? '')) return false
        if (method.pathPrefix && !entry.normalizedPath?.startsWith(method.pathPrefix)) return false
        if (method.statusCodes?.length && !method.statusCodes.includes(entry.statusCode ?? 0)) return false
      }
      if (
        sli.service &&
        sli.service !== 'platform' &&
        sli.service !== 'all' &&
        sli.service !== 'api' &&
        entry.service !== sli.service &&
        entry.module !== sli.service
      ) {
        return false
      }
      if (targetModule && entry.module.toLowerCase() !== targetModule) {
        return false
      }
      return true
    })

    if (sli.dataSource === 'client_telemetry') {
      const total = filteredLogs.length
      if (!total) {
        return {
          value: null,
          samples: 0,
          notExecutedCount: 0,
          openOutages: 0,
          note: 'Sin eventos de telemetría cliente en el periodo.',
        }
      }
      const recovered = filteredLogs.filter(
        (e) => e.outcome === 'recovered',
      ).length
      const failures = filteredLogs.filter(
        (e) => e.severity === 'error' || e.outcome === 'server_error',
      ).length
      const val =
        sli.indicatorType === 'error_rate'
          ? round((failures / total) * 100, 2)
          : round((recovered / total) * 100, 2)
      return {
        value: val,
        samples: total,
        notExecutedCount: 0,
        openOutages: 0,
        note: null,
      }
    }

    const requests = filteredLogs.filter((e) => e.eventType === 'http.request')
    const aborted = filteredLogs.filter((e) => e.eventType === 'http.aborted')

    if (sli.indicatorType === 'error_rate') {
      if (!requests.length) {
        return {
          value: null,
          samples: 0,
          notExecutedCount: 0,
          openOutages: 0,
          note: 'Sin solicitudes HTTP elegibles.',
        }
      }
      const errors = requests.filter((e) => (e.statusCode ?? 0) >= 500).length
      return {
        value: round((errors / requests.length) * 100, 2),
        samples: requests.length,
        notExecutedCount: 0,
        openOutages: 0,
        note: null,
      }
    }

    if (
      sli.indicatorType === 'operation_success_rate' ||
      sli.indicatorType === 'reliability'
    ) {
      const allowedMethods = new Set(
        (method.methods?.length ? method.methods : [...MUTATING_METHODS]).map(
          (m) => m.toUpperCase(),
        ),
      )
      let success = 0
      let failure = 0
      for (const item of requests) {
        const m = (item.httpMethod ?? '').toUpperCase()
        if (!allowedMethods.has(m)) continue
        const status = item.statusCode ?? 0
        if (status >= 500) failure += 1
        else if (status >= 200 && status < 400) success += 1
      }
      for (const item of aborted) {
        const m = (item.httpMethod ?? '').toUpperCase()
        if (allowedMethods.has(m)) failure += 1
      }
      const total = success + failure
      if (!total) {
        return {
          value: null,
          samples: 0,
          notExecutedCount: 0,
          openOutages: 0,
          note: 'Sin operaciones elegibles en el periodo.',
        }
      }
      return {
        value: round((success / total) * 100, 2),
        samples: total,
        notExecutedCount: 0,
        openOutages: 0,
        note: null,
      }
    }

    if (sli.indicatorType === 'availability') {
      const total = requests.length + aborted.length
      if (!total) {
        return {
          value: null,
          samples: 0,
          notExecutedCount: 0,
          openOutages: 0,
          note: 'Sin tráfico registrado en el periodo.',
        }
      }
      const failed =
        requests.filter((e) => (e.statusCode ?? 0) >= 500).length +
        aborted.length
      return {
        value: round(((total - failed) / total) * 100, 2),
        samples: total,
        notExecutedCount: 0,
        openOutages: 0,
        note: null,
      }
    }

    const durations = requests
      .map((e) => e.durationMs)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (!durations.length) {
      return {
        value: null,
        samples: 0,
        notExecutedCount: 0,
        openOutages: 0,
        note: 'Sin mediciones de latencia en el periodo.',
      }
    }
    if (sli.indicatorType === 'latency_mean') {
      return {
        value: round(mean(durations), 1),
        samples: durations.length,
        notExecutedCount: 0,
        openOutages: 0,
        note: null,
      }
    }
    if (sli.indicatorType === 'latency_percentile') {
      const p = method.percentile ?? 95
      return {
        value: round(percentile(durations, p), 1),
        samples: durations.length,
        notExecutedCount: 0,
        openOutages: 0,
        note: null,
      }
    }
    if (sli.indicatorType === 'latency_threshold_pct') {
      const threshold = method.thresholdMs ?? 1000
      const within = durations.filter((d) => d < threshold).length
      return {
        value: round((within / durations.length) * 100, 2),
        samples: durations.length,
        notExecutedCount: 0,
        openOutages: 0,
        note: `Consultas con duración < ${threshold} ms`,
      }
    }
  }

  const filteredChecks = checks.filter((check) => matchesSliCheck(sli, check))

  const notExecutedCount = filteredChecks.filter(
    (c) => c.status === 'not_executed' || c.status === 'blocked',
  ).length
  const executed = filteredChecks.filter(
    (c) => c.status === 'passed' || c.status === 'failed',
  )

  if (sli.indicatorType === 'recovery_time') {
    const outages = computeSyntheticOutages(filteredChecks)
    if (!outages.length) {
      return {
        value: null,
        samples: 0,
        notExecutedCount,
        openOutages: 0,
        note: 'Sin interrupciones registradas en el periodo.',
      }
    }
    const openOutages = outages.filter((o) => o.open).length
    const maxS = Math.max(...outages.map((o) => o.durationS))
    return {
      value: round(maxS, 1),
      samples: outages.length,
      notExecutedCount,
      openOutages,
      note: openOutages > 0 ? 'Existe al menos una interrupción abierta.' : null,
    }
  }

  if (
    sli.indicatorType === 'availability' ||
    sli.indicatorType === 'functional_test_success' ||
    sli.indicatorType === 'reliability' ||
    sli.indicatorType === 'operation_success_rate'
  ) {
    const denominator = method.includeNotExecuted
      ? executed.length + notExecutedCount
      : executed.length
    if (!denominator) {
      return {
        value: null,
        samples: 0,
        notExecutedCount,
        openOutages: 0,
        note:
          notExecutedCount > 0
            ? `${notExecutedCount} comprobación(es) no ejecutada(s); sin base evaluable.`
            : 'Sin comprobaciones ejecutadas en el periodo.',
      }
    }
    const passed = executed.filter((c) => c.status === 'passed').length
    return {
      value: round((passed / denominator) * 100, 2),
      samples: denominator,
      matchingCount: passed,
      notExecutedCount,
      openOutages: 0,
      note:
        notExecutedCount > 0
          ? method.includeNotExecuted
            ? `${notExecutedCount} comprobación(es) sin ejecutar incluidas en el denominador.`
            : `${notExecutedCount} comprobación(es) sin ejecutar excluidas del denominador.`
          : null,
    }
  }

  if (sli.indicatorType === 'error_rate') {
    if (!executed.length) {
      return {
        value: null,
        samples: 0,
        notExecutedCount,
        openOutages: 0,
        note: 'Sin comprobaciones ejecutadas en el periodo.',
      }
    }
    const failed = executed.filter((c) => c.status === 'failed').length
    return {
      value: round((failed / executed.length) * 100, 2),
      samples: executed.length,
      matchingCount: failed,
      notExecutedCount,
      openOutages: 0,
      note: null,
    }
  }

  const durations = executed
    .filter((c) => c.status === 'passed')
    .map((c) => c.durationMs)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (!durations.length) {
    return {
      value: null,
      samples: 0,
      notExecutedCount,
      openOutages: 0,
      note: 'Sin latencias exitosas en el periodo.',
    }
  }
  if (sli.indicatorType === 'latency_mean') {
    return {
      value: round(mean(durations), 1),
      samples: durations.length,
      notExecutedCount,
      openOutages: 0,
      note: null,
    }
  }
  if (sli.indicatorType === 'latency_percentile') {
    const p = method.percentile ?? 95
    return {
      value: round(percentile(durations, p), 1),
      samples: durations.length,
      notExecutedCount: 0,
      openOutages: 0,
      note: null,
    }
  }
  if (sli.indicatorType === 'latency_threshold_pct') {
    const threshold = method.thresholdMs ?? 1000
    const within = durations.filter((d) => d < threshold).length
    return {
      value: round((within / durations.length) * 100, 2),
      samples: durations.length,
      notExecutedCount,
      openOutages: 0,
      note: `Comprobaciones con duración < ${threshold} ms`,
    }
  }

  return {
    value: null,
    samples: 0,
    notExecutedCount,
    openOutages: 0,
    note: 'Combinación de fuente e indicador sin muestras aplicables.',
  }
}

export function compareThreshold(
  observed: number,
  operator: ComparisonOperator,
  target: number,
): boolean {
  switch (operator) {
    case '>=':
      return observed >= target
    case '<=':
      return observed <= target
    case '>':
      return observed > target
    case '<':
      return observed < target
  }
}

function computeErrorBudget(
  slo: SloDefinition,
  observedValue: number | null,
): {
  total: number | null
  consumed: number | null
  remainingPct: number | null
} {
  if (slo.unit !== '%') {
    return { total: null, consumed: null, remainingPct: null }
  }
  if (slo.comparisonOperator === '>=' || slo.comparisonOperator === '>') {
    const total = round(Math.max(0, 100 - slo.targetValue), 3) ?? 0
    if (total <= 0) {
      return { total: 0, consumed: null, remainingPct: null }
    }
    if (observedValue === null) {
      return { total, consumed: null, remainingPct: null }
    }
    const consumed = round(Math.max(0, 100 - observedValue), 3) ?? 0
    const remainingPct = round(
      Math.max(0, ((total - consumed) / total) * 100),
      1,
    )
    return { total, consumed, remainingPct }
  }
  if (slo.comparisonOperator === '<=' || slo.comparisonOperator === '<') {
    const total = round(Math.max(0, slo.targetValue), 3) ?? 0
    if (total <= 0) {
      return { total: 0, consumed: null, remainingPct: null }
    }
    if (observedValue === null) {
      return { total, consumed: null, remainingPct: null }
    }
    const consumed = round(Math.max(0, observedValue), 3) ?? 0
    const remainingPct = round(
      Math.max(0, ((total - consumed) / total) * 100),
      1,
    )
    return { total, consumed, remainingPct }
  }
  return { total: null, consumed: null, remainingPct: null }
}

function resolveTrend(
  currentValue: number | null,
  previousValue: number | null,
  operator: ComparisonOperator,
): 'improving' | 'worsening' | 'stable' | 'insufficient_data' {
  if (currentValue === null || previousValue === null) {
    return 'insufficient_data'
  }
  const diff = currentValue - previousValue
  if (Math.abs(diff) < 0.05) return 'stable'
  const higherIsBetter = operator === '>=' || operator === '>'
  if (higherIsBetter) return diff > 0 ? 'improving' : 'worsening'
  return diff < 0 ? 'improving' : 'worsening'
}

function measurementStart(
  period: ObservabilityPeriod,
  asOf: Date,
  selectedPeriod?: ObservabilityPeriod,
  ...limits: Array<string | null | undefined>
): number {
  const start = periodWindow(period, asOf).start.getTime()
  const selectedStart = selectedPeriod ? periodWindow(selectedPeriod, asOf).start.getTime() : start
  return Math.max(start, selectedStart, ...limits.filter((value) => value != null).map((value) => new Date(value).getTime()))
}

function measure(
  sli: SliDefinition,
  samples: EvaluationSnapshot,
  from: number,
  to: number,
  endInclusive = true,
): ReturnType<typeof computeSliValue> {
  const isLogSource = sli.dataSource === 'operational_http' || sli.dataSource === 'client_telemetry'
  const logs = isLogSource ? samples.logs : []
  const checks = isLogSource ? [] : samples.checks
  const within = (timestamp: string) => {
    const time = new Date(timestamp).getTime()
    return time >= from && (endInclusive ? time <= to : time < to)
  }
  const logStart = logs.at(-1)?.occurredAt
  const checkStart = checks.at(-1)?.executedAt
  const truncated = isLogSource
    ? samples.logsTruncated && logStart && new Date(logStart).getTime() >= from
    : samples.checksTruncated && checkStart && new Date(checkStart).getTime() >= from
  if (truncated) {
    return {
      value: null,
      samples: 0,
      notExecutedCount: 0,
      openOutages: 0,
      note: 'La ventana excede el límite de muestras disponibles para el cálculo.',
    }
  }
  const measured = computeSliValue(
    sli,
    logs.filter((log) => within(log.occurredAt)),
    checks.filter((check) => within(check.executedAt)),
  )
  if (measured.value !== null && endInclusive && samples.settings.monitorEnabled &&
    (sli.dataSource === 'synthetic_availability' || sli.dataSource === 'synthetic_functional')) {
    const latest = checks.find((check) => matchesSliCheck(sli, check) && within(check.executedAt))
    if (latest && to - new Date(latest.executedAt).getTime() > (2 * samples.settings.checkIntervalMinutes + 5) * 60_000) {
      return { ...measured, value: null, note: 'Sin comprobaciones recientes para confirmar el cumplimiento.' }
    }
  }
  return measured
}

export function evaluateSlis(
  slis: SliDefinition[],
  snapshot: EvaluationSnapshot,
  asOf: Date,
  selectedPeriod?: ObservabilityPeriod,
): SliWithValue[] {
  return slis.map((sli) => {
    const since = measurementStart(sli.evaluationPeriod, asOf, selectedPeriod, sli.versionFrom)
    const calc = measure(sli, snapshot, since, asOf.getTime())
    return {
      ...sli,
      observedValue: sli.isActive ? calc.value : null,
      samples: sli.isActive ? calc.samples : 0,
      notExecutedCount: sli.isActive ? calc.notExecutedCount : 0,
      note: sli.isActive ? calc.note : 'SLI desactivado.',
    }
  })
}

export function evaluateSlos(
  slos: SloDefinition[],
  sliById: Map<string, SliDefinition>,
  snapshot: EvaluationSnapshot,
  asOf: Date,
  selectedPeriod?: ObservabilityPeriod,
  validSince?: string,
): SloEvaluated[] {
  const end = asOf.getTime()
  return slos.map((slo) => {
    const sli = sliById.get(slo.sliId)
    const startsAt = new Date(slo.effectiveFrom).getTime()
    const endsAt = slo.effectiveTo ? new Date(slo.effectiveTo).getTime() : Infinity
    const inForce = end >= startsAt && end < endsAt
    const since = Math.min(end, measurementStart(
      slo.evaluationPeriod, asOf, selectedPeriod, slo.effectiveFrom, slo.versionFrom, sli?.versionFrom, validSince,
    ))
    const window = {
      periodStart: new Date(since).toISOString(),
      periodEnd: asOf.toISOString(),
    }
    if (!sli || !sli.isActive || sli.unit !== slo.unit || slo.status !== 'active' || !inForce) {
      const note = !sli
        ? 'SLI asociado no encontrado.'
        : slo.status !== 'active'
          ? 'SLO inactivo o archivado.'
          : !inForce
            ? 'SLO fuera de vigencia.'
            : !sli.isActive
              ? 'El SLI asociado está desactivado.'
              : 'La unidad del SLI asociado cambió. Actualiza el objetivo.'
      return {
        ...slo,
        ...window,
        observedValue: null,
        deltaValue: null,
        samples: 0,
        notExecutedCount: 0,
        complianceStatus: 'insufficient_data',
        errorBudgetTotal: null,
        errorBudgetConsumed: null,
        errorBudgetRemainingPct: null,
        trendDirection: 'insufficient_data',
        previousObservedValue: null,
        notes: note,
      }
    }

    const currentCalc = measure(sli, snapshot, since, end)
    const previousSince = measurementStart(
      slo.evaluationPeriod, new Date(since), selectedPeriod, slo.effectiveFrom, slo.versionFrom, sli.versionFrom, validSince,
    )
    const prevCalc = measure(sli, snapshot, previousSince, since, false)
    const previousObservedValue = prevCalc.samples >= slo.minSamples && prevCalc.notExecutedCount === 0
      ? prevCalc.value
      : null
    const budget = computeErrorBudget(slo, currentCalc.value)
    const trendDirection = resolveTrend(
      currentCalc.samples >= slo.minSamples && currentCalc.notExecutedCount === 0 ? currentCalc.value : null,
      previousObservedValue,
      slo.comparisonOperator,
    )

    let complianceStatus: ComplianceStatus = 'insufficient_data'
    let notes = currentCalc.note

    const executedSamples = sli.calculationMethod.includeNotExecuted && currentCalc.matchingCount !== undefined &&
      sli.indicatorType !== 'error_rate'
      ? currentCalc.samples - currentCalc.notExecutedCount
      : currentCalc.samples
    if (currentCalc.value !== null && executedSamples >= slo.minSamples) {
      const meets = compareThreshold(currentCalc.value, slo.comparisonOperator, slo.targetValue)
      if (meets && currentCalc.openOutages > 0) {
        notes = 'Interrupción abierta en curso; recuperación pendiente.'
      } else if (currentCalc.notExecutedCount > 0) {
        const observed = currentCalc.matchingCount
        if (observed !== undefined) {
          const total = executedSamples + currentCalc.notExecutedCount
          const lower = compareThreshold((observed / total) * 100, slo.comparisonOperator, slo.targetValue)
          const upper = compareThreshold(((observed + currentCalc.notExecutedCount) / total) * 100, slo.comparisonOperator, slo.targetValue)
          if (lower === upper) complianceStatus = lower ? 'met' : 'unmet'
        }
        notes = `${currentCalc.notExecutedCount} comprobación(es) sin ejecutar dentro del periodo.`
      } else {
        complianceStatus = meets ? 'met' : 'unmet'
      }
    } else if (executedSamples > 0 && executedSamples < slo.minSamples) {
      notes = `Muestras insuficientes (${executedSamples}/${slo.minSamples} requeridas).`
    }

    return {
      ...slo,
      ...window,
      sliCode: sli.code,
      sliName: sli.name,
      sliService: sli.service,
      observedValue: currentCalc.value,
      deltaValue: currentCalc.value === null ? null : round(currentCalc.value - slo.targetValue, 2),
      samples: currentCalc.samples,
      notExecutedCount: currentCalc.notExecutedCount,
      complianceStatus,
      errorBudgetTotal: budget.total,
      errorBudgetConsumed: budget.consumed,
      errorBudgetRemainingPct: budget.remainingPct,
      trendDirection,
      previousObservedValue,
      notes,
    }
  })
}

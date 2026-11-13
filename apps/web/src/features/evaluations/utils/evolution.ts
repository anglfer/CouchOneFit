import { methods, measurementFields } from '../types/assessment';
import type { EvolutionMetric, EvolutionSample } from '../types/evolution';

export interface EvolutionFilters {
  from: string;
  to: string;
  method: '' | 'legacy' | 'perimetros' | 'pliegues' | 'bioimpedancia';
}
export const ALL_EVOLUTION: EvolutionFilters = { from: '', to: '', method: '' };
export function isHistoryDate(value: string): boolean {
  return (
    /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateEvolutionFilters(
  filters: EvolutionFilters
): string | null {
  if (
    (filters.from && !isHistoryDate(filters.from)) ||
    (filters.to && !isHistoryDate(filters.to))
  )
    return 'Introduce fechas calendario válidas.';
  if (filters.from && filters.to && filters.from > filters.to)
    return 'La fecha inicial no puede ser posterior a la final.';
  if (
    !['', 'legacy', 'perimetros', 'pliegues', 'bioimpedancia'].includes(
      filters.method
    )
  )
    return 'Selecciona un método válido.';
  return null;
}
/** Inclusive UTC calendar days: 30 days includes today and the preceding 29. */
export function quickEvolutionPeriod(
  days: number,
  now = new Date()
): Pick<EvolutionFilters, 'from' | 'to'> {
  if (!Number.isInteger(days) || days < 1)
    throw Error('Invalid calendar period');
  const to = now.toISOString().slice(0, 10);
  const start = new Date(`${to}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: start.toISOString().slice(0, 10), to };
}
export function evolutionDate(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}
export function evolutionValue(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
export const evolutionMethod = (method: EvolutionSample['method']) =>
  methods.find((m) => m.id === method)?.label ??
  'Heredada · método desconocido';
export const evolutionProvenance = (value: EvolutionSample['provenance']) =>
  value === 'device_reported'
    ? 'Declarada: dispositivo'
    : value === 'manual_measurements'
      ? 'Declarada: mediciones manuales'
      : 'Procedencia no registrada';
export const evolutionMetricLabel = (metric: EvolutionMetric) =>
  measurementFields[metric][0];
export function compareHistory(a: EvolutionSample, b: EvolutionSample): number {
  const stamp = (v: string) => {
    const [whole, fraction = ''] = v.slice(0, -1).split('.');
    return `${whole}.${fraction.padEnd(6, '0')}Z`;
  };
  const aa = [a.date, stamp(a.createdAt), a.id.toLowerCase()],
    bb = [b.date, stamp(b.createdAt), b.id.toLowerCase()];
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] < bb[i]) return -1;
    if (aa[i] > bb[i]) return 1;
  }
  return 0;
}
export function mergeEvolutionSamples(
  previous: EvolutionSample[],
  incoming: EvolutionSample[]
): EvolutionSample[] {
  const rows = new Map(previous.map((s) => [s.id.toLowerCase(), s]));
  for (const sample of incoming)
    if (!rows.has(sample.id.toLowerCase()))
      rows.set(sample.id.toLowerCase(), sample);
  return [...rows.values()].sort(compareHistory);
}

export interface EvolutionSegment {
  from: EvolutionSample;
  to: EvolutionSample;
  fromIds: string[];
  toIds: string[];
  heterogeneous: boolean;
}
export function hasEvolutionMeasurement(
  sample: EvolutionSample,
  metric: EvolutionMetric
): boolean {
  const value = sample.measurements[metric];
  return typeof value === 'number' && Number.isFinite(value);
}
const historyContext = (s: EvolutionSample) =>
  JSON.stringify([s.method, s.provenance, s.protocol, s.dateBasis, s.source]);
const manualContext = (s: EvolutionSample) =>
  ['perimetros', 'pliegues'].includes(s.method ?? '') &&
  s.provenance === 'manual_measurements' &&
  !!s.protocol?.trim() &&
  s.dateBasis === 'effective_date' &&
  s.source === 'professional_evaluation';
function visualSegment(
  from: EvolutionSample[],
  to: EvolutionSample[]
): EvolutionSegment {
  const endpoints = [...from, ...to];
  return {
    from: from[0],
    to: to[0],
    fromIds: from.map((s) => s.id),
    toIds: to.map((s) => s.id),
    heterogeneous:
      endpoints.some((s) => !manualContext(s)) ||
      new Set(endpoints.map(historyContext)).size > 1,
  };
}
/** Weight positions with identical date/value retain ALL IDs: no averaging, new samples or intraday ordering. */
export function weightGuides(
  samples: readonly EvolutionSample[],
  hasMore = false
): EvolutionSegment[] {
  const clients = new Map<string, EvolutionSample[]>();
  for (const sample of [...samples].sort(compareHistory)) {
    const group = clients.get(sample.clientId) ?? [];
    group.push(sample);
    clients.set(sample.clientId, group);
  }
  const segments: EvolutionSegment[] = [];
  for (const rows of clients.values()) {
    const days = new Map<string, EvolutionSample[]>();
    for (const row of rows) {
      const day = days.get(row.date) ?? [];
      day.push(row);
      days.set(row.date, day);
    }
    const frontier = hasMore ? rows.at(-1)?.date : null;
    let previous: EvolutionSample[] | null = null;
    for (const [date, day] of days) {
      const values = day.filter((s) => hasEvolutionMeasurement(s, 'weightKg'));
      if (
        date === frontier ||
        values.length === 0 ||
        new Set(values.map((s) => s.measurements.weightKg)).size !== 1
      ) {
        previous = null;
        continue;
      }
      if (previous) segments.push(visualSegment(previous, values));
      previous = values;
    }
  }
  return segments;
}
/** Explain unlinked positions without exposing technical timestamps as measurement times. */
export function evolutionSeparations(
  samples: readonly EvolutionSample[],
  metric: EvolutionMetric,
  hasMore = false
): string[] {
  const reasons: string[] = [];
  if (metric === 'weightKg') {
    const days = new Map<string, Set<number>>();
    for (const s of samples)
      if (hasEvolutionMeasurement(s, metric)) {
        const key = JSON.stringify([s.clientId, s.date]);
        const day = days.get(key) ?? new Set<number>();
        day.add(s.measurements[metric]!);
        days.set(key, day);
      }
    const ambiguous = [...days.entries()]
      .filter(([, v]) => v.size > 1)
      .map(([key]) => evolutionDate(JSON.parse(key)[1]));
    if (ambiguous.length)
      reasons.push(
        `Pesos distintos sin orden intradía: ${ambiguous.slice(0, 3).join(', ')}${ambiguous.length > 3 ? '…' : ''}. Esos días quedan separados.`
      );
  } else if (
    samples.some((s) => hasEvolutionMeasurement(s, metric) && !manualContext(s))
  )
    reasons.push(
      'Hay registros sin protocolo comparable o sin identificación del equipo; se muestran separados.'
    );
  if (samples.some((s) => !hasEvolutionMeasurement(s, metric)))
    reasons.push(
      'Los días sin esta medición cortan la guía; los valores ausentes siguen en la tabla.'
    );
  if (hasMore)
    reasons.push(
      'Historial parcial: el último día cargado queda sin segmentos hasta cargar más.'
    );
  return reasons;
}
/** Visual links only: never create samples, interpolate values or use creation as measurement time. */
export function evolutionSegments(
  samples: readonly EvolutionSample[],
  metric: EvolutionMetric,
  hasMore = false
): EvolutionSegment[] {
  if (metric === 'weightKg') return weightGuides(samples, hasMore);
  const groups = new Map<string, EvolutionSample[]>();
  const frontier = hasMore
    ? samples.reduce(
        (day, sample) => (sample.date > day ? sample.date : day),
        ''
      )
    : null;
  for (const sample of [...samples].sort(compareHistory)) {
    // Unknown legacy provenance and generic device_reported do not establish a comparable protocol/device.
    if (
      !['perimetros', 'pliegues'].includes(sample.method ?? '') ||
      sample.provenance !== 'manual_measurements' ||
      !sample.protocol?.trim() ||
      sample.dateBasis !== 'effective_date' ||
      sample.source !== 'professional_evaluation'
    )
      continue;
    const key = JSON.stringify([
      sample.clientId,
      metric,
      measurementFields[metric][1],
      sample.method,
      sample.provenance,
      sample.protocol,
      sample.dateBasis,
      sample.source,
    ]);
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  const segments: EvolutionSegment[] = [];
  for (const group of groups.values()) {
    const days = new Map<string, number>();
    for (const sample of group)
      days.set(sample.date, (days.get(sample.date) ?? 0) + 1);
    let previous: EvolutionSample | null = null;
    for (const sample of group) {
      // Break both sides of missing/ambiguous dates; never select an arbitrary same-day reading.
      if (
        !hasEvolutionMeasurement(sample, metric) ||
        sample.date === frontier ||
        days.get(sample.date)! > 1
      ) {
        previous = null;
        continue;
      }
      if (previous && previous.date < sample.date)
        segments.push(visualSegment([previous], [sample]));
      previous = sample;
    }
  }
  return segments;
}

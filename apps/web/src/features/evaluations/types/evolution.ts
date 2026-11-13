import { measurementFields, type Method } from './assessment';

export type EvolutionMetric = keyof typeof measurementFields;
export interface EvolutionSample {
  id: string;
  clientId: string;
  date: string;
  dateBasis: 'effective_date' | 'legacy_evaluation_date';
  createdAt: string;
  source: 'professional_evaluation';
  method: Method | null;
  provenance: 'device_reported' | 'manual_measurements' | null;
  protocol: string | null;
  measurements: Partial<Record<EvolutionMetric, number>>;
}
export interface EvolutionPage {
  clientId: string;
  period: { from: string | null; to: string | null };
  method: Method | 'legacy' | null;
  order: 'asc';
  metricDefinitions: Record<
    EvolutionMetric,
    { label: string; unit: string; decimalPlaces: 1 }
  >;
  samples: EvolutionSample[];
  pageInfo: { pageSize: number; hasMore: boolean; nextCursor: string | null };
}
export type EvolutionSection =
  | { status: 'empty'; history: EvolutionPage }
  | { status: 'available'; history: EvolutionPage }
  | { status: 'error'; code: 'QUERY_FAILED' };

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
const methods = ['perimetros', 'pliegues', 'bioimpedancia'];
const timestamp = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/.test(
    v
  ) &&
  date(v.slice(0, 10));
const cursor = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 4096 &&
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(v);
/** Contract validation only: the server is the authority for identity, scope and RLS. */
export function isEvolutionPage(
  value: unknown,
  clientId: string
): value is EvolutionPage {
  if (
    !object(value) ||
    value.clientId !== clientId ||
    !uuid(value.clientId) ||
    value.order !== 'asc' ||
    !object(value.period) ||
    !object(value.pageInfo) ||
    !object(value.metricDefinitions) ||
    !Array.isArray(value.samples)
  )
    return false;
  const period = value.period;
  if (
    !(period.from === null || date(period.from)) ||
    !(period.to === null || date(period.to)) ||
    (typeof period.from === 'string' &&
      typeof period.to === 'string' &&
      period.from > period.to)
  )
    return false;
  if (!(
    value.method === null ||
    (typeof value.method === 'string' &&
      [...methods, 'legacy'].includes(value.method))
  ))
    return false;
  const info = value.pageInfo;
  if (
    typeof info.pageSize !== 'number' ||
    !Number.isInteger(info.pageSize) ||
    info.pageSize < 1 ||
    info.pageSize > 100 ||
    typeof info.hasMore !== 'boolean' ||
    !(info.hasMore ? cursor(info.nextCursor) : info.nextCursor === null) ||
    value.samples.length > info.pageSize ||
    (info.hasMore && value.samples.length !== info.pageSize)
  )
    return false;
  const definitions = value.metricDefinitions;
  if (
    Object.keys(definitions).length !== Object.keys(measurementFields).length ||
    !Object.entries(measurementFields).every(([key, meta]) => {
      const d = definitions[key];
      return (
        object(d) &&
        typeof d.label === 'string' &&
        d.unit === meta[1] &&
        d.decimalPlaces === 1
      );
    })
  )
    return false;
  const seen = new Set<string>();
  let previous: string[] | null = null;
  return value.samples.every((s) => {
    if (
      !object(s) ||
      !uuid(s.id) ||
      seen.has(s.id) ||
      s.clientId !== clientId ||
      !date(s.date) ||
      !timestamp(s.createdAt) ||
      s.source !== 'professional_evaluation' ||
      !object(s.measurements)
    )
      return false;
    seen.add(s.id);
    if (s.dateBasis === 'legacy_evaluation_date') {
      if (s.method !== null || s.provenance !== null || s.protocol !== null)
        return false;
    } else if (
      s.dateBasis !== 'effective_date' ||
      typeof s.method !== 'string' ||
      !methods.includes(s.method) ||
      typeof s.provenance !== 'string' ||
      !['device_reported', 'manual_measurements'].includes(s.provenance) ||
      typeof s.protocol !== 'string'
    )
      return false;
    if (
      (typeof period.from === 'string' && s.date < period.from) ||
      (typeof period.to === 'string' && s.date > period.to) ||
      (value.method !== null &&
        (value.method === 'legacy'
          ? s.method !== null
          : s.method !== value.method))
    )
      return false;
    if (
      !Object.entries(s.measurements).every(
        ([key, n]) =>
          Object.hasOwn(measurementFields, key) &&
          typeof n === 'number' &&
          Number.isFinite(n) &&
          Number.isInteger(n * 10)
      )
    )
      return false;
    const [whole, fraction = ''] = s.createdAt.slice(0, -1).split('.');
    const order = [
      s.date,
      `${whole}.${fraction.padEnd(6, '0')}Z`,
      s.id.toLowerCase(),
    ];
    if (previous) {
      const p = previous;
      if (
        order[0] < p[0] ||
        (order[0] === p[0] &&
          (order[1] < p[1] || (order[1] === p[1] && order[2] <= p[2])))
      )
        return false;
    }
    previous = order;
    return true;
  });
}

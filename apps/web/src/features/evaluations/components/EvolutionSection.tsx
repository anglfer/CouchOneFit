import { useEffect, useRef, useState } from 'react';
import { Link } from '../../../components/Link';
import { evolutionMetrics, type EvolutionMetric } from '../types/evolution';
import {
  ALL_EVOLUTION,
  quickEvolutionPeriod,
  validateEvolutionFilters,
  evolutionDate,
  evolutionValue,
  readEvolutionValue,
  hasEvolutionMeasurement,
  type EvolutionFilters,
} from '../utils/evolution';
import { useEvolution } from '../hooks/useEvolution';
import EvolutionChart from './EvolutionChart';
import EvolutionTable from './EvolutionTable';

export default function EvolutionSection({
  clientId,
  accountId,
  initialStatus,
}: {
  clientId: string;
  accountId: string;
  initialStatus: 'available' | 'empty' | 'error' | 'not_integrated';
}) {
  const [selectedMetric, setSelectedMetric] = useState<EvolutionMetric | null>(
      null
    ),
    [draft, setDraft] = useState<EvolutionFilters>(ALL_EVOLUTION),
    [filters, setFilters] = useState<EvolutionFilters>(ALL_EVOLUTION),
    [filterError, setFilterError] = useState(''),
    [started, setStarted] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (window.location.hash === '#evolucion-antropometrica') {
      title.current?.focus({ preventScroll: true });
      title.current?.scrollIntoView?.({ block: 'start' });
    }
  }, []);
  const enabled = started || initialStatus !== 'not_integrated';
  const defaultMetric: EvolutionMetric = 'measuredBodyFatPercentage';
  const state = useEvolution(
    clientId,
    accountId,
    filters,
    selectedMetric ?? defaultMetric,
    enabled
  );
  const availableMetrics = (
    [
      'candidateBodyFat',
      ...(Object.keys(evolutionMetrics) as EvolutionMetric[]),
    ] as EvolutionMetric[]
  )
    .filter((key, index, self) => self.indexOf(key) === index)
    .filter((key) =>
      state.samples.some((sample) => hasEvolutionMeasurement(sample, key))
    );
  const fallbackWithData: EvolutionMetric =
    availableMetrics.find((m) =>
      ['weightKg', 'waistCm', 'hipCm', 'measuredBodyFatPercentage'].includes(m)
    ) ??
    availableMetrics[0] ??
    defaultMetric;
  const metric: EvolutionMetric =
    selectedMetric ??
    (state.samples.some((sample) =>
      hasEvolutionMeasurement(sample, 'candidateBodyFat')
    )
      ? 'candidateBodyFat'
      : state.samples.length === 0 ||
          state.samples.some((sample) =>
            hasEvolutionMeasurement(sample, defaultMetric)
          )
        ? defaultMetric
        : fallbackWithData);
  const [label, unit] = evolutionMetrics[metric];
  const points = state.samples.filter((s) =>
    hasEvolutionMeasurement(s, metric)
  );
  const firstPointVal =
    points.length >= 2 ? readEvolutionValue(points[0], metric) : undefined;
  const lastPointVal =
    points.length >= 2
      ? readEvolutionValue(points[points.length - 1], metric)
      : undefined;
  const totalDelta =
    typeof firstPointVal === 'number' && typeof lastPointVal === 'number'
      ? Number((lastPointVal - firstPointVal).toFixed(1))
      : null;
  function apply(next: EvolutionFilters) {
    const error = validateEvolutionFilters(next);
    setFilterError(error ?? '');
    if (error) return;
    setDraft(next);
    setFilters({ ...next });
    setStarted(true);
  }
  const change = (key: keyof EvolutionFilters, value: string) =>
    setDraft((s) => ({ ...s, [key]: value }));
  return (
    <section
      id="evolucion-antropometrica"
      className="ws-card min-w-0 scroll-mt-6 space-y-5"
      aria-labelledby="evolution-heading"
    >
      <header>
        <h2
          id="evolution-heading"
          ref={title}
          tabIndex={-1}
          className="text-lg font-semibold"
        >
          Evolución antropométrica
        </h2>
        <p className="mt-1 text-sm text-(--ws-muted)">
          Cómo cambia cada medición entre tus evaluaciones. El peso diario que
          registra el cliente está en{' '}
          <Link
            to={`/app/clientes/${encodeURIComponent(clientId)}/seguimiento`}
            className="font-semibold underline"
          >
            Seguimiento
          </Link>
          .
        </p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
        className="space-y-3"
        noValidate
        aria-label="Filtros de evolución"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block min-w-56 flex-1 text-sm font-medium sm:max-w-xs">
            Medición
            <select
              className="ws-input mt-1 w-full min-h-11"
              value={metric}
              onChange={(e) =>
                setSelectedMetric(e.target.value as EvolutionMetric)
              }
            >
              {Object.entries(evolutionMetrics).map(([key, meta]) => (
                <option key={key} value={key}>
                  {key === 'weightKg' ? 'Peso de evaluación' : meta[0]} (
                  {meta[1]})
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Periodos rápidos"
            >
              {[
                [30, '30 d'],
                [90, '90 d'],
                [365, '1 año'],
              ].map(([days, shortLabel]) => (
                <button
                  className="ws-btn min-h-11"
                  type="button"
                  key={days}
                  aria-label={`Últimos ${days} días`}
                  onClick={() =>
                    apply({
                      ...draft,
                      ...quickEvolutionPeriod(days as number),
                    })
                  }
                >
                  {shortLabel}
                </button>
              ))}
              <button
                type="button"
                className="ws-btn min-h-11"
                onClick={() => apply({ ...draft, from: '', to: '' })}
              >
                Todo
              </button>
            </span>
            {enabled && (
              <button
                type="button"
                className="ws-btn min-h-11"
                disabled={state.loading}
                onClick={state.reload}
              >
                Actualizar evolución
              </button>
            )}
          </div>
        </div>
        <details className="rounded-lg border border-(--ws-border-subtle) bg-(--ws-surface-2) p-3">
          <summary className="cursor-pointer text-sm font-medium text-(--ws-text-2)">
            Filtros avanzados (método y fechas)
            {(filters.method || filters.from || filters.to) && (
              <span className="ml-2 text-xs text-(--ws-primary-fg)">
                · activos
              </span>
            )}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Método
              <select
                className="ws-input mt-1 w-full min-h-11"
                value={draft.method}
                onChange={(e) => change('method', e.target.value)}
              >
                <option value="">Todos los métodos</option>
                <option value="perimetros">Perímetros corporales</option>
                <option value="pliegues">Pliegues cutáneos</option>
                <option value="bioimpedancia">Bioimpedancia</option>
                <option value="legacy">Heredadas · método desconocido</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Desde
              <input
                className="ws-input mt-1 w-full min-h-11"
                type="date"
                value={draft.from}
                onChange={(e) => change('from', e.target.value)}
                aria-invalid={!!filterError}
                aria-describedby={
                  filterError ? 'evolution-filter-error' : undefined
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Hasta
              <input
                className="ws-input mt-1 w-full min-h-11"
                type="date"
                value={draft.to}
                onChange={(e) => change('to', e.target.value)}
                aria-invalid={!!filterError}
                aria-describedby={
                  filterError ? 'evolution-filter-error' : undefined
                }
              />
            </label>
          </div>
          {filterError && (
            <p
              id="evolution-filter-error"
              role="alert"
              className="mt-2 text-sm"
            >
              {filterError}
            </p>
          )}
          <div className="mt-3">
            <button
              className="ws-btn min-h-11"
              data-variant="primary"
              type="submit"
            >
              Aplicar filtros
            </button>
          </div>
        </details>
      </form>
      {metric === 'candidateBodyFat' && (
        <p className="text-sm text-(--ws-muted)">
          Estimado con Jackson–Pollock 3 pliegues + Siri en cada evaluación de
          pliegues.
        </p>
      )}
      {!enabled && (
        <p role="status">
          La evolución aún no está integrada en el expediente guardado. Usa
          Aplicar filtros para intentar la consulta disponible.
        </p>
      )}
      {state.loading && <p role="status">Cargando evolución del cliente…</p>}
      {state.error && (
        <div role="alert" className="space-y-2">
          <p>{state.error}</p>
          {state.denied ? (
            <Link className="ws-btn" to="/app/clientes">
              Volver a Clientes
            </Link>
          ) : (
            <button
              type="button"
              className="ws-btn min-h-11"
              onClick={() => (state.page ? void state.more() : state.reload())}
            >
              Reintentar evolución
            </button>
          )}
        </div>
      )}
      {state.page && !state.denied && (
        <>
          {state.cachedAt !== null && (
            <p role="status" className="ws-alert" data-tone="warn">
              Datos recuperados de caché de esta cuenta (
              {new Date(state.cachedAt).toLocaleString('es-MX')}). Pueden faltar
              evaluaciones recientes; las páginas no guardadas necesitan
              conexión.
            </p>
          )}
          <p className="text-sm text-(--ws-muted)">
            {filters.from || filters.to
              ? `${filters.from ? evolutionDate(filters.from) : 'Inicio'} — ${filters.to ? evolutionDate(filters.to) : 'hoy'} · `
              : 'Todo el historial · '}
            {state.samples.length}{' '}
            {state.samples.length === 1 ? 'evaluación' : 'evaluaciones'} ·{' '}
            {points.length} con {label.toLowerCase()}
          </p>
          {points.length >= 2 &&
            typeof firstPointVal === 'number' &&
            typeof lastPointVal === 'number' &&
            totalDelta !== null && (
              <div
                aria-label="Resumen de tendencia seleccionada"
                className="ws-kpi-strip"
              >
                <div className="ws-kpi-mini">
                  <span className="ws-stat-label">Inicio</span>
                  <strong className="ws-kpi-mini-value tabular-nums">
                    {evolutionValue(firstPointVal)} {unit}
                  </strong>
                  <span className="text-xs text-(--ws-muted)">
                    {evolutionDate(points[0].date)}
                  </span>
                </div>
                <div className="ws-kpi-mini">
                  <span className="ws-stat-label">Más reciente</span>
                  <strong className="ws-kpi-mini-value tabular-nums">
                    {evolutionValue(lastPointVal)} {unit}
                  </strong>
                  <span className="text-xs text-(--ws-muted)">
                    {evolutionDate(points[points.length - 1].date)}
                  </span>
                </div>
                <div className="ws-kpi-mini">
                  <span className="ws-stat-label">Cambio en el periodo</span>
                  <strong className="ws-kpi-mini-value tabular-nums">
                    {Math.abs(totalDelta) < 0.05
                      ? `0.0 ${unit}`
                      : `${totalDelta > 0 ? '+' : '−'}${evolutionValue(Math.abs(totalDelta))} ${unit}`}
                  </strong>
                  <span
                    className="ws-delta w-fit"
                    data-sign={
                      Math.abs(totalDelta) < 0.05
                        ? 'flat'
                        : totalDelta > 0
                          ? 'up'
                          : 'down'
                    }
                  >
                    {points.length} registros con dato
                  </span>
                </div>
              </div>
            )}
          {state.page.pageInfo.hasMore && (
            <p role="status" className="ws-alert" data-tone="warn">
              Consulta incompleta: hay páginas pendientes. La tabla y la gráfica
              representan solo las evaluaciones cargadas.
            </p>
          )}
          {state.samples.length === 0 ? (
            <p role="status">Sin evaluaciones confirmadas en este periodo.</p>
          ) : (
            <>
              {points.length === 0 && (
                <p role="status">
                  No hay valores de esta medición en las evaluaciones cargadas.
                  Los datos ausentes no son cero.
                </p>
              )}
              {points.length === 1 && (
                <p
                  role="status"
                  className="rounded-xl border border-(--ws-border) p-4"
                >
                  Una sola medición:{' '}
                  <strong>
                    {evolutionValue(readEvolutionValue(points[0], metric)!)}{' '}
                    {unit}
                  </strong>{' '}
                  · {evolutionDate(points[0].date)}. Todavía no hay suficientes
                  registros cargados para comparar una evolución.
                </p>
              )}
              {metric === 'visceralFatIndex' && points.length > 0 && (
                <p>
                  El índice visceral se muestra como puntos y en la tabla, sin
                  segmentos: no se acredita comparabilidad entre equipos.
                </p>
              )}
              {points.length > 0 && (
                <EvolutionChart
                  key={metric}
                  samples={state.samples}
                  metric={metric}
                  hasMore={state.page.pageInfo.hasMore}
                />
              )}
              <EvolutionTable samples={state.samples} metric={metric} />
            </>
          )}
          {state.page.pageInfo.hasMore && (
            <button
              type="button"
              className="ws-btn min-h-11"
              disabled={state.loadingMore || state.loading}
              onClick={() => void state.more()}
            >
              {state.loadingMore
                ? 'Cargando más evolución…'
                : 'Cargar más evolución'}
            </button>
          )}
          <details className="text-xs text-(--ws-muted)">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
              Cómo leer estos datos
            </summary>
            <p className="mt-1">
              Procedencia declarada del registro, no garantía del origen de cada
              campo. Métodos o protocolos diferentes requieren contexto; no se
              emiten diagnósticos. Las operaciones locales pendientes no forman
              parte de esta serie. Los periodos se cuentan por día UTC e
              incluyen hoy.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

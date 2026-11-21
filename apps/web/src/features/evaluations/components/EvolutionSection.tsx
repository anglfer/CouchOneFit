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
  const defaultMetric = 'measuredBodyFatPercentage';
  const state = useEvolution(
    clientId,
    accountId,
    filters,
    selectedMetric ?? defaultMetric,
    enabled
  );
  const metric =
    selectedMetric ??
    (state.samples.some((sample) =>
      hasEvolutionMeasurement(sample, 'candidateBodyFat')
    )
      ? 'candidateBodyFat'
      : defaultMetric);
  const [label, unit] = evolutionMetrics[metric];
  const points = state.samples.filter((s) =>
    hasEvolutionMeasurement(s, metric)
  );
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
        className="space-y-4"
        noValidate
        aria-label="Filtros de evolución"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium">
            Medición
            <select
              className="ws-input mt-1 w-full min-h-11"
              value={metric}
              onChange={(e) =>
                setSelectedMetric(e.target.value as EvolutionMetric)
              }
            >
              {Object.entries(evolutionMetrics)

                .map(([key, meta]) => (
                  <option key={key} value={key}>
                    {key === 'weightKg' ? 'Peso de evaluación' : meta[0]} (
                    {meta[1]})
                  </option>
                ))}
            </select>
          </label>
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
          <p id="evolution-filter-error" role="alert" className="text-sm">
            {filterError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="ws-btn min-h-11"
            data-variant="primary"
            type="submit"
          >
            Aplicar filtros
          </button>
          <span
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Periodos rápidos"
          >
            {[30, 90, 365].map((days) => (
              <button
                className="ws-btn min-h-11"
                type="button"
                key={days}
                onClick={() =>
                  apply({ ...draft, ...quickEvolutionPeriod(days) })
                }
              >
                Últimos {days} días
              </button>
            ))}
            <button
              type="button"
              className="ws-btn min-h-11"
              onClick={() => apply({ ...draft, from: '', to: '' })}
            >
              Todo el historial
            </button>
          </span>
          {enabled && (
            <button
              type="button"
              className="ws-btn min-h-11 sm:ml-auto"
              disabled={state.loading}
              onClick={state.reload}
            >
              Actualizar evolución
            </button>
          )}
        </div>
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

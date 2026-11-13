import { useEffect, useRef, useState } from 'react';
import { Link } from '../../../components/Link';
import { measurementFields } from '../types/assessment';
import type { EvolutionMetric } from '../types/evolution';
import {
  ALL_EVOLUTION,
  quickEvolutionPeriod,
  validateEvolutionFilters,
  evolutionDate,
  evolutionValue,
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
  const [metric, setMetric] = useState<EvolutionMetric>('weightKg'),
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
  const state = useEvolution(clientId, accountId, filters, metric, enabled);
  const unit = measurementFields[metric][1],
    points = state.samples.filter((s) => s.measurements[metric] !== undefined);
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
          className="text-xl font-semibold"
        >
          Evolución antropométrica
        </h2>
        <p className="mt-1 text-sm text-(--ws-muted)">
          Compara mediciones confirmadas de este cliente. La fecha efectiva o
          heredada se conserva sin completar valores ausentes.
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
              onChange={(e) => setMetric(e.target.value as EvolutionMetric)}
            >
              {Object.entries(measurementFields).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta[0]} ({meta[1]})
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
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Periodos rápidos"
        >
          {[30, 90, 365].map((days) => (
            <button
              className="ws-btn min-h-11"
              type="button"
              key={days}
              onClick={() => apply({ ...draft, ...quickEvolutionPeriod(days) })}
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
        </div>
        <p className="text-xs text-(--ws-muted)">
          Periodos inclusivos por día UTC; los accesos rápidos incluyen hoy. La
          medición se cambia solo en esta vista, sin enviarla como filtro a la
          API.
        </p>
        {filterError && (
          <p id="evolution-filter-error" role="alert" className="text-sm">
            {filterError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="ws-btn min-h-11"
            data-variant="primary"
            type="submit"
          >
            Aplicar filtros
          </button>
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
      </form>
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
          <p className="text-sm">
            Periodo consultado:{' '}
            {filters.from ? evolutionDate(filters.from) : 'sin inicio'} —{' '}
            {filters.to ? evolutionDate(filters.to) : 'sin fin'}.{' '}
            {state.samples.length} evaluaciones cargadas · {points.length}{' '}
            valores de {measurementFields[metric][0].toLowerCase()}.
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
                    {evolutionValue(points[0].measurements[metric]!)} {unit}
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
          <p className="text-xs text-(--ws-muted)">
            Procedencia declarada del registro, no garantía del origen de cada
            campo. Métodos o protocolos diferentes requieren contexto; no se
            emiten diagnósticos. Las operaciones locales pendientes no forman
            parte de esta serie.
          </p>
          {state.page.pageInfo.hasMore ? (
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
          ) : (
            <p className="text-sm">
              Fin de las páginas consultadas
              {state.cachedAt !== null ? ' guardadas' : ''}. Actualiza con
              conexión para consultar cambios posteriores.
            </p>
          )}
        </>
      )}
    </section>
  );
}

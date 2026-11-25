import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import {
  exportLogsUrl,
  readLogDetail,
  readLogs,
} from '../services/observability';
import type {
  LogRecordItem,
  ObservabilityEnvironment,
} from '../types/observability';
import { formatDateTime } from '../utils/formatters';

const CATEGORY_LABELS: Record<LogRecordItem['category'], string> = {
  operational: 'Operativo',
  error: 'Error',
  audit: 'Auditoría',
  test_result: 'Prueba automatizada',
  client_telemetry: 'Telemetría cliente',
};

type LogSelection = { id: string; query: string };
type LogDetail = { item: LogRecordItem; related: LogRecordItem[] };

export function LogExplorer({
  environment,
}: {
  environment: ObservabilityEnvironment;
}): ReactElement {
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('');
  const [outcome, setOutcome] = useState('');
  const [service, setService] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [operation, setOperation] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<LogRecordItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<LogSelection | null>(null);
  const [detailResponse, setDetailResponse] = useState<{
    selection: LogSelection;
    detail?: LogDetail;
    error?: string;
  } | null>(null);
  const pageSize = 25;

  const requestKey = JSON.stringify([
    environment,
    category,
    severity,
    outcome,
    service,
    moduleFilter,
    operation,
    correlationId,
    search,
    from,
    to,
    page,
  ]);
  const loading = loadedKey !== requestKey;
  const currentSelection = selection?.query === requestKey ? selection : null;
  const currentDetail =
    detailResponse?.selection === currentSelection ? detailResponse : null;
  const detail = currentDetail?.detail;

  const queryParams = {
    environment,
    category,
    severity: severity || undefined,
    outcome: outcome || undefined,
    service: service || undefined,
    module: moduleFilter || undefined,
    operation: operation || undefined,
    correlationId: correlationId || undefined,
    search: search || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
    page,
    pageSize,
  };

  useEffect(() => {
    let active = true;
    void readLogs({
      environment,
      category,
      severity: severity || undefined,
      outcome: outcome || undefined,
      service: service || undefined,
      module: moduleFilter || undefined,
      operation: operation || undefined,
      correlationId: correlationId || undefined,
      search: search || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      page,
      pageSize,
    })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setItems(null);
        setTotal(0);
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos consultar los registros.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [
    environment,
    category,
    severity,
    outcome,
    service,
    moduleFilter,
    operation,
    correlationId,
    search,
    from,
    to,
    page,
    requestKey,
  ]);

  useEffect(() => {
    if (!currentSelection) return;
    let active = true;
    void readLogDetail(currentSelection.id)
      .then((res) => {
        if (active)
          setDetailResponse({ selection: currentSelection, detail: res });
      })
      .catch((err) => {
        if (!active) return;
        setDetailResponse({
          selection: currentSelection,
          error:
            err instanceof ApiError
              ? err.message
              : 'No pudimos cargar el detalle del registro.',
        });
      });
    return () => {
      active = false;
    };
  }, [currentSelection]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <Card
        title="Explorador de logs y eventos"
        subtitle="Consulta registros operativos, errores, auditoría y resultados de pruebas sin exponer datos sensibles."
        icon="terminal"
        labelId="obs-logs-title"
        action={
          <div className="flex flex-wrap gap-2">
            <a
              className="ws-btn"
              href={exportLogsUrl(queryParams, 'csv')}
              download
            >
              <Icon name="download" size={16} />
              Exportar CSV
            </a>
            <a
              className="ws-btn"
              href={exportLogsUrl(queryParams, 'json')}
              download
            >
              <Icon name="download" size={16} />
              Exportar JSON
            </a>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            Tipo de registro
            <select
              className="ws-input mt-1 w-full min-h-10"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todos</option>
              <option value="operational">Logs operativos</option>
              <option value="error">Errores</option>
              <option value="audit">Eventos de auditoría</option>
              <option value="test_result">Pruebas automatizadas</option>
              <option value="client_telemetry">Telemetría cliente</option>
            </select>
          </label>
          <label className="block text-sm">
            Severidad
            <select
              className="ws-input mt-1 w-full min-h-10"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
              <option value="debug">Debug</option>
            </select>
          </label>
          <label className="block text-sm">
            Resultado / estado
            <select
              className="ws-input mt-1 w-full min-h-10"
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="success">Exitoso</option>
              <option value="client_error">Rechazo cliente (4xx)</option>
              <option value="server_error">Fallo servidor / prueba</option>
              <option value="aborted">Abortada</option>
              <option value="recovered">Recuperación</option>
              <option value="info">Informativo</option>
            </select>
          </label>
          <label className="block text-sm">
            Servicio
            <input
              className="ws-input mt-1 w-full min-h-10"
              value={service}
              placeholder="api, web, database"
              onChange={(e) => {
                setService(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            Módulo
            <input
              className="ws-input mt-1 w-full min-h-10"
              value={moduleFilter}
              placeholder="auth, clients, training..."
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            Operación / ruta
            <input
              className="ws-input mt-1 w-full min-h-10"
              value={operation}
              placeholder="GET /api/plans"
              onChange={(e) => {
                setOperation(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            ID de correlación
            <input
              className="ws-input mt-1 w-full min-h-10"
              value={correlationId}
              placeholder="requestId o runId"
              onChange={(e) => {
                setCorrelationId(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            Búsqueda libre
            <input
              className="ws-input mt-1 w-full min-h-10"
              value={search}
              placeholder="Error, ruta, evento..."
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            Desde
            <input
              type="datetime-local"
              className="ws-input mt-1 w-full min-h-10"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            Hasta
            <input
              type="datetime-local"
              className="ws-input mt-1 w-full min-h-10"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </Card>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {currentDetail?.error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {currentDetail.error}
        </p>
      )}
      {currentSelection && !currentDetail && (
        <p className="ws-empty" role="status">
          Cargando detalle…
        </p>
      )}
      {detail && (
        <section
          className="ws-card space-y-3 border-(--ws-primary)"
          aria-label="Detalle del registro seleccionado"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="ws-card-title">
                Detalle del evento · {detail.item.eventType}
              </h3>
              <p className="ws-card-sub">
                Correlación: <code>{detail.item.correlationId}</code>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="ws-btn"
                onClick={() => {
                  setCorrelationId(detail.item.correlationId);
                  setPage(1);
                }}
              >
                Filtrar por correlación
              </button>
              <button
                type="button"
                className="ws-btn"
                onClick={() => setSelection(null)}
              >
                Cerrar
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-(--ws-muted)">Fecha y hora</dt>
              <dd className="font-medium">
                {formatDateTime(detail.item.occurredAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-(--ws-muted)">Servicio / módulo</dt>
              <dd className="font-medium">
                {detail.item.service} / {detail.item.module}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-(--ws-muted)">HTTP / duración</dt>
              <dd className="font-medium tabular-nums">
                {detail.item.statusCode ?? '—'} ·{' '}
                {detail.item.durationMs !== null
                  ? `${detail.item.durationMs} ms`
                  : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs text-(--ws-muted)">Operación y ruta</dt>
              <dd className="font-medium break-all">
                {detail.item.operation}{' '}
                {detail.item.normalizedPath
                  ? `(${detail.item.normalizedPath})`
                  : ''}
              </dd>
            </div>
            {detail.item.errorMessage && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-(--ws-muted)">Error registrado</dt>
                <dd className="font-medium text-(--ws-bad-fg)">
                  {detail.item.errorCode ? `[${detail.item.errorCode}] ` : ''}
                  {detail.item.errorMessage}
                </dd>
              </div>
            )}
          </dl>

          {Object.keys(detail.item.metadata).length > 0 && (
            <pre className="overflow-x-auto rounded-lg bg-(--ws-surface-2) p-3 text-xs">
              {JSON.stringify(detail.item.metadata, null, 2)}
            </pre>
          )}

          <div>
            <h4 className="mb-1 text-xs font-semibold text-(--ws-muted)">
              Eventos correlacionados ({detail.related.length})
            </h4>
            <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-xs">
              {detail.related.map((rel) => (
                <li
                  key={rel.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                >
                  <span>
                    {formatDateTime(rel.occurredAt)} ·{' '}
                    <strong>{rel.eventType}</strong> · {rel.operation}
                  </span>
                  <span>
                    {rel.statusCode ?? rel.severity} ·{' '}
                    {rel.durationMs !== null ? `${rel.durationMs} ms` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="ws-card overflow-x-auto p-0!">
        {loading ? (
          <div className="space-y-2 p-5" role="status" aria-busy="true">
            <div className="ws-skeleton h-10" />
            <div className="ws-skeleton h-10" />
          </div>
        ) : !items ? null : items.length === 0 ? (
          <p className="ws-empty">
            No se encontraron registros para los filtros seleccionados.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Severidad</th>
                <th className="p-3">Servicio / Módulo</th>
                <th className="p-3">Operación</th>
                <th className="p-3">HTTP</th>
                <th className="p-3">Duración</th>
                <th className="p-3">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-(--ws-border-subtle)"
                >
                  <td className="p-3 whitespace-nowrap">
                    {formatDateTime(item.occurredAt)}
                  </td>
                  <td className="p-3">
                    <Badge tone="info">{CATEGORY_LABELS[item.category]}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={
                        item.severity === 'error' ||
                        item.severity === 'critical'
                          ? 'bad'
                          : item.severity === 'warn'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {item.severity}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {item.service} / {item.module}
                  </td>
                  <td className="max-w-xs truncate p-3 font-medium">
                    {item.operation}
                  </td>
                  <td className="p-3 tabular-nums">{item.statusCode ?? '—'}</td>
                  <td className="p-3 tabular-nums">
                    {item.durationMs !== null ? `${item.durationMs} ms` : '—'}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="ws-btn min-h-8 px-3 py-1 text-xs"
                      onClick={() =>
                        setSelection({ id: item.id, query: requestKey })
                      }
                    >
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(loading || items) && (
        <nav
          aria-label="Páginas de los registros"
          className="flex flex-wrap items-center justify-between gap-2 text-sm text-(--ws-muted)"
        >
          <span aria-live="polite">
            {loading
              ? 'Cargando página…'
              : `${total} registros · Página ${page} de ${totalPages}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="ws-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="ws-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

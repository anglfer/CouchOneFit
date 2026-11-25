import { useEffect, useState, type ReactElement } from 'react';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { readIncidents, updateIncident } from '../services/observability';
import type {
  IncidentRecord,
  ObservabilityEnvironment,
} from '../types/observability';
import { formatDateTime } from '../utils/formatters';

export function IncidentsPanel({
  environment,
}: {
  environment: ObservabilityEnvironment;
}): ReactElement {
  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState<IncidentRecord[] | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${statusFilter}:${reloadTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    void readIncidents(environment, statusFilter || undefined)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setItems(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos cargar los incidentes.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, statusFilter, requestKey]);

  async function handleAction(
    id: string,
    status: 'acknowledged' | 'resolved'
  ): Promise<void> {
    try {
      await updateIncident(id, status, notesById[id]?.trim() || undefined);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al actualizar el incidente.'
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="ws-card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-(--ws-muted)">
          Los fallos repetidos de una misma interrupción se agrupan sin
          duplicarse hasta observar recuperación.
        </p>
        <select
          aria-label="Filtrar incidentes por estado"
          className="ws-input min-h-10"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="open">Abiertos</option>
          <option value="acknowledged">En atención</option>
          <option value="resolved">Resueltos</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {loading ? (
        <div className="ws-skeleton h-28" />
      ) : !items ? null : items.length === 0 ? (
        <section className="ws-card ws-empty">
          <h3 className="ws-card-title">Sin incidentes registrados</h3>
          <p>No hay incidentes que coincidan con el filtro en este ambiente.</p>
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((inc) => (
            <Card
              key={inc.id}
              title={inc.title}
              subtitle={`${inc.service} · ${inc.incidentType} · ${inc.occurrenceCount} ocurrencia(s)`}
              icon="alert"
              action={
                <div className="flex gap-1.5">
                  <Badge
                    tone={
                      inc.severity === 'critical' || inc.severity === 'high'
                        ? 'bad'
                        : inc.severity === 'medium'
                          ? 'warn'
                          : 'neutral'
                    }
                  >
                    {inc.severity}
                  </Badge>
                  <Badge
                    tone={
                      inc.status === 'resolved'
                        ? 'ok'
                        : inc.status === 'acknowledged'
                          ? 'info'
                          : 'bad'
                    }
                  >
                    {inc.status === 'open'
                      ? 'Abierto'
                      : inc.status === 'acknowledged'
                        ? 'En atención'
                        : 'Resuelto'}
                  </Badge>
                </div>
              }
            >
              <p className="text-sm">{inc.summary}</p>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-(--ws-muted) sm:grid-cols-3">
                <div>
                  <dt>Inicio</dt>
                  <dd className="font-medium text-(--ws-text)">
                    {formatDateTime(inc.startedAt)}
                  </dd>
                </div>
                <div>
                  <dt>Última actualización</dt>
                  <dd className="font-medium text-(--ws-text)">
                    {formatDateTime(inc.lastSeenAt)}
                  </dd>
                </div>
                <div>
                  <dt>Recuperación observada</dt>
                  <dd className="font-medium text-(--ws-text)">
                    {inc.resolvedAt
                      ? `${formatDateTime(inc.resolvedAt)} (${inc.recoveryDurationS ?? 0} s)`
                      : 'En curso'}
                  </dd>
                </div>
              </dl>

              {inc.resolutionNotes && (
                <p className="mt-2 text-xs text-(--ws-text-2)">
                  Notas: {inc.resolutionNotes}
                </p>
              )}

              {inc.status !== 'resolved' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="ws-input min-h-9 flex-1 text-xs"
                    placeholder="Nota de diagnóstico o resolución (opcional)"
                    value={notesById[inc.id] ?? ''}
                    onChange={(e) =>
                      setNotesById((prev) => ({
                        ...prev,
                        [inc.id]: e.target.value,
                      }))
                    }
                  />
                  {inc.status === 'open' && (
                    <button
                      type="button"
                      className="ws-btn min-h-9 px-3 py-1 text-xs"
                      onClick={() => void handleAction(inc.id, 'acknowledged')}
                    >
                      Reconocer
                    </button>
                  )}
                  <button
                    type="button"
                    className="ws-btn min-h-9 px-3 py-1 text-xs"
                    data-variant="primary"
                    onClick={() => void handleAction(inc.id, 'resolved')}
                  >
                    Marcar resuelto
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

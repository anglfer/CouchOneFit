import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { evaluateSlosNow, readDashboard } from '../services/observability';
import type {
  DashboardSummary,
  ObservabilityEnvironment,
  ObservabilityPeriod,
} from '../types/observability';
import {
  complianceMeta,
  formatDateTime,
  formatMetric,
  healthStateMeta,
} from '../utils/formatters';
import { ObservabilityCharts } from './ObservabilityCharts';

export function ObservabilityDashboard({
  environment,
  period,
  onOpenIncidents,
}: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
  onOpenIncidents: () => void;
}): ReactElement {
  const [serviceFilter, setServiceFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [moduleOptions, setModuleOptions] = useState<string[]>([]);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${period}:${serviceFilter}:${moduleFilter}:${reloadTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    void readDashboard({
      environment,
      period,
      service: serviceFilter || undefined,
      module: moduleFilter || undefined,
    })
      .then((res) => {
        if (!active) return;
        setData(res);
        if (!moduleFilter)
          setModuleOptions(res.modules.map(({ module }) => module));
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos cargar el resumen de observabilidad.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, period, serviceFilter, moduleFilter, requestKey]);

  async function handleEvaluate(): Promise<void> {
    setEvaluating(true);
    setError('');
    try {
      await evaluateSlosNow(environment, period);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos recalcular los objetivos SLO.'
      );
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="ws-card flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="block text-sm">
            <span className="font-medium text-(--ws-text-2)">Servicio</span>
            <select
              aria-label="Filtrar dashboard por servicio"
              className="ws-input mt-1 min-h-10"
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setModuleFilter('');
                setModuleOptions([]);
              }}
            >
              <option value="">Todos los servicios</option>
              <option value="web">Aplicación Web</option>
              <option value="api">Backend API</option>
              <option value="database">Base de datos</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-(--ws-text-2)">Módulo</span>
            <select
              aria-label="Filtrar dashboard por módulo"
              className="ws-input mt-1 min-h-10"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="">Todos los módulos</option>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ws-btn"
            disabled={loading}
            onClick={() => setReloadTick((n) => n + 1)}
          >
            <Icon name="refresh" size={16} />
            Actualizar
          </button>
          <button
            type="button"
            className="ws-btn"
            data-variant="primary"
            disabled={evaluating || loading}
            onClick={() => void handleEvaluate()}
          >
            <Icon name="check-circle" size={16} />
            {evaluating ? 'Evaluando SLO…' : 'Evaluar SLO ahora'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <div className="ws-skeleton h-28" />
          <div className="ws-skeleton h-48" />
        </div>
      ) : data ? (
        <>
          <div className="ws-stats-home" aria-label="Estado de servicios">
            {data.services.map((svc) => {
              const meta = healthStateMeta(svc.state);
              return (
                <section
                  key={svc.id}
                  className="ws-card space-y-2"
                  aria-label={`Estado de ${svc.name}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="ws-card-title">{svc.name}</h2>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="text-sm text-(--ws-text-2)">{svc.detail}</p>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-(--ws-muted)">
                    <div>
                      <dt>Disponibilidad</dt>
                      <dd className="font-semibold text-(--ws-text) tabular-nums">
                        {formatMetric(svc.availabilityPct, '%')}
                      </dd>
                    </div>
                    <div>
                      <dt>Latencia P95</dt>
                      <dd className="font-semibold text-(--ws-text) tabular-nums">
                        {formatMetric(svc.latencyP95Ms, 'ms')}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt>Última comprobación</dt>
                      <dd className="font-medium text-(--ws-text)">
                        {formatDateTime(svc.lastCheckedAt)}
                      </dd>
                    </div>
                  </dl>
                </section>
              );
            })}
          </div>

          <div className="ws-kpi-strip" aria-label="Indicadores reales">
            <div className="ws-kpi-mini">
              <span className="ws-stat-label">Disponibilidad observada</span>
              <span className="ws-kpi-mini-value tabular-nums">
                {formatMetric(data.kpis.availabilityPct, '%')}
              </span>
              <span className="text-xs text-(--ws-muted)">
                Solo sondas ejecutadas
              </span>
            </div>
            <div className="ws-kpi-mini">
              <span className="ws-stat-label">Latencia promedio / P50</span>
              <span className="ws-kpi-mini-value tabular-nums">
                {formatMetric(data.kpis.avgLatencyMs, 'ms')} /{' '}
                {formatMetric(data.kpis.p50LatencyMs, 'ms')}
              </span>
              <span className="text-xs text-(--ws-muted)">
                P95 {formatMetric(data.kpis.p95LatencyMs, 'ms')} · P99{' '}
                {formatMetric(data.kpis.p99LatencyMs, 'ms')}
              </span>
            </div>
            <div className="ws-kpi-mini">
              <span className="ws-stat-label">Solicitudes HTTP</span>
              <span className="ws-kpi-mini-value tabular-nums">
                {data.kpis.requestsTotal}
              </span>
              <span className="text-xs text-(--ws-muted)">
                {data.kpis.requestsSucceeded} ok · {data.kpis.requestsFailed}{' '}
                fallidas ({formatMetric(data.kpis.errorRatePct, '%')})
              </span>
            </div>
            <div className="ws-kpi-mini">
              <span className="ws-stat-label">Pruebas automatizadas</span>
              <span className="ws-kpi-mini-value tabular-nums">
                {data.kpis.checksPassed} ok / {data.kpis.checksFailed} fallo
              </span>
              <span className="text-xs text-(--ws-muted)">
                {data.kpis.checksNotExecuted} no ejecutada(s)
              </span>
            </div>
            <div className="ws-kpi-mini">
              <span className="ws-stat-label">SLO internos</span>
              <span className="ws-kpi-mini-value tabular-nums">
                {data.kpis.slosMet} / {data.slos.length}
              </span>
              <span className="text-xs text-(--ws-muted)">
                {data.kpis.slosUnmet} incumplidos · {data.kpis.slosInsufficient}{' '}
                sin datos
              </span>
            </div>
            <div className="ws-kpi-mini">
              <span className="ws-stat-label">Incidentes abiertos</span>
              <span className="ws-kpi-mini-value tabular-nums">
                {data.kpis.openIncidents}
              </span>
              <button
                type="button"
                className="ws-plain justify-self-start text-xs font-semibold text-(--ws-primary-fg) underline"
                onClick={onOpenIncidents}
              >
                Ver incidentes
              </button>
            </div>
          </div>

          <ObservabilityCharts history={data.history} />

          <div className="ws-grid-2">
            <Card
              title="Cumplimiento actual de SLO internos"
              subtitle="Evaluación dinámica con los datos reales del ambiente."
              icon="target"
              labelId="obs-slo-summary"
            >
              {data.slos.length === 0 ? (
                <p className="ws-empty">No hay SLO configurados.</p>
              ) : (
                <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-sm">
                  {data.slos.map((slo) => {
                    const meta = complianceMeta(slo.complianceStatus);
                    return (
                      <li
                        key={slo.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{slo.name}</p>
                          <p className="text-xs text-(--ws-muted) tabular-nums">
                            Objetivo {slo.comparisonOperator} {slo.targetValue}{' '}
                            {slo.unit} · Observado:{' '}
                            {formatMetric(slo.observedValue, slo.unit)} (
                            {slo.samples} muestras)
                          </p>
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card
              title="Salud por módulo"
              subtitle="Métricas reales segregadas por módulo del backend."
              icon="layers"
              labelId="obs-modules-summary"
            >
              {data.modules.length === 0 ? (
                <p className="ws-empty">
                  Sin actividad de módulos registrada en esta ventana.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th className="p-2">Módulo</th>
                        <th className="p-2">Estado</th>
                        <th className="p-2">Solicitudes</th>
                        <th className="p-2">P95</th>
                        <th className="p-2">Pruebas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.modules.map((mod) => {
                        const meta = healthStateMeta(mod.state);
                        return (
                          <tr key={mod.module}>
                            <td className="p-2 font-semibold">{mod.module}</td>
                            <td className="p-2">
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </td>
                            <td className="p-2 tabular-nums">
                              {mod.requestsTotal}
                            </td>
                            <td className="p-2 tabular-nums">
                              {formatMetric(mod.p95LatencyMs, 'ms')}
                            </td>
                            <td className="p-2 tabular-nums">
                              {mod.checksPassed} / {mod.checksFailed}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {data.activeIncidents.length > 0 && (
            <Card
              title="Incidentes activos detectados"
              subtitle="Eventos relevantes abiertos o en atención."
              icon="alert"
              labelId="obs-active-incidents"
            >
              <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-sm">
                {data.activeIncidents.map((inc) => (
                  <li key={inc.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{inc.title}</strong>
                      <Badge
                        tone={
                          inc.severity === 'critical' || inc.severity === 'high'
                            ? 'bad'
                            : 'warn'
                        }
                      >
                        {inc.severity} · {inc.occurrenceCount} ocurrencia(s)
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-(--ws-muted)">
                      {inc.summary} · Inicio: {formatDateTime(inc.startedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <details className="ws-card text-sm text-(--ws-muted)">
            <summary className="min-h-10 cursor-pointer font-medium text-(--ws-text)">
              Cómo leer estas métricas y limitaciones ({data.limitations.length}
              )
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}

import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { readPeriodReport } from '../services/observability';
import type {
  ObservabilityEnvironment,
  ObservabilityPeriod,
  PeriodReportPayload,
} from '../types/observability';
import {
  checkStatusMeta,
  complianceMeta,
  formatDateTime,
  formatMetric,
  healthStateMeta,
  slaApprovalLabel,
} from '../utils/formatters';

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPanel({
  environment,
  period,
}: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
}): ReactElement {
  const [report, setReport] = useState<PeriodReportPayload | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${period}:${reloadTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    void readPeriodReport(environment, period)
      .then((res) => {
        if (!active) return;
        setReport(res);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setReport(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos generar el reporte del periodo.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, period, requestKey]);

  return (
    <div className="space-y-4">
      <div className="ws-card flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-(--ws-muted)">
          Reporte consolidado del periodo seleccionado con mediciones reales,
          SLI, SLO, SLA, errores, incidentes y limitaciones.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ws-btn"
            onClick={() => setReloadTick((n) => n + 1)}
          >
            <Icon name="refresh" size={16} />
            Regenerar
          </button>
          {!loading && report && (
            <>
              <button
                type="button"
                className="ws-btn"
                onClick={() =>
                  downloadTextFile(
                    `reporte-observabilidad-${report.environment}-${report.period}.md`,
                    report.markdown,
                    'text/markdown;charset=utf-8'
                  )
                }
              >
                <Icon name="download" size={16} />
                Descargar Markdown
              </button>
              <button
                type="button"
                className="ws-btn"
                onClick={() =>
                  downloadTextFile(
                    `reporte-observabilidad-${report.environment}-${report.period}.json`,
                    JSON.stringify(report, null, 2),
                    'application/json;charset=utf-8'
                  )
                }
              >
                <Icon name="download" size={16} />
                Descargar JSON
              </button>
              <button
                type="button"
                className="ws-btn"
                data-variant="primary"
                onClick={() => window.print()}
              >
                Imprimir / PDF
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {loading ? (
        <p className="ws-empty" role="status">
          Generando reporte…
        </p>
      ) : report ? (
        <div className="space-y-4">
          <Card
            title="Resumen ejecutivo del periodo"
            subtitle={`Ambiente: ${report.environment} · Ventana: ${formatDateTime(report.periodStart)} — ${formatDateTime(report.periodEnd)}`}
            icon="file-text"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {report.dashboard.services.map((svc) => {
                const meta = healthStateMeta(svc.state);
                return (
                  <div
                    key={svc.id}
                    className="rounded-lg border border-(--ws-border-subtle) p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{svc.name}</strong>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-(--ws-muted)">
                      Disp: {formatMetric(svc.availabilityPct, '%')} · P95:{' '}
                      {formatMetric(svc.latencyP95Ms, 'ms')}
                    </p>
                  </div>
                );
              })}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {[
                [
                  'Disponibilidad observada',
                  formatMetric(report.dashboard.kpis.availabilityPct, '%'),
                ],
                [
                  'Latencia promedio',
                  formatMetric(report.dashboard.kpis.avgLatencyMs, 'ms'),
                ],
                [
                  'P50 / P95 / P99',
                  [
                    report.dashboard.kpis.p50LatencyMs,
                    report.dashboard.kpis.p95LatencyMs,
                    report.dashboard.kpis.p99LatencyMs,
                  ]
                    .map((value) => formatMetric(value, 'ms'))
                    .join(' / '),
                ],
                [
                  'Solicitudes (exitosas / fallidas)',
                  `${report.dashboard.kpis.requestsTotal} (${report.dashboard.kpis.requestsSucceeded} / ${report.dashboard.kpis.requestsFailed})`,
                ],
                [
                  'Tasa de errores',
                  formatMetric(report.dashboard.kpis.errorRatePct, '%'),
                ],
                [
                  'Pruebas exitosas / fallidas / no ejecutadas',
                  `${report.dashboard.kpis.checksPassed} / ${report.dashboard.kpis.checksFailed} / ${report.dashboard.kpis.checksNotExecuted}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-(--ws-muted)">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="SLI calculados" icon="target">
            {report.slis.length === 0 ? (
              <p className="ws-empty">Sin indicadores para el periodo.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-sm">
                {report.slis.map((sli) => (
                  <li key={sli.id} className="py-2">
                    <strong>{sli.name}</strong> ·{' '}
                    {formatMetric(sli.observedValue, sli.unit)} · {sli.samples}{' '}
                    muestras
                    {sli.note && (
                      <p className="text-xs text-(--ws-muted)">{sli.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Cumplimiento de SLO" icon="target">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="p-2">SLO</th>
                    <th className="p-2">Objetivo</th>
                    <th className="p-2">Observado</th>
                    <th className="p-2">Muestras</th>
                    <th className="p-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dashboard.slos.map((slo) => {
                    const meta = complianceMeta(slo.complianceStatus);
                    return (
                      <tr
                        key={slo.id}
                        className="border-t border-(--ws-border-subtle)"
                      >
                        <td className="p-2 font-semibold">{slo.name}</td>
                        <td className="p-2 tabular-nums">
                          {slo.comparisonOperator} {slo.targetValue} {slo.unit}
                        </td>
                        <td className="p-2 tabular-nums">
                          {formatMetric(slo.observedValue, slo.unit)}
                        </td>
                        <td className="p-2 tabular-nums">{slo.samples}</td>
                        <td className="p-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Acuerdos SLA" icon="shield">
            {report.slas.length === 0 ? (
              <p className="ws-empty">
                Sin acuerdos registrados para el periodo.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-sm">
                {report.slas.map((sla) => {
                  const meta = complianceMeta(sla.observedCompliance);
                  return (
                    <li
                      key={sla.id}
                      className="flex flex-wrap justify-between gap-2 py-2"
                    >
                      <span>
                        <strong>{sla.name}</strong> ·{' '}
                        {slaApprovalLabel(sla.approvalStatus)}
                      </span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Pruebas, errores e incidentes" icon="clipboard">
            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <h3 className="font-semibold">
                  Ejecuciones ({report.totalRuns})
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {report.runs.map((run) => (
                    <li key={run.id}>
                      {formatDateTime(run.startedAt)} ·{' '}
                      {checkStatusMeta(run.status).label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">
                  Errores ({report.totalErrors})
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {report.recentErrors.map((event) => (
                    <li key={event.id}>
                      {formatDateTime(event.occurredAt)} · {event.operation}{' '}
                      {event.errorCode}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Incidentes</h3>
                {report.incidents.length === 0 ? (
                  <p className="text-sm text-(--ws-muted)">
                    Sin incidentes registrados.
                  </p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {report.incidents.map((incident) => (
                      <li key={incident.id}>
                        {formatDateTime(incident.startedAt)} · {incident.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <Card title="Limitaciones de la medición" icon="shield">
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-(--ws-text-2)">
              {report.dashboard.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

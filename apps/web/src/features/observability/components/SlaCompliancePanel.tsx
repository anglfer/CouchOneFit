import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { readSlaV3Report, slaV3ExportUrl } from '../services/observability';
import type {
  ObservabilityEnvironment,
  SlaSli,
  SlaSliGroup,
  SlaV3Report,
} from '../types/observability';
import {
  currentMexicoMonth,
  formatMexicoDateTime,
  formatSlaValue,
  isSlaMonth,
  slaStatusMeta,
} from '../utils/formatters';
import { SlaRecordsPanel } from './SlaRecordsPanel';

const EXPORTS = [
  { kind: 'requests', label: 'requests.csv' },
  { kind: 'probes', label: 'probes.csv' },
  { kind: 'incidents', label: 'incidents.csv' },
  { kind: 'operations', label: 'operations.csv' },
] as const;

const SECTIONS: Array<{ group: SlaSliGroup; title: string }> = [
  { group: 'function', title: 'Funciones de negocio' },
  { group: 'platform', title: 'Plataforma' },
  { group: 'capacity', title: 'Capacidad' },
  { group: 'continuity', title: 'Continuidad' },
  { group: 'operation', title: 'Operación y soporte' },
];

const yesNo = (value: boolean | null): string =>
  value === null ? '—' : value ? 'Sí' : 'No';

function SliTable({
  caption,
  rows,
}: {
  caption: string;
  rows: SlaSli[];
}): ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="p-2">
              ID
            </th>
            <th scope="col" className="p-2">
              Indicador
            </th>
            <th scope="col" className="p-2">
              SLO
            </th>
            <th scope="col" className="p-2">
              Observado
            </th>
            <th scope="col" className="p-2">
              Atribuible
            </th>
            <th scope="col" className="p-2">
              Muestras
            </th>
            <th scope="col" className="p-2">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sli) => {
            const meta = slaStatusMeta(sli.status);
            return (
              <tr key={sli.id} className="border-t border-(--ws-border-subtle)">
                <th scope="row" className="p-2 font-mono whitespace-nowrap">
                  {sli.id}
                </th>
                <td className="p-2">
                  <span className="font-semibold">{sli.name}</span>
                  {sli.details && (
                    <p className="mt-0.5 text-(--ws-muted)">{sli.details}</p>
                  )}
                </td>
                <td className="p-2 whitespace-nowrap">{sli.slo}</td>
                <td className="p-2 tabular-nums">
                  {formatSlaValue(sli.observed, sli.unit)}
                </td>
                <td className="p-2 tabular-nums">
                  {formatSlaValue(sli.attributable, sli.unit)}
                </td>
                <td className="p-2 tabular-nums">
                  {sli.samples.toLocaleString('es-MX')}
                </td>
                <td className="p-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComplianceSections({ report }: { report: SlaV3Report }): ReactElement {
  return (
    <>
      {SECTIONS.map(({ group, title }) => {
        const rows = report.slis.filter((sli) => sli.group === group);
        if (rows.length === 0) return null;
        if (group !== 'function') {
          return (
            <Card key={group} title={title} icon="target">
              <SliTable caption={title} rows={rows} />
            </Card>
          );
        }
        const categories = Array.from(new Set(rows.map((sli) => sli.category)));
        return (
          <Card key={group} title={title} icon="target">
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category}>
                  <h3 className="mb-1 text-sm font-semibold">{category}</h3>
                  <SliTable
                    caption={`${title}: ${category}`}
                    rows={rows.filter((sli) => sli.category === category)}
                  />
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
}

function IncidentsAndWindows({
  report,
}: {
  report: SlaV3Report;
}): ReactElement {
  return (
    <>
      {report.incidents.length > 0 && (
        <Card title="Incidentes del mes" icon="alert">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Incidentes de soporte del mes, caso por caso
              </caption>
              <thead>
                <tr>
                  {[
                    'Severidad',
                    'Recibido',
                    'Límite de acuse',
                    'Acuse',
                    'Acuse a tiempo',
                    'Límite de resolución',
                    'Resuelto',
                    'Resolución a tiempo',
                    'Atribuible al proveedor',
                    'Causa',
                  ].map((heading) => (
                    <th key={heading} scope="col" className="p-2">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="border-t border-(--ws-border-subtle)"
                  >
                    <th scope="row" className="p-2 capitalize">
                      {incident.severity}
                    </th>
                    <td className="p-2">
                      {formatMexicoDateTime(incident.receivedAt)}
                    </td>
                    <td className="p-2">
                      {formatMexicoDateTime(incident.ackDeadline)}
                    </td>
                    <td className="p-2">
                      {formatMexicoDateTime(incident.acknowledgedAt)}
                    </td>
                    <td className="p-2">{yesNo(incident.ackOnTime)}</td>
                    <td className="p-2">
                      {formatMexicoDateTime(incident.resolveDeadline)}
                    </td>
                    <td className="p-2">
                      {formatMexicoDateTime(incident.resolvedAt)}
                    </td>
                    <td className="p-2">{yesNo(incident.resolvedOnTime)}</td>
                    <td className="p-2">{yesNo(incident.attributable)}</td>
                    <td className="p-2">{incident.cause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {report.maintenanceWindows.length > 0 && (
        <Card title="Ventanas de mantenimiento" icon="clipboard">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Ventanas de mantenimiento del mes
              </caption>
              <thead>
                <tr>
                  {['Inicio', 'Fin', 'Aviso', 'Se descuenta', 'Motivo'].map(
                    (heading) => (
                      <th key={heading} scope="col" className="p-2">
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {report.maintenanceWindows.map((window) => (
                  <tr
                    key={window.id}
                    className="border-t border-(--ws-border-subtle)"
                  >
                    <th scope="row" className="p-2 font-normal">
                      {formatMexicoDateTime(window.start)}
                    </th>
                    <td className="p-2">{formatMexicoDateTime(window.end)}</td>
                    <td className="p-2">
                      {formatMexicoDateTime(window.notifiedAt)}
                    </td>
                    <td className="p-2">
                      <Badge tone={window.counted ? 'ok' : 'warn'}>
                        Se descuenta: {window.counted ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                    <td className="p-2">{window.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export function SlaCompliancePanel({
  environment,
}: {
  environment: ObservabilityEnvironment;
}): ReactElement {
  const [month, setMonth] = useState(() => currentMexicoMonth());
  const [report, setReport] = useState<SlaV3Report | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const monthValid = isSlaMonth(month);
  const requestKey = `${environment}:${month}:${reloadTick}`;
  const loading = monthValid && loadedKey !== requestKey;

  useEffect(() => {
    if (!monthValid) return;
    let active = true;
    void readSlaV3Report(environment, month)
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
            : 'No pudimos calcular el cumplimiento del SLA v3.0.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, month, monthValid, requestKey]);

  const visible = monthValid && !loading ? report : null;

  return (
    <div className="space-y-4">
      <div className="ws-card flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium">
            Mes del SLA
            <input
              type="month"
              className="ws-input mt-1 block min-h-10"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <p className="text-xs text-(--ws-muted)">
            Mes calendario en hora de la Ciudad de México (UTC-6, sin horario de
            verano).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ws-btn"
            disabled={!monthValid}
            onClick={() => setReloadTick((n) => n + 1)}
          >
            <Icon name="refresh" size={16} />
            Recalcular
          </button>
          {monthValid &&
            EXPORTS.map((item) => (
              <a
                key={item.kind}
                className="ws-btn"
                href={slaV3ExportUrl(item.kind, environment, month)}
                download
              >
                <Icon name="download" size={16} />
                {item.label}
              </a>
            ))}
          {visible && (
            <button
              type="button"
              className="ws-btn"
              data-variant="primary"
              onClick={() => window.print()}
            >
              Imprimir / PDF
            </button>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {!monthValid ? (
          <p className="ws-empty">Selecciona un mes válido (AAAA-MM).</p>
        ) : loading ? (
          <p className="ws-empty" role="status" aria-busy="true">
            Calculando cumplimiento…
          </p>
        ) : null}
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {visible &&
        (visible.slis.length === 0 ? (
          <p className="ws-empty">Sin indicadores para el mes seleccionado.</p>
        ) : (
          <div className="space-y-4">
            <Card
              title="Resumen del mes"
              subtitle={`SLA v${visible.version} · ${visible.month} · Generado: ${formatMexicoDateTime(visible.generatedAt)}`}
              icon="file-text"
            >
              <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Indicadores', visible.summary.total],
                  ['Cumplen', visible.summary.met],
                  ['No cumplen', visible.summary.unmet],
                  ['Muestra insuficiente', visible.summary.insufficient],
                  ['Sin datos', visible.summary.noData],
                  ['Sin comprobar', visible.summary.unverified],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-(--ws-muted)">{label}</dt>
                    <dd className="text-base font-semibold tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            {visible.compensation.due && (
              <div role="alert" className="ws-alert" data-tone="bad">
                <strong>Compensación por incumplimiento: aplica.</strong>
                <ul className="m-0 mt-1 list-disc pl-5">
                  {visible.compensation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <ComplianceSections report={visible} />
            <IncidentsAndWindows report={visible} />
          </div>
        ))}

      <SlaRecordsPanel
        environment={environment}
        month={month}
        reloadTick={reloadTick}
        onChanged={() => setReloadTick((n) => n + 1)}
      />
    </div>
  );
}

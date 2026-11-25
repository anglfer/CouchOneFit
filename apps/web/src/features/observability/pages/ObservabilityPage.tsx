import { useState, type ReactElement } from 'react';
import RequiresConnection from '../../../components/RequiresConnection';
import { PageHeader } from '../../../components/ui';
import { AutomatedTestsPanel } from '../components/AutomatedTestsPanel';
import { IncidentsPanel } from '../components/IncidentsPanel';
import { LogExplorer } from '../components/LogExplorer';
import { ObservabilityDashboard } from '../components/ObservabilityDashboard';
import { ReportsPanel } from '../components/ReportsPanel';
import { SlaManager } from '../components/SlaManager';
import { SliManager } from '../components/SliManager';
import { SloManager } from '../components/SloManager';
import type {
  ObservabilityEnvironment,
  ObservabilityPeriod,
} from '../types/observability';
import { ENVIRONMENT_OPTIONS, PERIOD_OPTIONS } from '../utils/formatters';

type TabKey =
  | 'dashboard'
  | 'logs'
  | 'slis'
  | 'slos'
  | 'slas'
  | 'tests'
  | 'incidents'
  | 'reports';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard general' },
  { key: 'logs', label: 'Explorador de logs' },
  { key: 'slis', label: 'SLI' },
  { key: 'slos', label: 'SLO' },
  { key: 'slas', label: 'SLA' },
  { key: 'tests', label: 'Pruebas automatizadas' },
  { key: 'incidents', label: 'Incidentes' },
  { key: 'reports', label: 'Reportes' },
];

export default function ObservabilityPage(): ReactElement {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [environment, setEnvironment] =
    useState<ObservabilityEnvironment>('production');
  const [period, setPeriod] = useState<ObservabilityPeriod>('24h');
  const evaluationScope = `${environment}:${period}`;

  return (
    <div className="space-y-5">
      <RequiresConnection what="los datos de observabilidad y niveles de servicio requieren consultar el servidor en vivo" />

      <PageHeader
        title="Observabilidad y niveles de servicio"
        lead="Monitoreo en vivo, registros operativos, pruebas automatizadas, SLI/SLO/SLA e incidentes."
        actions={
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-(--ws-text-2)">
              Ambiente
              <select
                aria-label="Ambiente de observabilidad"
                className="ws-input min-h-9 text-xs"
                value={environment}
                onChange={(e) =>
                  setEnvironment(e.target.value as ObservabilityEnvironment)
                }
              >
                {ENVIRONMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {tab !== 'logs' && tab !== 'incidents' && (
              <label className="flex items-center gap-1.5 text-xs font-medium text-(--ws-text-2)">
                Periodo
                <select
                  aria-label="Periodo de evaluación"
                  className="ws-input min-h-9 text-xs"
                  value={period}
                  onChange={(e) =>
                    setPeriod(e.target.value as ObservabilityPeriod)
                  }
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        }
      />

      <div
        className="client-subtabs"
        role="tablist"
        aria-label="Secciones de observabilidad"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className="ws-plain"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <ObservabilityDashboard
          key={evaluationScope}
          environment={environment}
          period={period}
          onOpenIncidents={() => setTab('incidents')}
        />
      )}
      {tab === 'logs' && (
        <LogExplorer key={environment} environment={environment} />
      )}
      {tab === 'slis' && (
        <SliManager
          key={evaluationScope}
          environment={environment}
          period={period}
        />
      )}
      {tab === 'slos' && (
        <SloManager
          key={evaluationScope}
          environment={environment}
          period={period}
        />
      )}
      {tab === 'slas' && (
        <SlaManager
          key={evaluationScope}
          environment={environment}
          period={period}
        />
      )}
      {tab === 'tests' && (
        <AutomatedTestsPanel
          key={evaluationScope}
          environment={environment}
          period={period}
        />
      )}
      {tab === 'incidents' && (
        <IncidentsPanel key={environment} environment={environment} />
      )}
      {tab === 'reports' && (
        <ReportsPanel
          key={evaluationScope}
          environment={environment}
          period={period}
        />
      )}
    </div>
  );
}

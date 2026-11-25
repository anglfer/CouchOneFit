import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { confirmDialog } from '../../../services/confirm';
import {
  readChecks,
  runMaintenancePrune,
  runManualChecks,
  updateObservabilitySettings,
} from '../services/observability';
import type {
  CheckResultRecord,
  ChecksOverview,
  ObservabilityEnvironment,
  ObservabilityPeriod,
} from '../types/observability';
import {
  checkStatusMeta,
  ENVIRONMENT_OPTIONS,
  formatDateTime,
} from '../utils/formatters';

const PAGE_SIZE = 20;
const RUN_CATEGORIES: Record<string, string> = {
  synthetic_periodic: 'Monitoreo sintético',
  functional_automated: 'Prueba funcional',
  manual_admin: 'Comprobación manual',
  load_controlled: 'Carga controlada',
  ci_suite: 'Suite automatizada',
};

export function AutomatedTestsPanel({
  environment,
  period,
}: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
}): ReactElement {
  const [overview, setOverview] = useState<ChecksOverview | null>(null);
  const [latestChecks, setLatestChecks] = useState<CheckResultRecord[]>([]);
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runDetail, setRunDetail] = useState<{
    runId: string;
    checks: CheckResultRecord[];
    error: string;
  } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const settingsRevision = useRef<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [running, setRunning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${period}:${page}:${reloadTick}`;
  const loading = loadedKey !== requestKey;
  const canOperate = !loading && overview?.runtimeEnvironment === environment;
  const runtimeLabel = ENVIRONMENT_OPTIONS.find(
    ({ value }) => value === overview?.runtimeEnvironment
  )?.label;
  const totalPages = Math.max(
    1,
    Math.ceil((overview?.totalRuns ?? 0) / (overview?.pageSize ?? PAGE_SIZE))
  );
  const selectedRun = overview?.runs.find((run) => run.id === selectedRunId);
  const detail = runDetail?.runId === selectedRunId ? runDetail : null;

  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [intervalMin, setIntervalMin] = useState<5 | 10 | 15 | 30 | 60>(5);
  const [logRetentionDays, setLogRetentionDays] = useState('30');
  const [checkRetentionDays, setCheckRetentionDays] = useState('90');
  const [evalRetentionDays, setEvalRetentionDays] = useState('365');
  const [errorThresholdPct, setErrorThresholdPct] = useState('5');
  const [latencyThresholdMs, setLatencyThresholdMs] = useState('2000');
  const [consecutiveFailures, setConsecutiveFailures] = useState('2');

  useEffect(() => {
    let active = true;
    void readChecks({ environment, period, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(res.totalRuns / res.pageSize));
        if (page > lastPage) {
          setSelectedRunId('');
          setRunDetail(null);
          setPage(lastPage);
          return;
        }
        setOverview(res);
        if (page === 1) setLatestChecks(res.latestChecks);
        if (settingsRevision.current === null) {
          setSelectedKeys(
            res.authorizedChecks
              .filter((check) => check.configured)
              .map((check) => check.key)
          );
        }
        if (settingsRevision.current !== res.settings.updatedAt) {
          settingsRevision.current = res.settings.updatedAt;
          setMonitorEnabled(res.settings.monitorEnabled);
          setIntervalMin(res.settings.checkIntervalMinutes);
          setLogRetentionDays(String(res.settings.logRetentionDays));
          setCheckRetentionDays(String(res.settings.checkRetentionDays));
          setEvalRetentionDays(String(res.settings.evaluationRetentionDays));
          setErrorThresholdPct(
            String(res.settings.incidentErrorRateThresholdPct)
          );
          setLatencyThresholdMs(
            String(res.settings.incidentLatencyP95ThresholdMs)
          );
          setConsecutiveFailures(
            String(res.settings.incidentConsecutiveFailures)
          );
        }
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setOverview(null);
        setError(
          err instanceof ApiError
            ? err.message
            : 'Error al cargar pruebas automatizadas.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, period, page, requestKey]);

  useEffect(() => {
    if (!selectedRunId) return;
    let active = true;
    void readChecks({
      environment,
      period,
      page,
      pageSize: PAGE_SIZE,
      runId: selectedRunId,
    })
      .then(({ latestChecks }) => {
        if (!active) return;
        setRunDetail({
          runId: selectedRunId,
          checks: latestChecks.filter((check) => check.runId === selectedRunId),
          error: '',
        });
      })
      .catch((err) => {
        if (!active) return;
        setRunDetail({
          runId: selectedRunId,
          checks: [],
          error:
            err instanceof ApiError
              ? err.message
              : 'No pudimos consultar los resultados de la ejecución.',
        });
      });
    return () => {
      active = false;
    };
  }, [environment, period, page, selectedRunId]);

  async function handleRunChecks(): Promise<void> {
    if (!canOperate || running) return;
    if (selectedKeys.length === 0) {
      setError('Selecciona al menos una comprobación autorizada.');
      return;
    }
    setRunning(true);
    setError('');
    setStatusMessage('');
    try {
      const res = await runManualChecks(environment, selectedKeys);
      setStatusMessage(
        `Ejecución ${checkStatusMeta(res.status).label.toLowerCase()} con ${res.checks.length} comprobaciones registradas.`
      );
      setPage(1);
      setSelectedRunId(res.runId);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos ejecutar las comprobaciones.'
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canOperate || savingSettings) return;
    setSavingSettings(true);
    setError('');
    setStatusMessage('');
    try {
      await updateObservabilitySettings({
        monitorEnabled,
        checkIntervalMinutes: intervalMin,
        logRetentionDays: Number(logRetentionDays),
        checkRetentionDays: Number(checkRetentionDays),
        evaluationRetentionDays: Number(evalRetentionDays),
        incidentErrorRateThresholdPct: Number(errorThresholdPct),
        incidentLatencyP95ThresholdMs: Number(latencyThresholdMs),
        incidentConsecutiveFailures: Number(consecutiveFailures),
      });
      setStatusMessage(
        `Configuración guardada: frecuencia cada ${intervalMin} min.`
      );
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al guardar la configuración.'
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function handlePrune(): Promise<void> {
    if (!canOperate || pruning) return;
    if (
      !(await confirmDialog({
        title: '¿Aplicar retención y agregación histórica?',
        message:
          'Los logs y comprobaciones fuera de la ventana configurada se resumirán en agregados horarios y se depurarán de las tablas detalladas.',
        confirmLabel: 'Ejecutar depuración',
      }))
    ) {
      return;
    }
    setPruning(true);
    setError('');
    try {
      const res = await runMaintenancePrune();
      setStatusMessage(
        `Depuración completada. Se retiraron ${res.deletedLogs} logs, ${res.deletedChecks} comprobaciones y ${res.deletedEvaluations} evaluaciones del historial detallado.`
      );
      changePage(1);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Error al ejecutar la política de retención.'
      );
    } finally {
      setPruning(false);
    }
  }

  function toggleKey(key: string): void {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function changePage(nextPage: number): void {
    setSelectedRunId('');
    setRunDetail(null);
    setPage(nextPage);
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}
      {statusMessage && (
        <p role="status" className="ws-alert" data-tone="ok">
          {statusMessage}
        </p>
      )}

      <div className="ws-grid-2">
        <Card
          title="Comprobaciones seguras autorizadas"
          subtitle="Ejecución manual acotada a pruebas no destructivas registradas en el servidor."
          icon="play"
          labelId="obs-manual-checks"
          action={
            <button
              type="button"
              className="ws-btn"
              data-variant="primary"
              disabled={running || !canOperate}
              onClick={() => void handleRunChecks()}
            >
              <Icon name="play" size={16} />
              {running ? 'Ejecutando…' : 'Ejecutar seleccionadas'}
            </button>
          }
        >
          {runtimeLabel && overview?.runtimeEnvironment !== environment && (
            <p className="ws-alert" data-tone="info">
              La ejecución manual y los cambios de configuración están
              disponibles en el ambiente de esta API ({runtimeLabel}).
            </p>
          )}
          <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-sm">
            {overview?.authorizedChecks.map((chk) => {
              const latest = latestChecks.find((r) => r.checkKey === chk.key);
              const meta = latest ? checkStatusMeta(latest.status) : null;
              return (
                <li key={chk.key} className="space-y-1 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(chk.key)}
                        disabled={!canOperate || !chk.configured}
                        onChange={() => toggleKey(chk.key)}
                      />
                      <span>{chk.name}</span>
                    </label>
                    <div className="flex gap-1.5">
                      <Badge tone="info">{chk.service}</Badge>
                      {!chk.configured ? (
                        <Badge tone="neutral">Sin configurar</Badge>
                      ) : meta ? (
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      ) : (
                        <Badge tone="neutral">Sin ejecución previa</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-(--ws-muted)">{chk.description}</p>
                  {latest && (
                    <p className="text-xs text-(--ws-text-2)">
                      Última en el periodo: {formatDateTime(latest.executedAt)}{' '}
                      ·{' '}
                      {latest.durationMs !== null
                        ? `${latest.durationMs} ms`
                        : '—'}{' '}
                      · {latest.actualResult}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Frecuencia, umbrales y retención"
          subtitle="La frecuencia configurada se aplica cuando el ejecutor externo está activo."
          icon="settings"
          labelId="obs-settings-card"
        >
          {overview?.runtimeEnvironment === environment ? (
            <form
              onSubmit={(e) => void handleSaveSettings(e)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={monitorEnabled}
                  onChange={(e) => setMonitorEnabled(e.target.checked)}
                />
                <span className="font-semibold">
                  Monitoreo periódico habilitado
                </span>
              </label>
              <label className="block text-xs">
                Frecuencia del monitor externo
                <select
                  className="ws-input mt-1 w-full min-h-9"
                  value={intervalMin}
                  onChange={(e) =>
                    setIntervalMin(
                      Number(e.target.value) as 5 | 10 | 15 | 30 | 60
                    )
                  }
                >
                  <option value={5}>Cada 5 minutos</option>
                  <option value={10}>Cada 10 minutos</option>
                  <option value={15}>Cada 15 minutos</option>
                  <option value={30}>Cada 30 minutos</option>
                  <option value={60}>Cada 60 minutos</option>
                </select>
              </label>
              <label className="block text-xs">
                Fallos consecutivos para incidente
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="ws-input mt-1 w-full min-h-9"
                  value={consecutiveFailures}
                  onChange={(e) => setConsecutiveFailures(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Umbral error 5xx incidente (%)
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  max={100}
                  className="ws-input mt-1 w-full min-h-9"
                  value={errorThresholdPct}
                  onChange={(e) => setErrorThresholdPct(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Umbral latencia P95 incidente (ms)
                <input
                  type="number"
                  min={100}
                  max={60000}
                  className="ws-input mt-1 w-full min-h-9"
                  value={latencyThresholdMs}
                  onChange={(e) => setLatencyThresholdMs(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Retención logs (días)
                <input
                  type="number"
                  min={7}
                  max={365}
                  className="ws-input mt-1 w-full min-h-9"
                  value={logRetentionDays}
                  onChange={(e) => setLogRetentionDays(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                Retención pruebas (días)
                <input
                  type="number"
                  min={14}
                  max={365}
                  className="ws-input mt-1 w-full min-h-9"
                  value={checkRetentionDays}
                  onChange={(e) => setCheckRetentionDays(e.target.value)}
                />
              </label>
              <label className="block text-xs sm:col-span-2">
                Retención evaluaciones SLO (días)
                <input
                  type="number"
                  min={30}
                  max={1095}
                  className="ws-input mt-1 w-full min-h-9"
                  value={evalRetentionDays}
                  onChange={(e) => setEvalRetentionDays(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap justify-between gap-2 pt-2 sm:col-span-2">
                <button
                  type="button"
                  className="ws-btn"
                  disabled={pruning || !canOperate}
                  onClick={() => void handlePrune()}
                >
                  {pruning ? 'Depurando…' : 'Aplicar retención ahora'}
                </button>
                <button
                  type="submit"
                  className="ws-btn"
                  data-variant="primary"
                  disabled={savingSettings || !canOperate}
                >
                  {savingSettings ? 'Guardando…' : 'Guardar configuración'}
                </button>
              </div>
            </form>
          ) : overview ? (
            <p className="text-sm text-(--ws-text-2)">
              Monitoreo{' '}
              {overview.settings.monitorEnabled ? 'habilitado' : 'pausado'}
              {' · '}cada {overview.settings.checkIntervalMinutes} min en{' '}
              {runtimeLabel}.
            </p>
          ) : loading ? (
            <div className="ws-skeleton h-40" />
          ) : null}
        </Card>
      </div>

      <Card
        title="Historial de ejecuciones de pruebas"
        subtitle="Distingue entre monitoreo sintético periódico, pruebas manuales y suites CI/carga."
        icon="clock"
        labelId="obs-runs-history"
      >
        {loading ? (
          <p className="ws-empty" role="status">
            Cargando historial…
          </p>
        ) : !overview ? null : overview.runs.length === 0 ? (
          <p className="ws-empty">
            No hay ejecuciones registradas en este ambiente durante el periodo.
          </p>
        ) : (
          <div
            className="max-h-[32rem] overflow-auto"
            role="region"
            aria-labelledby="obs-runs-history"
            tabIndex={0}
          >
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-(--ws-surface)">
                <tr>
                  <th scope="col" className="p-2">
                    Fecha
                  </th>
                  <th scope="col" className="p-2">
                    Categoría / Origen
                  </th>
                  <th scope="col" className="p-2">
                    Estado
                  </th>
                  <th scope="col" className="p-2">
                    Aprobadas
                  </th>
                  <th scope="col" className="p-2">
                    Fallidas
                  </th>
                  <th scope="col" className="p-2">
                    No ejecutadas
                  </th>
                  <th scope="col" className="p-2">
                    Duración
                  </th>
                  <th scope="col" className="p-2">
                    Resultados
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.runs.map((run) => {
                  const meta = checkStatusMeta(run.status);
                  return (
                    <tr
                      key={run.id}
                      className="border-t border-(--ws-border-subtle)"
                    >
                      <th
                        scope="row"
                        className="p-2 font-normal whitespace-nowrap"
                      >
                        {formatDateTime(run.startedAt)}
                      </th>
                      <td className="p-2">
                        {RUN_CATEGORIES[run.category] ?? run.category} (
                        {run.triggerSource})
                      </td>
                      <td className="p-2">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="p-2 tabular-nums">{run.passedChecks}</td>
                      <td className="p-2 tabular-nums">{run.failedChecks}</td>
                      <td className="p-2 tabular-nums">
                        {run.notExecutedChecks}
                      </td>
                      <td className="p-2 tabular-nums">{run.durationMs} ms</td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="ws-btn min-h-11 whitespace-nowrap"
                          aria-pressed={selectedRunId === run.id}
                          onClick={() => {
                            setRunDetail(null);
                            setSelectedRunId((id) =>
                              id === run.id ? '' : run.id
                            );
                          }}
                        >
                          Ver resultados
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {overview && (
          <nav
            aria-label="Páginas del historial de ejecuciones"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-(--ws-muted)"
          >
            <span aria-live="polite">
              {loading
                ? 'Cargando página…'
                : `${overview.totalRuns} ejecuciones · Página ${page} de ${totalPages}`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="ws-btn min-h-11"
                disabled={loading || page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="ws-btn min-h-11"
                disabled={loading || page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                Siguiente
              </button>
            </div>
          </nav>
        )}
      </Card>

      {!loading && selectedRun && (
        <Card
          title="Resultados de la ejecución"
          subtitle={formatDateTime(selectedRun.startedAt)}
          icon="clipboard"
          labelId="obs-checks-detail"
        >
          {!detail ? (
            <p className="ws-empty" role="status">
              Cargando resultados…
            </p>
          ) : detail.error ? (
            <p className="ws-alert" role="alert" data-tone="bad">
              {detail.error}
            </p>
          ) : detail.checks.length === 0 ? (
            <p className="ws-empty">
              Sin resultados individuales disponibles para esta ejecución.
            </p>
          ) : (
            <div
              className="max-h-[32rem] overflow-auto"
              role="region"
              aria-labelledby="obs-checks-detail"
              tabIndex={0}
            >
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-(--ws-surface)">
                  <tr>
                    <th scope="col" className="p-2">
                      Fecha
                    </th>
                    <th scope="col" className="p-2">
                      Prueba
                    </th>
                    <th scope="col" className="p-2">
                      Servicio
                    </th>
                    <th scope="col" className="p-2">
                      Estado
                    </th>
                    <th scope="col" className="p-2">
                      Esperado
                    </th>
                    <th scope="col" className="p-2">
                      Obtenido
                    </th>
                    <th scope="col" className="p-2">
                      HTTP / ms
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.checks.map((chk) => {
                    const meta = checkStatusMeta(chk.status);
                    return (
                      <tr
                        key={chk.id}
                        className="border-t border-(--ws-border-subtle)"
                      >
                        <td className="p-2 whitespace-nowrap">
                          {formatDateTime(chk.executedAt)}
                        </td>
                        <th scope="row" className="p-2 font-semibold">
                          {chk.checkName}
                        </th>
                        <td className="p-2">
                          {chk.service} ({chk.module})
                        </td>
                        <td className="p-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="max-w-xs p-2">{chk.expectedResult}</td>
                        <td className="max-w-xs p-2">
                          {chk.actualResult}
                          {(chk.errorCode || chk.errorMessage) && (
                            <span className="block text-(--ws-bad-fg)">
                              {[chk.errorCode, chk.errorMessage]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap tabular-nums">
                          {chk.httpStatus ?? '—'} ·{' '}
                          {chk.durationMs !== null
                            ? `${chk.durationMs} ms`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { confirmDialog } from '../../../services/confirm';
import {
  createSli,
  readSlis,
  readSliVersions,
  toggleSliStatus,
  updateSli,
} from '../services/observability';
import type {
  ObservabilityEnvironment,
  ObservabilityPeriod,
  SliCalculationMethod,
  SliDataSource,
  SliIndicatorType,
  SliUnit,
  SliVersionRecord,
  SliWithValue,
} from '../types/observability';
import { formatDateTime, formatMetric } from '../utils/formatters';

const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

function splitFilterValues(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function SliManager({
  environment,
  period,
}: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
}): ReactElement {
  const [items, setItems] = useState<SliWithValue[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SliWithValue | null>(null);
  const [versions, setVersions] = useState<SliVersionRecord[] | null>(null);
  const [versionsTitle, setVersionsTitle] = useState('');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [service, setService] = useState('api');
  const [characteristic, setCharacteristic] = useState('Latencia');
  const [dataSource, setDataSource] =
    useState<SliDataSource>('operational_http');
  const [indicatorType, setIndicatorType] = useState<SliIndicatorType>(
    'latency_threshold_pct'
  );
  const [unit, setUnit] = useState<SliUnit>('%');
  const [evaluationPeriod, setEvaluationPeriod] =
    useState<ObservabilityPeriod>('7d');
  const [percentile, setPercentile] = useState('95');
  const [thresholdMs, setThresholdMs] = useState('1000');
  const [targetModule, setTargetModule] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const [pathPrefix, setPathPrefix] = useState('');
  const [excludePaths, setExcludePaths] = useState('');
  const [statusCodes, setStatusCodes] = useState('');
  const [includeNotExecuted, setIncludeNotExecuted] = useState(false);
  const [inclusionCriteria, setInclusionCriteria] = useState(
    'Solicitudes HTTP válidas del módulo seleccionado.'
  );
  const [exclusionCriteria, setExclusionCriteria] = useState(
    'Endpoints de salud (/api/health*) y observabilidad.'
  );
  const [changeReason, setChangeReason] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${period}:${reloadTick}`;
  const loading = loadedKey !== requestKey;
  const httpSource = dataSource === 'operational_http';
  const checkSource =
    dataSource === 'synthetic_availability' ||
    dataSource === 'synthetic_functional' ||
    dataSource === 'automated_tests';

  useEffect(() => {
    let active = true;
    void readSlis(environment, period)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : 'Error al cargar los SLI.'
        );
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [environment, period, requestKey]);

  function openNew(): void {
    setEditing(null);
    setCode('');
    setName('');
    setDescription('');
    setService('api');
    setCharacteristic('Latencia');
    setDataSource('operational_http');
    setIndicatorType('latency_threshold_pct');
    setUnit('%');
    setEvaluationPeriod('7d');
    setPercentile('95');
    setThresholdMs('1000');
    setTargetModule('');
    setMethods([]);
    setPathPrefix('');
    setExcludePaths('');
    setStatusCodes('');
    setIncludeNotExecuted(false);
    setInclusionCriteria('Solicitudes HTTP válidas del servicio.');
    setExclusionCriteria('Rutas /api/health* y /api/observability*.');
    setChangeReason('');
    setFormOpen(true);
  }

  function openEdit(item: SliWithValue): void {
    setEditing(item);
    setCode(item.code);
    setName(item.name);
    setDescription(item.description);
    setService(item.service);
    setCharacteristic(item.characteristic);
    setDataSource(item.dataSource);
    setIndicatorType(item.indicatorType);
    setUnit(item.unit);
    setEvaluationPeriod(item.evaluationPeriod);
    setPercentile(String(item.calculationMethod.percentile ?? 95));
    setThresholdMs(String(item.calculationMethod.thresholdMs ?? 1000));
    setTargetModule(item.calculationMethod.module ?? '');
    setMethods(item.calculationMethod.methods ?? []);
    setPathPrefix(item.calculationMethod.pathPrefix ?? '');
    setExcludePaths(item.calculationMethod.excludePaths?.join(', ') ?? '');
    setStatusCodes(item.calculationMethod.statusCodes?.join(', ') ?? '');
    setIncludeNotExecuted(item.calculationMethod.includeNotExecuted ?? false);
    setInclusionCriteria(item.inclusionCriteria);
    setExclusionCriteria(item.exclusionCriteria);
    setChangeReason('');
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError('');
    const calculationMethod: SliCalculationMethod = {};
    if (targetModule.trim()) calculationMethod.module = targetModule.trim();
    if (indicatorType === 'latency_percentile') {
      calculationMethod.percentile = Number(percentile);
    }
    if (indicatorType === 'latency_threshold_pct') {
      calculationMethod.thresholdMs = Number(thresholdMs);
    }
    if (httpSource) {
      if (methods.length) calculationMethod.methods = methods;
      if (pathPrefix.trim()) calculationMethod.pathPrefix = pathPrefix.trim();
      if (excludePaths.trim())
        calculationMethod.excludePaths = splitFilterValues(excludePaths);
      if (statusCodes.trim())
        calculationMethod.statusCodes =
          splitFilterValues(statusCodes).map(Number);
    }
    if (checkSource) calculationMethod.includeNotExecuted = includeNotExecuted;
    const payload = {
      ...(editing ? {} : { code: code.trim().toLowerCase() }),
      name: name.trim(),
      description: description.trim(),
      service: service.trim(),
      characteristic: characteristic.trim(),
      dataSource,
      indicatorType,
      unit,
      calculationMethod,
      inclusionCriteria: inclusionCriteria.trim(),
      exclusionCriteria: exclusionCriteria.trim(),
      evaluationPeriod,
      changeReason: changeReason.trim() || undefined,
    };

    try {
      if (editing) {
        await updateSli(editing.id, payload);
      } else {
        await createSli(payload);
      }
      setFormOpen(false);
      setEditing(null);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No pudimos guardar el SLI.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(item: SliWithValue): Promise<void> {
    const next = !item.isActive;
    if (
      !(await confirmDialog({
        title: next ? '¿Activar SLI?' : '¿Desactivar SLI?',
        message: next
          ? `El indicador «${item.name}» volverá a participar en evaluaciones.`
          : `Desactivar «${item.name}» dejará sus SLO asociados sin datos evaluables.`,
        confirmLabel: next ? 'Activar' : 'Desactivar',
      }))
    ) {
      return;
    }
    try {
      await toggleSliStatus(item.id, next);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No pudimos actualizar el SLI.'
      );
    }
  }

  async function showVersions(item: SliWithValue): Promise<void> {
    try {
      const res = await readSliVersions(item.id);
      setVersionsTitle(item.name);
      setVersions(res.versions);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos consultar el historial.'
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-(--ws-muted)">
          Los SLI se calculan dinámicamente con fórmulas seguras y parámetros
          auditables sobre los registros reales del ambiente.
        </p>
        <button
          type="button"
          className="ws-btn"
          data-variant="primary"
          onClick={() => (formOpen ? setFormOpen(false) : openNew())}
        >
          <Icon name={formOpen ? 'close' : 'plus'} size={16} />
          {formOpen ? 'Cerrar formulario' : 'Nuevo SLI'}
        </button>
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {formOpen && (
        <Card
          title={editing ? `Editar SLI: ${editing.name}` : 'Crear nuevo SLI'}
          subtitle="Configura fuente, tipo de indicador y criterios sin introducir código arbitrario."
          icon="sliders"
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {!editing && (
              <label className="block text-sm">
                Código único (ej. training_latency_under_1s)
                <input
                  required
                  className="ws-input mt-1 w-full min-h-10"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm">
              Nombre del indicador
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              Descripción
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Servicio evaluado
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={service}
                onChange={(e) => setService(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Característica medida
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={characteristic}
                onChange={(e) => setCharacteristic(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Fuente de información
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value as SliDataSource)}
              >
                <option value="operational_http">
                  Logs operativos HTTP de la API
                </option>
                <option value="synthetic_availability">
                  Comprobaciones sintéticas de disponibilidad
                </option>
                <option value="synthetic_functional">
                  Pruebas funcionales sintéticas
                </option>
                <option value="automated_tests">
                  Suites automatizadas (CI/local)
                </option>
                <option value="client_telemetry">
                  Telemetría técnica de clientes
                </option>
              </select>
            </label>
            <label className="block text-sm">
              Tipo de indicador / cálculo
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={indicatorType}
                onChange={(e) =>
                  setIndicatorType(e.target.value as SliIndicatorType)
                }
              >
                <option value="availability">Disponibilidad (%)</option>
                <option value="latency_mean">Latencia promedio (ms)</option>
                <option value="latency_percentile">
                  Percentil de latencia (ms)
                </option>
                <option value="latency_threshold_pct">
                  % de solicitudes bajo umbral de latencia
                </option>
                <option value="error_rate">Tasa de errores 5xx (%)</option>
                <option value="operation_success_rate">
                  % de operaciones exitosas
                </option>
                <option value="reliability">Confiabilidad (%)</option>
                <option value="recovery_time">
                  Tiempo de recuperación ante fallos (s)
                </option>
                <option value="functional_test_success">
                  Éxito de pruebas funcionales (%)
                </option>
              </select>
            </label>
            <label className="block text-sm">
              Unidad de medida
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={unit}
                onChange={(e) => setUnit(e.target.value as SliUnit)}
              >
                <option value="%">Porcentaje (%)</option>
                <option value="ms">Milisegundos (ms)</option>
                <option value="s">Segundos (s)</option>
                <option value="rps">Solicitudes/s (rps)</option>
              </select>
            </label>
            <label className="block text-sm">
              Periodo predeterminado
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={evaluationPeriod}
                onChange={(e) =>
                  setEvaluationPeriod(e.target.value as ObservabilityPeriod)
                }
              >
                <option value="1h">1 hora</option>
                <option value="24h">24 horas</option>
                <option value="7d">7 días</option>
                <option value="30d">30 días</option>
              </select>
            </label>
            {indicatorType === 'latency_percentile' && (
              <label className="block text-sm">
                Percentil (1–99)
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="ws-input mt-1 w-full min-h-10"
                  value={percentile}
                  onChange={(e) => setPercentile(e.target.value)}
                />
              </label>
            )}
            {indicatorType === 'latency_threshold_pct' && (
              <label className="block text-sm">
                Umbral máximo de respuesta (ms)
                <input
                  type="number"
                  min={1}
                  max={120000}
                  className="ws-input mt-1 w-full min-h-10"
                  value={thresholdMs}
                  onChange={(e) => setThresholdMs(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm">
              Filtro opcional de módulo (ej. training, nutrition)
              <input
                className="ws-input mt-1 w-full min-h-10"
                value={targetModule}
                onChange={(e) => setTargetModule(e.target.value)}
                placeholder="Vacío = todos"
              />
            </label>
            {httpSource && (
              <>
                <fieldset className="min-w-0 text-sm md:col-span-2">
                  <legend>Métodos HTTP elegibles</legend>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                    {HTTP_METHODS.map((method) => (
                      <label
                        key={method}
                        className="inline-flex items-center gap-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={methods.includes(method)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setMethods((current) =>
                              checked
                                ? [...current, method]
                                : current.filter((item) => item !== method)
                            );
                          }}
                        />
                        {method}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-(--ws-muted)">
                    Sin selección se incluyen todos los métodos.
                  </p>
                </fieldset>
                <label className="block text-sm">
                  Prefijo de ruta elegible
                  <input
                    className="ws-input mt-1 w-full min-h-10"
                    value={pathPrefix}
                    onChange={(e) => setPathPrefix(e.target.value)}
                    placeholder="/api/clients"
                  />
                </label>
                <label className="block text-sm">
                  Códigos HTTP elegibles, separados por coma
                  <input
                    className="ws-input mt-1 w-full min-h-10"
                    value={statusCodes}
                    onChange={(e) => setStatusCodes(e.target.value)}
                    pattern={'[1-5][0-9]{2}(?:\\s*,\\s*[1-5][0-9]{2})*'}
                    placeholder="200, 304"
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  Prefijos de ruta excluidos, separados por coma
                  <input
                    className="ws-input mt-1 w-full min-h-10"
                    value={excludePaths}
                    onChange={(e) => setExcludePaths(e.target.value)}
                    placeholder="/api/auth, /api/plans"
                  />
                </label>
              </>
            )}
            {checkSource && (
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={includeNotExecuted}
                  onChange={(e) => setIncludeNotExecuted(e.target.checked)}
                />
                Incluir comprobaciones no ejecutadas en el cálculo
              </label>
            )}
            <label className="block text-sm">
              Descripción de los criterios de inclusión
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={inclusionCriteria}
                onChange={(e) => setInclusionCriteria(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Descripción de los criterios de exclusión
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={exclusionCriteria}
                onChange={(e) => setExclusionCriteria(e.target.value)}
              />
            </label>
            {editing && (
              <label className="block text-sm md:col-span-2">
                Motivo del cambio (para historial de versiones)
                <input
                  className="ws-input mt-1 w-full min-h-10"
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                />
              </label>
            )}
            <div className="flex justify-end gap-2 md:col-span-2">
              <button
                type="button"
                className="ws-btn"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="ws-btn"
                data-variant="primary"
                disabled={busy}
              >
                {busy
                  ? 'Guardando…'
                  : editing
                    ? 'Guardar nueva versión'
                    : 'Crear SLI'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {versions && (
        <Card
          title={`Historial de versiones: ${versionsTitle}`}
          action={
            <button
              type="button"
              className="ws-btn"
              onClick={() => setVersions(null)}
            >
              Cerrar
            </button>
          }
        >
          <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-xs">
            {versions.map((v) => (
              <li key={v.id} className="py-2">
                <strong>v{v.version}</strong> · Vigencia:{' '}
                {formatDateTime(v.effectiveFrom)} →{' '}
                {v.effectiveTo ? formatDateTime(v.effectiveTo) : 'Vigente'} ·{' '}
                {v.changedByUsername ?? 'sistema'} · {v.changeReason ?? '—'}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section className="ws-card overflow-x-auto p-0!">
        {loading ? (
          <div className="space-y-2 p-5" role="status" aria-busy="true">
            <div className="ws-skeleton h-10" />
            <div className="ws-skeleton h-10" />
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="p-3">Indicador (SLI)</th>
                <th className="p-3">Servicio / Fuente</th>
                <th className="p-3">Valor actual</th>
                <th className="p-3">Muestras</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-(--ws-border-subtle)"
                >
                  <td className="p-3">
                    <p className="font-semibold text-(--ws-text)">
                      {item.name} (v{item.currentVersion})
                    </p>
                    <p className="text-(--ws-muted)">{item.description}</p>
                  </td>
                  <td className="p-3">
                    {item.service} · {item.dataSource}
                    {item.calculationMethod.module
                      ? ` (${item.calculationMethod.module})`
                      : ''}
                  </td>
                  <td className="p-3 font-bold tabular-nums">
                    {formatMetric(item.observedValue, item.unit)}
                    {item.note && (
                      <p className="font-normal text-(--ws-muted)">
                        {item.note}
                      </p>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{item.samples}</td>
                  <td className="p-3">
                    <Badge tone={item.isActive ? 'ok' : 'neutral'}>
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="ws-btn min-h-8 px-2.5 py-1 text-xs"
                        onClick={() => openEdit(item)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ws-btn min-h-8 px-2.5 py-1 text-xs"
                        onClick={() => void handleToggle(item)}
                      >
                        {item.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="ws-btn min-h-8 px-2.5 py-1 text-xs"
                        onClick={() => void showVersions(item)}
                      >
                        Versiones
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

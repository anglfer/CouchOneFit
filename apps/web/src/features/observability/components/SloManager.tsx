import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card, Meter } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { confirmDialog } from '../../../services/confirm';
import {
  createSlo,
  evaluateSlosNow,
  readSlis,
  readSloHistory,
  readSlos,
  toggleSloStatus,
  updateSlo,
} from '../services/observability';
import type {
  ComparisonOperator,
  ObservabilityEnvironment,
  ObservabilityPeriod,
  SliUnit,
  SliWithValue,
  SloEvaluated,
  SloEvaluationRecord,
  SloVersionRecord,
} from '../types/observability';
import {
  complianceMeta,
  formatDateTime,
  formatMetric,
} from '../utils/formatters';

export function SloManager({
  environment,
  period,
}: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
}): ReactElement {
  const [items, setItems] = useState<SloEvaluated[]>([]);
  const [slis, setSlis] = useState<SliWithValue[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SloEvaluated | null>(null);
  const [history, setHistory] = useState<{
    name: string;
    versions: SloVersionRecord[];
    evaluations: SloEvaluationRecord[];
  } | null>(null);

  const [code, setCode] = useState('');
  const [sliId, setSliId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('95');
  const [comparisonOperator, setComparisonOperator] =
    useState<ComparisonOperator>('>=');
  const [unit, setUnit] = useState<SliUnit>('%');
  const [evaluationPeriod, setEvaluationPeriod] =
    useState<ObservabilityPeriod>('7d');
  const [minSamples, setMinSamples] = useState('10');
  const [changeReason, setChangeReason] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${period}:${reloadTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    void Promise.all([
      readSlos(environment, period),
      readSlis(environment, period),
    ])
      .then(([slosRes, slisRes]) => {
        if (!active) return;
        setItems(slosRes.items);
        setSlis(slisRes.items);
        setSliId((prev) => prev || slisRes.items[0]?.id || '');
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : 'Error al cargar los SLO.'
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
    setSliId(slis[0]?.id ?? '');
    setName('');
    setDescription('');
    setTargetValue('95');
    setComparisonOperator('>=');
    setUnit(slis[0]?.unit ?? '%');
    setEvaluationPeriod('7d');
    setMinSamples('10');
    setChangeReason('');
    setFormOpen(true);
  }

  function openEdit(item: SloEvaluated): void {
    setEditing(item);
    setCode(item.code);
    setSliId(item.sliId);
    setName(item.name);
    setDescription(item.description);
    setTargetValue(String(item.targetValue));
    setComparisonOperator(item.comparisonOperator);
    setUnit(item.unit);
    setEvaluationPeriod(item.evaluationPeriod);
    setMinSamples(String(item.minSamples));
    setChangeReason('');
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      ...(editing ? {} : { code: code.trim().toLowerCase() }),
      sliId,
      name: name.trim(),
      description: description.trim(),
      targetValue: Number(targetValue),
      comparisonOperator,
      unit,
      evaluationPeriod,
      minSamples: Number(minSamples),
      status: 'active',
      changeReason: changeReason.trim() || undefined,
    };
    try {
      if (editing) await updateSlo(editing.id, payload);
      else await createSlo(payload);
      setFormOpen(false);
      setEditing(null);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No pudimos guardar el SLO.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(item: SloEvaluated): Promise<void> {
    const next = item.status !== 'active';
    if (
      !(await confirmDialog({
        title: next ? '¿Activar SLO?' : '¿Desactivar SLO?',
        message: `Los cambios de estado se registran en auditoría y conservan las evaluaciones previas.`,
        confirmLabel: next ? 'Activar' : 'Desactivar',
      }))
    ) {
      return;
    }
    try {
      await toggleSloStatus(item.id, next);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No pudimos actualizar el SLO.'
      );
    }
  }

  async function handleEvaluate(): Promise<void> {
    setEvaluating(true);
    setError('');
    try {
      await evaluateSlosNow(environment, period);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al evaluar los SLO.'
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function openHistory(item: SloEvaluated): Promise<void> {
    try {
      const res = await readSloHistory(item.id, environment);
      setHistory({ name: item.name, ...res });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al leer historial.'
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="ws-alert" data-tone="info">
        <strong>Objetivos internos (SLO):</strong> los objetivos definidos aquí
        son metas operativas internas para monitoreo y mejora continua;{' '}
        <strong>no</strong> constituyen un acuerdo contractual SLA aprobado.
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="ws-btn"
          disabled={evaluating}
          onClick={() => void handleEvaluate()}
        >
          <Icon name="check-circle" size={16} />
          {evaluating ? 'Evaluando…' : 'Evaluar y guardar corte'}
        </button>
        <button
          type="button"
          className="ws-btn"
          data-variant="primary"
          onClick={() => (formOpen ? setFormOpen(false) : openNew())}
        >
          <Icon name={formOpen ? 'close' : 'plus'} size={16} />
          {formOpen ? 'Cerrar formulario' : 'Nuevo SLO'}
        </button>
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {formOpen && (
        <Card
          title={editing ? `Editar SLO: ${editing.name}` : 'Crear nuevo SLO'}
          subtitle="Cada edición crea una nueva versión vigente para preservar la interpretación histórica."
          icon="target"
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {!editing && (
              <label className="block text-sm">
                Código único
                <input
                  required
                  className="ws-input mt-1 w-full min-h-10"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ej. slo_training_p95_pct"
                />
              </label>
            )}
            <label className="block text-sm">
              SLI asociado
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={sliId}
                onChange={(e) => {
                  setSliId(e.target.value);
                  const found = slis.find((s) => s.id === e.target.value);
                  if (found) setUnit(found.unit);
                }}
              >
                {slis.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Nombre del SLO
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
              Operador de comparación
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={comparisonOperator}
                onChange={(e) =>
                  setComparisonOperator(e.target.value as ComparisonOperator)
                }
              >
                <option value=">=">&gt;= (al menos)</option>
                <option value="<=">&lt;= (como máximo)</option>
                <option value=">">&gt; (mayor que)</option>
                <option value="<">&lt; (menor que)</option>
              </select>
            </label>
            <label className="block text-sm">
              Valor objetivo ({unit})
              <input
                required
                type="number"
                step="0.01"
                className="ws-input mt-1 w-full min-h-10"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Periodo de evaluación
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
            <label className="block text-sm">
              Muestras mínimas requeridas
              <input
                required
                type="number"
                min={1}
                className="ws-input mt-1 w-full min-h-10"
                value={minSamples}
                onChange={(e) => setMinSamples(e.target.value)}
              />
            </label>
            {editing && (
              <label className="block text-sm md:col-span-2">
                Motivo del cambio (conserva historial y vigencia anterior)
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
                    ? 'Guardar versión'
                    : 'Crear SLO'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {history && (
        <Card
          title={`Historial de vigencia y cumplimiento: ${history.name}`}
          action={
            <button
              type="button"
              className="ws-btn"
              onClick={() => setHistory(null)}
            >
              Cerrar
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-(--ws-muted)">
                Versiones de definición ({history.versions.length})
              </h4>
              <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-xs">
                {history.versions.map((v) => (
                  <li key={v.id} className="py-2">
                    <strong>v{v.version}</strong>: {v.comparisonOperator}{' '}
                    {v.targetValue} {v.unit} ({v.evaluationPeriod}) ·{' '}
                    {formatDateTime(v.effectiveFrom)} →{' '}
                    {v.effectiveTo ? formatDateTime(v.effectiveTo) : 'Vigente'}{' '}
                    · {v.changeReason ?? '—'}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold text-(--ws-muted)">
                Evaluaciones guardadas ({history.evaluations.length})
              </h4>
              {history.evaluations.length === 0 ? (
                <p className="text-xs text-(--ws-muted)">
                  Aún no hay cortes persistidos para este SLO en este ambiente.
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-(--ws-border-subtle) p-0 text-xs">
                  {history.evaluations.slice(0, 15).map((ev) => (
                    <li key={ev.id} className="py-2">
                      {formatDateTime(ev.evaluatedAt)} · v{ev.sloVersion} ·{' '}
                      <strong>
                        {complianceMeta(ev.complianceStatus).label}
                      </strong>{' '}
                      · Observado: {ev.observedValue ?? 'n/d'} ({ev.samples}{' '}
                      muestras)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="ws-skeleton h-28" />
        ) : (
          items.map((slo) => {
            const meta = complianceMeta(slo.complianceStatus);
            const trendLabel =
              slo.trendDirection === 'improving'
                ? 'Mejorando'
                : slo.trendDirection === 'worsening'
                  ? 'Empeorando'
                  : slo.trendDirection === 'stable'
                    ? 'Estable'
                    : 'Sin referencia previa';
            return (
              <section key={slo.id} className="ws-card space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="ws-card-title">
                      {slo.name}{' '}
                      <span className="text-xs font-normal text-(--ws-muted)">
                        (v{slo.currentVersion} · {slo.status})
                      </span>
                    </h3>
                    <p className="text-xs text-(--ws-muted)">
                      {slo.description} · SLI: {slo.sliName ?? slo.sliCode} ·
                      Vigencia desde {formatDateTime(slo.effectiveFrom)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <Badge tone="neutral">{trendLabel}</Badge>
                  </div>
                </div>
                {slo.periodStart && slo.periodEnd && (
                  <p className="text-xs text-(--ws-muted)">
                    Ventana evaluada {formatDateTime(slo.periodStart)} a{' '}
                    {formatDateTime(slo.periodEnd)}
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                  <div>
                    <dt className="text-(--ws-muted)">Objetivo</dt>
                    <dd className="font-semibold tabular-nums">
                      {slo.comparisonOperator} {slo.targetValue} {slo.unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--ws-muted)">Valor real</dt>
                    <dd className="font-bold tabular-nums">
                      {formatMetric(slo.observedValue, slo.unit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--ws-muted)">Diferencia</dt>
                    <dd className="font-semibold tabular-nums">
                      {slo.deltaValue !== null
                        ? `${slo.deltaValue > 0 ? '+' : ''}${slo.deltaValue} ${slo.unit}`
                        : 'Sin datos'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--ws-muted)">Muestras</dt>
                    <dd className="font-semibold tabular-nums">
                      {slo.samples} (mín. {slo.minSamples})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-(--ws-muted)">Presupuesto restante</dt>
                    <dd className="font-semibold tabular-nums">
                      {slo.errorBudgetRemainingPct !== null
                        ? `${slo.errorBudgetRemainingPct}%`
                        : 'N/A'}
                    </dd>
                  </div>
                </dl>

                {slo.errorBudgetRemainingPct !== null && (
                  <Meter
                    value={slo.errorBudgetRemainingPct}
                    max={100}
                    label={`Presupuesto de error restante para ${slo.name}`}
                  />
                )}

                {slo.notes && (
                  <p className="text-xs text-(--ws-muted)">Nota: {slo.notes}</p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="ws-btn min-h-8 px-3 py-1 text-xs"
                    onClick={() => openEdit(slo)}
                  >
                    Editar objetivo
                  </button>
                  <button
                    type="button"
                    className="ws-btn min-h-8 px-3 py-1 text-xs"
                    onClick={() => void handleToggle(slo)}
                  >
                    {slo.status === 'active' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    className="ws-btn min-h-8 px-3 py-1 text-xs"
                    onClick={() => void openHistory(slo)}
                  >
                    Historial y vigencia
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

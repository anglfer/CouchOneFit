import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Badge, Card } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { confirmDialog } from '../../../services/confirm';
import {
  createSla,
  readSlas,
  readSlos,
  toggleSlaStatus,
  updateSla,
} from '../services/observability';
import type {
  ObservabilityEnvironment,
  ObservabilityPeriod,
  SlaAgreement,
  SlaApprovalStatus,
  SloEvaluated,
} from '../types/observability';
import {
  complianceMeta,
  formatDateTime,
  slaApprovalLabel,
} from '../utils/formatters';

export function SlaManager({
  environment,
  period,
}: {
  environment: ObservabilityEnvironment;
  period: ObservabilityPeriod;
}): ReactElement {
  const [items, setItems] = useState<SlaAgreement[]>([]);
  const [slos, setSlos] = useState<SloEvaluated[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SlaAgreement | null>(null);

  const [name, setName] = useState('');
  const [coveredService, setCoveredService] = useState('');
  const [commitments, setCommitments] = useState('');
  const [approvalStatus, setApprovalStatus] =
    useState<SlaApprovalStatus>('draft');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [breachConsequences, setBreachConsequences] = useState('');
  const [selectedSloIds, setSelectedSloIds] = useState<string[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const requestKey = `${environment}:${period}:${reloadTick}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    void Promise.all([
      readSlas(environment, period),
      readSlos(environment, period),
    ])
      .then(([slasRes, slosRes]) => {
        if (!active) return;
        setItems(slasRes.items);
        setSlos(slosRes.items);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'Error al cargar acuerdos SLA.'
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
    setName('');
    setCoveredService('');
    setCommitments('');
    setApprovalStatus('draft');
    setEffectiveFrom(new Date().toISOString().slice(0, 16));
    setEffectiveTo('');
    setResponsibilities('');
    setExclusions('');
    setBreachConsequences('');
    setSelectedSloIds([]);
    setFormOpen(true);
  }

  function openEdit(item: SlaAgreement): void {
    setEditing(item);
    setName(item.name);
    setCoveredService(item.coveredService);
    setCommitments(item.commitments);
    setApprovalStatus(item.approvalStatus);
    setEffectiveFrom(item.effectiveFrom.slice(0, 16));
    setEffectiveTo(item.effectiveTo ? item.effectiveTo.slice(0, 16) : '');
    setResponsibilities(item.responsibilities);
    setExclusions(item.exclusions);
    setBreachConsequences(item.breachConsequences ?? '');
    setSelectedSloIds(item.sloIds);
    setFormOpen(true);
  }

  function toggleSloSelection(id: string): void {
    setSelectedSloIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      name: name.trim(),
      coveredService: coveredService.trim(),
      commitments: commitments.trim(),
      approvalStatus,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
      responsibilities: responsibilities.trim(),
      exclusions: exclusions.trim(),
      breachConsequences: breachConsequences.trim() || null,
      sloIds: selectedSloIds,
      isActive: true,
    };
    try {
      if (editing) await updateSla(editing.id, payload);
      else await createSla(payload);
      setFormOpen(false);
      setEditing(null);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No pudimos guardar el SLA.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(item: SlaAgreement): Promise<void> {
    const next = !item.isActive;
    if (
      !(await confirmDialog({
        title: next ? '¿Activar acuerdo SLA?' : '¿Desactivar acuerdo SLA?',
        message: `Se actualizará la vigencia operativa del registro «${item.name}».`,
        confirmLabel: next ? 'Activar' : 'Desactivar',
      }))
    ) {
      return;
    }
    try {
      await toggleSlaStatus(item.id, next);
      setReloadTick((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Error al cambiar el SLA.'
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-(--ws-muted)">
          Registra únicamente acuerdos SLA formalmente definidos o aprobados y
          asócialos con sus SLO correspondientes (DEC-013: el proyecto no asume
          compromisos contractuales no aprobados).
        </p>
        <button
          type="button"
          className="ws-btn"
          data-variant="primary"
          onClick={() => (formOpen ? setFormOpen(false) : openNew())}
        >
          <Icon name={formOpen ? 'close' : 'plus'} size={16} />
          {formOpen ? 'Cerrar formulario' : 'Registrar SLA'}
        </button>
      </div>

      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}

      {formOpen && (
        <Card
          title={
            editing ? `Editar SLA: ${editing.name}` : 'Registrar acuerdo SLA'
          }
          subtitle="Las consecuencias por incumplimiento solo deben llenarse si existen de forma formal."
          icon="file-text"
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <label className="block text-sm">
              Nombre del acuerdo
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Servicio cubierto
              <input
                required
                className="ws-input mt-1 w-full min-h-10"
                value={coveredService}
                onChange={(e) => setCoveredService(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Estado formal
              <select
                className="ws-input mt-1 w-full min-h-10"
                value={approvalStatus}
                onChange={(e) =>
                  setApprovalStatus(e.target.value as SlaApprovalStatus)
                }
              >
                <option value="draft">Borrador</option>
                <option value="internal_reference">Referencia interna</option>
                <option value="formally_approved">Formalmente aprobado</option>
                <option value="expired">Vencido</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                Vigencia desde
                <input
                  required
                  type="datetime-local"
                  className="ws-input mt-1 w-full min-h-10"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Vigencia hasta (opcional)
                <input
                  type="datetime-local"
                  className="ws-input mt-1 w-full min-h-10"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm md:col-span-2">
              Compromisos establecidos
              <textarea
                required
                rows={2}
                className="ws-input mt-1 w-full"
                value={commitments}
                onChange={(e) => setCommitments(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Responsabilidades
              <textarea
                required
                rows={2}
                className="ws-input mt-1 w-full"
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Exclusiones
              <textarea
                required
                rows={2}
                className="ws-input mt-1 w-full"
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              Consecuencias por incumplimiento (solo si están formalmente
              definidas)
              <input
                className="ws-input mt-1 w-full min-h-10"
                value={breachConsequences}
                onChange={(e) => setBreachConsequences(e.target.value)}
                placeholder="Dejar vacío si no hay penalizaciones aprobadas"
              />
            </label>
            <div className="md:col-span-2">
              <span className="block text-sm font-medium">SLO asociados</span>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {slos.map((slo) => (
                  <label
                    key={slo.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-(--ws-border-subtle) p-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSloIds.includes(slo.id)}
                      onChange={() => toggleSloSelection(slo.id)}
                    />
                    <span>{slo.name}</span>
                  </label>
                ))}
              </div>
            </div>
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
                    ? 'Guardar cambios'
                    : 'Guardar SLA'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="ws-skeleton h-28" />
      ) : items.length === 0 ? (
        <section className="ws-card ws-empty">
          <h3 className="ws-card-title">Sin acuerdos SLA registrados</h3>
          <p>
            Actualmente CouchOne Fit opera con objetivos internos (SLO) según
            DEC-013 y no tiene acuerdos SLA contractuales activos. Puedes
            registrar uno si la dirección aprueba compromisos formales.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((sla) => {
            const comp = complianceMeta(sla.observedCompliance);
            return (
              <section key={sla.id} className="ws-card space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="ws-card-title">{sla.name}</h3>
                    <p className="text-xs text-(--ws-muted)">
                      Servicio: {sla.coveredService} · Estado formal:{' '}
                      {slaApprovalLabel(sla.approvalStatus)} · Vigencia:{' '}
                      {formatDateTime(sla.effectiveFrom)} →{' '}
                      {sla.effectiveTo
                        ? formatDateTime(sla.effectiveTo)
                        : 'Abierta'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge tone={comp.tone}>
                      Cumplimiento observado: {comp.label}
                    </Badge>
                    <Badge tone={sla.isActive ? 'info' : 'neutral'}>
                      {sla.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm">{sla.commitments}</p>
                <div className="grid grid-cols-1 gap-2 text-xs text-(--ws-muted) sm:grid-cols-2">
                  <p>
                    <strong>Responsabilidades:</strong> {sla.responsibilities}
                  </p>
                  <p>
                    <strong>Exclusiones:</strong> {sla.exclusions}
                  </p>
                </div>
                {sla.breachConsequences && (
                  <p className="text-xs text-(--ws-muted)">
                    <strong>Consecuencias definidas:</strong>{' '}
                    {sla.breachConsequences}
                  </p>
                )}
                {sla.slos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {sla.slos.map((s) => (
                      <Badge
                        key={s.id}
                        tone={complianceMeta(s.complianceStatus).tone}
                      >
                        {s.name}: {s.observedValue ?? 'n/d'} {s.unit}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="ws-btn min-h-8 px-3 py-1 text-xs"
                    onClick={() => openEdit(sla)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="ws-btn min-h-8 px-3 py-1 text-xs"
                    onClick={() => void handleToggle(sla)}
                  >
                    {sla.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

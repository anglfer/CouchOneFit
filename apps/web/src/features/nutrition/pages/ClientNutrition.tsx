import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Badge } from '../../../components/ui';
import { useOnSynced, useOperations } from '../../../hooks/useOperations';
import { confirmDialog } from '../../../services/confirm';
import type { ProfessionalRecord } from '../../professional/types/record';
import { latestBodyFat } from '../../evaluations/types/evaluation';
import Modal from '../../training/components/Modal';
import '../../training/training.css';
import '../nutrition.css';
import NutritionEditor from '../components/NutritionEditor';
import NutritionSuggestionAssistant from '../components/NutritionSuggestionAssistant';
import NutritionView from '../components/NutritionView';
import {
  activateNutritionVersionOffline,
  cloneNutritionDocument,
  emptyNutritionDocument,
  readNutritionVersions,
  saveNutritionDraftOffline,
} from '../services/nutrition';
import type {
  NutritionDocument,
  NutritionSuggestionResult,
  NutritionVersion,
} from '../types/nutrition';
import { suggestMealItems } from '../utils/mealFiller';
import { validateNutritionDocument } from '../utils/validation';

type Tab = 'summary' | 'plan' | 'history';

const tabs: [Tab, string, IconName][] = [
  ['summary', 'Vista general', 'home'],
  ['plan', 'Plan alimenticio', 'bowl'],
  ['history', 'Historial', 'chart'],
];

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function ClientNutrition({
  clientId,
  clientName,
  record,
  onActivated,
}: {
  clientId: string;
  clientName: string;
  record?: ProfessionalRecord | null;
  onActivated?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('summary');
  const [versions, setVersions] = useState<NutritionVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [activeRevision, setActiveRevision] = useState(0);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editorDoc, setEditorDoc] = useState<NutritionDocument | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingRevision, setEditingRevision] = useState<number>(1);
  const [dirty, setDirty] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [viewing, setViewing] = useState<NutritionVersion | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const provisionalIdsRef = useRef<{
    planId: string;
    versionId: string;
  } | null>(null);

  const base = `/api/clients/${encodeURIComponent(clientId)}/nutrition-plans`;
  const operations = useOperations();

  // Unsent drafts stay visible until the outbox finishes syncing.
  const mergedVersions = useMemo(() => {
    const list = [...versions];
    for (const op of operations.filter(
      (item) => item.readEndpoint === base && item.kind === 'nutrition.save'
    )) {
      const opVersionId = String(
        op.body.versionId ?? op.endpoint.match(/\/versions\/([^/]+)/)?.[1] ?? ''
      );
      const opPlanId = String(
        op.body.id ??
          op.endpoint.match(/nutrition-plans\/([^/]+)/)?.[1] ??
          op.entityKey ??
          ''
      );
      if (!opVersionId || !opPlanId) continue;
      const existingIndex = list.findIndex((v) => v.id === opVersionId);
      const doc = op.body as unknown as NutritionDocument;
      const localVersion: NutritionVersion = {
        ...doc,
        id: opVersionId,
        planId: opPlanId,
        clientId,
        number:
          existingIndex >= 0 ? list[existingIndex].number : list.length + 1,
        revision:
          typeof op.body.revision === 'number' ? op.body.revision + 1 : 1,
        published: false,
        createdAt: new Date(op.createdAt).toISOString(),
      };
      if (existingIndex >= 0) list[existingIndex] = localVersion;
      else list.unshift(localVersion);
    }
    return list;
  }, [versions, operations, base, clientId]);

  const hasPending = operations.some((op) => op.readEndpoint === base);

  // The API refuses to prescribe without a physical evaluation; mirror it here.
  const needsEvaluation = record?.sections.evaluations.status === 'empty';
  const canPrescribe = canWrite && !needsEvaluation;
  const active = mergedVersions.find((v) => v.id === activeVersionId) ?? null;
  const draft = mergedVersions.find((v) => !v.published) ?? null;
  const planId = mergedVersions[0]?.planId;

  const validation = useMemo(
    () => (editorDoc ? validateNutritionDocument(editorDoc) : null),
    [editorDoc]
  );

  const updateReason = useMemo(() => {
    if (!active || !record) return null;
    const latestEval =
      record.sections.evaluations.status === 'available'
        ? (record.sections.evaluations.evaluations[0] ?? null)
        : null;
    const currentWeight =
      latestEval?.weightKg ??
      latestEval?.assessment?.measurements.weightKg ??
      record.profile.baseWeightKg;
    const baselineWeight = active.suggestionMeta?.baselineWeightKg ?? null;
    if (
      currentWeight != null &&
      baselineWeight != null &&
      Math.abs(currentWeight - baselineWeight) >= 2.3
    ) {
      const diff = (currentWeight - baselineWeight).toFixed(1);
      return `El peso registrado cambió (${baselineWeight} kg → ${currentWeight} kg, ${Number(diff) > 0 ? '+' : ''}${diff} kg) desde el cálculo del plan activo.`;
    }
    const currentFat = latestBodyFat(record.sections.evaluations)?.value;
    const baselineFat = active.suggestionMeta?.baselineBodyFatPct ?? null;
    if (
      currentFat != null &&
      baselineFat != null &&
      Math.abs(currentFat - baselineFat) >= 2
    ) {
      return `La grasa corporal cambió (${baselineFat} % → ${currentFat.toFixed(1)} %) desde el cálculo del plan activo.`;
    }
    if (
      latestEval &&
      latestEval.evaluationDate > active.createdAt.slice(0, 10)
    ) {
      // Registration dates compare in UTC; show the measurement day.
      const when = new Date(
        `${latestEval.assessment?.effectiveDate ?? latestEval.evaluationDate}T12:00:00`
      ).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      return `Hay una evaluación física más reciente (${when}) que la versión activa actual.`;
    }
    return null;
  }, [active, record]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readNutritionVersions(clientId);
      setVersions(data.versions);
      setActiveVersionId(data.activeVersionId);
      setActiveRevision(data.activeRevision);
      setCanWrite(data.canWrite);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar la nutrición.'
      );
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useOnSynced(() => {
    void load();
  });

  useEffect(() => {
    let activeRequest = true;
    readNutritionVersions(clientId)
      .then((data) => {
        if (!activeRequest) return;
        setVersions(data.versions);
        setActiveVersionId(data.activeVersionId);
        setActiveRevision(data.activeRevision);
        setCanWrite(data.canWrite);
        setError(null);
      })
      .catch((err) => {
        if (!activeRequest) return;
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar la nutrición.'
        );
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });
    return () => {
      activeRequest = false;
    };
  }, [clientId]);

  const startFrom = (
    source?: NutritionDocument,
    openAssistantAfter = false
  ) => {
    setNotice(null);
    setError(null);
    setShowValidation(false);
    setEditingVersionId(null);
    setEditingRevision(1);
    provisionalIdsRef.current = {
      planId: planId ?? crypto.randomUUID(),
      versionId: crypto.randomUUID(),
    };
    setEditorDoc(
      source ? cloneNutritionDocument(source) : emptyNutritionDocument()
    );
    setDirty(true);
    setTab('plan');
    if (openAssistantAfter) {
      setAssistantOpen(true);
    }
  };

  const openDraft = (target: NutritionVersion, openAssistantAfter = false) => {
    setNotice(null);
    setError(null);
    setShowValidation(false);
    setEditingVersionId(target.id);
    setEditingRevision(target.revision);
    provisionalIdsRef.current = { planId: target.planId, versionId: target.id };
    setEditorDoc(cloneNutritionDocument(target));
    setDirty(false);
    setTab('plan');
    if (openAssistantAfter) {
      setAssistantOpen(true);
    }
  };

  const handleCloseEditor = async () => {
    if (dirty) {
      const confirmed = await confirmDialog({
        title: '¿Cerrar el editor sin guardar?',
        message:
          'Tienes cambios sin guardar en este plan alimenticio. Si cierras ahora se descartarán.',
        confirmLabel: 'Cerrar sin guardar',
        cancelLabel: 'Seguir editando',
        danger: true,
      });
      if (!confirmed) return;
    }
    setEditorDoc(null);
    setDirty(false);
    setShowValidation(false);
    setTab('summary');
  };

  const applySuggestion = (
    suggestion: NutritionSuggestionResult,
    includeMeals: boolean
  ) => {
    setEditorDoc((current) => {
      const base = current ?? emptyNutritionDocument();
      const nextMeals = includeMeals
        ? suggestion.suggestedMeals.map((m) => ({
            id: crypto.randomUUID(),
            name: m.name,
            category: m.category,
            scheduleTime: m.scheduleTime,
            targetCalories: m.targetCalories,
            targetProteinG: m.targetProteinG,
            targetCarbsG: m.targetCarbsG,
            targetFatG: m.targetFatG,
            instructions: m.instructions,
            items: suggestMealItems(m, suggestion.meta.restrictions) ?? [],
          }))
        : base.meals;

      return {
        ...base,
        caloriesTarget: suggestion.trainingDayTargets.caloriesTarget,
        proteinTargetG: suggestion.trainingDayTargets.proteinTargetG,
        carbsTargetG: suggestion.trainingDayTargets.carbsTargetG,
        fatTargetG: suggestion.trainingDayTargets.fatTargetG,
        fiberTargetG: suggestion.fiberTargetG,
        hydrationTargetMl: suggestion.hydrationTargetMl,
        restDayTargets: suggestion.restDayTargets,
        periWorkout: suggestion.periWorkout,
        generalInstructions: base.generalInstructions?.trim()
          ? base.generalInstructions
          : suggestion.generalGuidanceSummary,
        suggestionMeta: suggestion.meta,
        meals: nextMeals,
      };
    });
    setDirty(true);
    setShowValidation(false);
    setNotice(
      includeMeals
        ? 'Plan propuesto con alimentos y porciones. Revisa y ajusta lo que necesites antes de guardar o activar.'
        : 'Metas aplicadas al borrador. Tus comidas actuales se conservaron.'
    );
  };

  const ensureValidOrFocus = (): boolean => {
    if (!validation || validation.valid) return true;
    setShowValidation(true);
    setError(
      `Revisa ${validation.count === 1 ? 'el campo marcado' : `los ${validation.count} campos marcados`} antes de continuar: ${validation.summary[0]}`
    );
    requestAnimationFrame(() => {
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]'
      );
      firstInvalid?.focus();
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return false;
  };

  async function saveDraftOnly(): Promise<NutritionVersion | null> {
    if (!editorDoc || !ensureValidOrFocus()) return null;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const ids = (provisionalIdsRef.current ??= {
        planId: planId ?? crypto.randomUUID(),
        versionId: crypto.randomUUID(),
      });
      const outcome = await saveNutritionDraftOffline({
        clientId,
        clientName,
        planId,
        provisionalPlanId: ids.planId,
        versionId: editingVersionId ?? undefined,
        provisionalVersionId: ids.versionId,
        revision: editingRevision,
        document: editorDoc,
        existingCount: mergedVersions.length,
      });
      const saved = outcome.version;
      setEditingVersionId(saved.id);
      setEditingRevision(saved.revision);
      setDirty(false);
      setShowValidation(false);
      if (outcome.queued) {
        setNotice('Guardado en este dispositivo · se enviará al reconectar.');
      } else {
        setNotice('Borrador nutricional guardado.');
        await load();
      }
      return saved;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el borrador.'
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveAndActivate() {
    if (!editorDoc || !ensureValidOrFocus()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let wasQueued = false;
      let saved: NutritionVersion | null = null;
      if (dirty || !editingVersionId) {
        const ids = (provisionalIdsRef.current ??= {
          planId: planId ?? crypto.randomUUID(),
          versionId: crypto.randomUUID(),
        });
        const saveOutcome = await saveNutritionDraftOffline({
          clientId,
          clientName,
          planId,
          provisionalPlanId: ids.planId,
          versionId: editingVersionId ?? undefined,
          provisionalVersionId: ids.versionId,
          revision: editingRevision,
          document: editorDoc,
          existingCount: mergedVersions.length,
        });
        saved = saveOutcome.version;
        wasQueued = saveOutcome.queued;
      } else {
        saved = mergedVersions.find((v) => v.id === editingVersionId) ?? null;
      }

      if (!saved) return;

      const activation = await activateNutritionVersionOffline({
        clientId,
        clientName,
        planId: saved.planId,
        versionId: saved.id,
        expectedActiveRevision: activeRevision,
        planName: saved.name,
      });
      setEditorDoc(null);
      setEditingVersionId(null);
      setDirty(false);
      setShowValidation(false);
      if (wasQueued || activation.queued) {
        setNotice(
          'Activación pendiente de enviar · el cliente conservará su plan anterior hasta que vuelva la conexión.'
        );
      } else {
        setNotice(
          'Plan alimenticio activado. El cliente ya puede consultarlo en su móvil.'
        );
        await load();
        onActivated?.();
      }
      setTab('summary');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo activar el plan alimenticio.'
      );
    } finally {
      setBusy(false);
    }
  }

  const hasExistingFoodItems = Boolean(
    editorDoc?.meals.some((m) => m.items.length > 0)
  );

  return (
    <div className="training-page">
      <div
        className="client-subtabs"
        role="tablist"
        aria-label="Secciones de nutrición"
      >
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            className="ws-plain"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            <Icon name={icon} size={16} /> {label}
            {key === 'plan' && editorDoc && (
              <span className="training-dot" aria-label="borrador abierto" />
            )}
          </button>
        ))}
      </div>

      {hasPending && (
        <p className="ws-alert" data-tone="warn" role="status">
          Este plan tiene cambios pendientes de enviar en este dispositivo.{' '}
          <Link to="/app/pendientes" className="font-semibold underline">
            Ver pendientes
          </Link>
        </p>
      )}
      {error && (
        <div className="ws-alert" data-tone="bad" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="ws-alert" data-tone="ok" role="status">
          {notice}
        </div>
      )}

      {loading && <p role="status">Consultando plan alimenticio…</p>}

      {tab === 'summary' && !loading && (
        <div className="training-summary-main">
          {draft && active && !editorDoc && (
            <div className="ws-alert" data-tone="warn">
              Tienes un borrador sin activar («{draft.name}»).{' '}
              <button type="button" onClick={() => openDraft(draft)}>
                Continuar editando
              </button>
            </div>
          )}

          {updateReason && active && !draft && !editorDoc && canPrescribe && (
            <div className="ws-alert" data-tone="info">
              <span>
                <strong>Actualización disponible:</strong> {updateReason}{' '}
              </span>
              <button type="button" onClick={() => startFrom(active, true)}>
                Recalcular en nueva versión
              </button>
            </div>
          )}

          {needsEvaluation && canWrite && (
            <section className="ws-card training-start">
              <Icon name="clipboard" size={32} />
              <h2>Primero registra una evaluación física</h2>
              <p>
                El plan se calcula con el peso, la estatura y la composición
                corporal más recientes de {clientName}. Sin evaluación no hay
                datos confiables para prescribir.
              </p>
              <Link
                to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion/nueva`}
                className="ws-btn"
                data-variant="primary"
              >
                Registrar evaluación física
              </Link>
            </section>
          )}

          {active ? (
            <section className="ws-card training-routine-card space-y-4">
              <div className="training-section-head">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone="ok">Plan alimenticio activo</Badge>
                    <span className="text-xs text-(--ws-muted)">
                      Versión {active.number}
                    </span>
                  </div>
                  <h2>{active.name}</h2>
                  <p className="training-chips">
                    <span>
                      {active.meals.length}{' '}
                      {active.meals.length === 1
                        ? 'tiempo de comida'
                        : 'tiempos de comida'}
                    </span>
                    {active.caloriesTarget !== null && (
                      <span>{active.caloriesTarget} kcal</span>
                    )}
                    {active.restDayTargets && <span>Carb cycling activo</span>}
                  </p>
                </div>
                <div className="training-actions">
                  {canPrescribe && (
                    <button
                      type="button"
                      className="ws-btn"
                      data-variant="primary"
                      onClick={() =>
                        draft ? openDraft(draft) : startFrom(active)
                      }
                    >
                      {draft ? 'Continuar borrador' : 'Crear nueva versión'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => setTab('plan')}
                  >
                    Ver plan completo
                  </button>
                </div>
              </div>
              <div className="ws-kpi-strip">
                <div className="ws-kpi-mini">
                  <span className="ws-stat-label">Calorías objetivo</span>
                  <strong className="ws-kpi-mini-value tabular-nums">
                    {active.caloriesTarget !== null
                      ? `${active.caloriesTarget} kcal`
                      : 'Sin definir'}
                  </strong>
                  {active.restDayTargets && (
                    <span className="text-xs text-(--ws-muted)">
                      Descanso: {active.restDayTargets.caloriesTarget} kcal
                    </span>
                  )}
                </div>
                <div className="ws-kpi-mini">
                  <span className="ws-stat-label">Macros (P / C / G)</span>
                  <strong className="ws-kpi-mini-value tabular-nums">
                    {active.proteinTargetG ?? '—'} /{' '}
                    {active.carbsTargetG ?? '—'} / {active.fatTargetG ?? '—'} g
                  </strong>
                </div>
                {(active.hydrationTargetMl != null ||
                  active.fiberTargetG != null) && (
                  <div className="ws-kpi-mini">
                    <span className="ws-stat-label">Hidratación y fibra</span>
                    <strong className="ws-kpi-mini-value tabular-nums">
                      {active.hydrationTargetMl != null
                        ? `${(active.hydrationTargetMl / 1000).toFixed(1)} L`
                        : '—'}{' '}
                      ·{' '}
                      {active.fiberTargetG != null
                        ? `${active.fiberTargetG} g`
                        : '—'}
                    </strong>
                  </div>
                )}
              </div>
              {active.meals.length > 0 && (
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                  {active.meals.map((meal, index) => (
                    <li
                      key={meal.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-(--ws-border-subtle) bg-(--ws-surface-2) px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <strong className="block truncate">
                          {index + 1}. {meal.name}
                        </strong>
                        {meal.scheduleTime && (
                          <span className="text-xs text-(--ws-muted)">
                            {meal.scheduleTime}
                          </span>
                        )}
                      </div>
                      <span className="ws-chip shrink-0">
                        {meal.items.length}{' '}
                        {meal.items.length === 1 ? 'alimento' : 'alimentos'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="training-muted">
                Activo desde {formatDay(active.createdAt)} · visible en el móvil
                del cliente.
              </p>
            </section>
          ) : draft ? (
            <section className="ws-card training-routine-card">
              <Badge tone="warn">Borrador</Badge>
              <h2>{draft.name}</h2>
              <p className="training-muted">
                El cliente todavía no lo ve en su aplicación móvil. Revísalo y
                actívalo cuando esté listo.
              </p>
              <div className="training-actions">
                {canPrescribe && (
                  <button
                    type="button"
                    className="ws-btn"
                    data-variant="primary"
                    onClick={() => openDraft(draft)}
                  >
                    Revisar y activar
                  </button>
                )}
              </div>
            </section>
          ) : needsEvaluation ? null : (
            <section className="ws-card training-start">
              <Icon name="bowl" size={32} />
              <h2>{clientName} aún no tiene plan alimenticio</h2>
              <p>
                El asistente calcula sus metas con la última evaluación y
                propone comidas con alimentos y porciones. Tú revisas y ajustas
                todo antes de activarlo.
              </p>
              {canPrescribe && (
                <div className="training-start-grid">
                  <button
                    type="button"
                    className="ws-plain"
                    onClick={() => startFrom(undefined, true)}
                  >
                    <Icon name="sparkle" size={22} />
                    <strong>Crear con asistente</strong>
                    <small>
                      Metas, comidas y alimentos propuestos a partir de su
                      expediente.
                    </small>
                  </button>
                  <button
                    type="button"
                    className="ws-plain"
                    onClick={() => startFrom()}
                  >
                    <Icon name="plus" size={22} />
                    <strong>Crear desde cero</strong>
                    <small>
                      Elige alimentos del catálogo o usa plantillas de comida.
                    </small>
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {tab === 'plan' &&
        !loading &&
        (editorDoc && validation ? (
          <form
            ref={formRef}
            noValidate
            className="training-editing"
            onSubmit={(e) => {
              e.preventDefault();
              void saveAndActivate();
            }}
          >
            <div className="training-savebar">
              <div className="training-savebar-status">
                <strong>
                  {active
                    ? 'Nueva versión nutricional'
                    : 'Nuevo plan alimenticio'}
                </strong>
                <small>
                  {busy
                    ? 'Guardando…'
                    : dirty
                      ? 'Cambios sin guardar · el cliente aún no los ve'
                      : 'Borrador guardado · el cliente aún no los ve'}
                  {editorDoc.caloriesTarget != null ||
                  editorDoc.proteinTargetG != null
                    ? ` · Meta: ${editorDoc.caloriesTarget ?? '—'} kcal (P ${editorDoc.proteinTargetG ?? '—'}g / C ${editorDoc.carbsTargetG ?? '—'}g / G ${editorDoc.fatTargetG ?? '—'}g)`
                    : ''}
                </small>
              </div>
              <div className="training-actions">
                <button
                  type="button"
                  className="ws-btn"
                  disabled={busy}
                  onClick={() => void handleCloseEditor()}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  disabled={busy || !dirty}
                  onClick={() => void saveDraftOnly()}
                >
                  Guardar borrador
                </button>
                <button
                  className="ws-btn"
                  data-variant="primary"
                  disabled={busy}
                >
                  {active ? 'Guardar y reemplazar activo' : 'Guardar y activar'}
                </button>
              </div>
            </div>

            <NutritionEditor
              value={editorDoc}
              errors={validation.errors}
              showAllErrors={showValidation}
              onOpenAssistant={
                canPrescribe ? () => setAssistantOpen(true) : undefined
              }
              onChange={(next) => {
                setEditorDoc(next);
                setDirty(true);
              }}
              disabled={busy}
            />
          </form>
        ) : active ? (
          <section className="ws-card">
            <div className="training-section-head">
              <div>
                <Badge tone="ok">Vista previa en la app del cliente</Badge>
                <h2 className="mt-1">{active.name}</h2>
              </div>
              {canWrite && (
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => (draft ? openDraft(draft) : startFrom(active))}
                >
                  {draft ? 'Continuar borrador' : 'Editar plan'}
                </button>
              )}
            </div>
            <NutritionView plan={active} />
          </section>
        ) : (
          <section className="ws-card training-start">
            <Icon name="bowl" size={32} />
            <h2>Sin plan alimenticio activo</h2>
            {canPrescribe && (
              <div className="training-actions">
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() =>
                    draft ? openDraft(draft, true) : startFrom(undefined, true)
                  }
                >
                  <Icon name="sliders" size={16} /> Calcular con asistente
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => (draft ? openDraft(draft) : startFrom())}
                >
                  {draft ? 'Continuar borrador' : 'Crear manualmente'}
                </button>
              </div>
            )}
          </section>
        ))}

      {tab === 'history' && (
        <section className="ws-card">
          <div className="training-section-head">
            <div>
              <h2>Historial de planes alimenticios · {clientName}</h2>
              <p>
                Cada activación conserva la versión anterior sin sobrescribir el
                historial del cliente.
              </p>
            </div>
          </div>
          {mergedVersions.length === 0 && (
            <p className="ws-empty">Todavía no hay planes alimenticios.</p>
          )}
          <ol className="training-history">
            {mergedVersions.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>{v.name}</strong>
                  <small>
                    Versión {v.number} · {formatDay(v.createdAt)} ·{' '}
                    {v.meals.length} comidas
                    {v.caloriesTarget != null
                      ? ` · ${v.caloriesTarget} kcal`
                      : ''}
                    {v.proteinTargetG != null
                      ? ` · P ${v.proteinTargetG}g`
                      : ''}
                  </small>
                </div>
                <Badge
                  tone={
                    v.id === active?.id
                      ? 'ok'
                      : v.published
                        ? 'neutral'
                        : 'warn'
                  }
                >
                  {v.id === active?.id
                    ? 'Activo'
                    : v.published
                      ? 'Anterior'
                      : 'Borrador'}
                </Badge>
                <div className="training-actions">
                  <button
                    type="button"
                    className="ws-btn"
                    onClick={() => setViewing(v)}
                  >
                    Ver
                  </button>
                  {canWrite && v.published && v.id !== active?.id && !draft && (
                    <button
                      type="button"
                      className="ws-btn"
                      onClick={() => startFrom(v)}
                    >
                      Usar como base
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {viewing && (
        <Modal wide title={viewing.name} onClose={() => setViewing(null)}>
          <NutritionView plan={viewing} />
        </Modal>
      )}

      {assistantOpen && (
        <NutritionSuggestionAssistant
          clientId={clientId}
          clientName={clientName}
          record={record}
          hasExistingFoodItems={hasExistingFoodItems}
          onApply={applySuggestion}
          onClose={() => setAssistantOpen(false)}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Badge } from '../../../components/ui';
import { confirmDialog } from '../../../services/confirm';
import type { ProfessionalRecord } from '../../professional/types/record';
import Modal from '../../training/components/Modal';
import '../../training/training.css';
import '../nutrition.css';
import NutritionEditor from '../components/NutritionEditor';
import NutritionSuggestionAssistant from '../components/NutritionSuggestionAssistant';
import NutritionView from '../components/NutritionView';
import {
  activateNutritionVersion,
  cloneNutritionDocument,
  createNutritionDraft,
  emptyNutritionDocument,
  readNutritionVersions,
  updateNutritionDraft,
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

  // The API refuses to prescribe without a physical evaluation; mirror it here.
  const needsEvaluation = record?.sections.evaluations.status === 'empty';
  const canPrescribe = canWrite && !needsEvaluation;
  const active = versions.find((v) => v.id === activeVersionId) ?? null;
  const draft = versions.find((v) => !v.published) ?? null;
  const planId = versions[0]?.planId;

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
    if (
      latestEval &&
      latestEval.evaluationDate > active.createdAt.slice(0, 10)
    ) {
      return `Hay una evaluación física más reciente (${latestEval.evaluationDate}) que la versión activa actual.`;
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
      const saved =
        editingVersionId && planId
          ? await updateNutritionDraft(
              clientId,
              planId,
              editingVersionId,
              editingRevision,
              editorDoc
            )
          : await createNutritionDraft(clientId, planId, editorDoc);
      setEditingVersionId(saved.id);
      setEditingRevision(saved.revision);
      setDirty(false);
      setShowValidation(false);
      setNotice('Borrador nutricional guardado.');
      await load();
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
      const saved =
        dirty || !editingVersionId
          ? editingVersionId && planId
            ? await updateNutritionDraft(
                clientId,
                planId,
                editingVersionId,
                editingRevision,
                editorDoc
              )
            : await createNutritionDraft(clientId, planId, editorDoc)
          : (versions.find((v) => v.id === editingVersionId) ?? null);

      if (!saved) return;

      await activateNutritionVersion(
        clientId,
        saved.planId,
        saved.id,
        activeRevision
      );
      setEditorDoc(null);
      setEditingVersionId(null);
      setDirty(false);
      setShowValidation(false);
      setNotice(
        'Plan alimenticio activado. El cliente ya puede consultarlo en su móvil.'
      );
      await load();
      onActivated?.();
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
                to={`/app/clientes/${clientId}/evaluacion`}
                className="ws-btn"
                data-variant="primary"
              >
                Ir a Evaluación
              </Link>
            </section>
          )}

          {active ? (
            <section className="ws-card training-routine-card">
              <div className="training-section-head">
                <div>
                  <span className="ws-eyebrow">PLAN ALIMENTICIO ACTIVO</span>
                  <h2>{active.name}</h2>
                  <p className="training-chips">
                    <span>Versión {active.number}</span>
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
                    Ver detalle
                  </button>
                </div>
              </div>
              <NutritionView plan={active} />
              <p className="training-muted">
                Activo desde {formatDay(active.createdAt)} · visible en el móvil
                del cliente.
              </p>
            </section>
          ) : draft ? (
            <section className="ws-card training-routine-card">
              <span className="ws-eyebrow">BORRADOR</span>
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
                <span className="ws-eyebrow">LO QUE VE EL CLIENTE</span>
                <h2>{active.name}</h2>
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
              <span className="ws-eyebrow">HISTORIAL</span>
              <h2>Planes alimenticios de {clientName}</h2>
              <p>
                Cada activación conserva la versión anterior sin sobrescribir el
                historial del cliente.
              </p>
            </div>
          </div>
          {versions.length === 0 && (
            <p className="ws-empty">Todavía no hay planes alimenticios.</p>
          )}
          <ol className="training-history">
            {versions.map((v) => (
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

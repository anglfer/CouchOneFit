import { useCallback, useEffect, useState } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { Badge } from '../../../components/ui';
import Modal from '../../training/components/Modal';
import NutritionEditor from '../components/NutritionEditor';
import NutritionView from '../components/NutritionView';
import {
  activateNutritionVersion,
  cloneNutritionDocument,
  createNutritionDraft,
  emptyNutritionDocument,
  readNutritionVersions,
  updateNutritionDraft,
} from '../services/nutrition';
import type { NutritionDocument, NutritionVersion } from '../types/nutrition';

type Tab = 'summary' | 'plan' | 'history';

const tabs: [Tab, string, IconName][] = [
  ['summary', 'Vista general', 'home'],
  ['plan', 'Plan alimenticio', 'layers'],
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
  onActivated,
}: {
  clientId: string;
  clientName: string;
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
  const [viewing, setViewing] = useState<NutritionVersion | null>(null);

  const active = versions.find((v) => v.id === activeVersionId) ?? null;
  const draft = versions.find((v) => !v.published) ?? null;
  const planId = versions[0]?.planId;

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
      setError(err instanceof Error ? err.message : 'No se pudo cargar la nutrición.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startFrom = (source?: NutritionDocument) => {
    setNotice(null);
    setError(null);
    setEditingVersionId(null);
    setEditingRevision(1);
    setEditorDoc(source ? cloneNutritionDocument(source) : emptyNutritionDocument());
    setDirty(true);
    setTab('plan');
  };

  const openDraft = (target: NutritionVersion) => {
    setNotice(null);
    setError(null);
    setEditingVersionId(target.id);
    setEditingRevision(target.revision);
    setEditorDoc(cloneNutritionDocument(target));
    setDirty(false);
    setTab('plan');
  };

  async function saveDraftOnly(): Promise<NutritionVersion | null> {
    if (!editorDoc) return null;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved =
        editingVersionId && planId
          ? await updateNutritionDraft(clientId, planId, editingVersionId, editingRevision, editorDoc)
          : await createNutritionDraft(clientId, planId, editorDoc);
      setEditingVersionId(saved.id);
      setEditingRevision(saved.revision);
      setDirty(false);
      setNotice('Borrador nutricional guardado.');
      await load();
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el borrador.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveAndActivate() {
    if (!editorDoc) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved =
        dirty || !editingVersionId
          ? editingVersionId && planId
            ? await updateNutritionDraft(clientId, planId, editingVersionId, editingRevision, editorDoc)
            : await createNutritionDraft(clientId, planId, editorDoc)
          : versions.find((v) => v.id === editingVersionId) ?? null;

      if (!saved) return;

      await activateNutritionVersion(clientId, saved.planId, saved.id, activeRevision);
      setEditorDoc(null);
      setEditingVersionId(null);
      setDirty(false);
      setNotice('Plan alimenticio activado. El cliente ya puede consultarlo en su móvil.');
      await load();
      onActivated?.();
      setTab('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el plan alimenticio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="client-subtabs" role="tablist" aria-label="Secciones de nutrición">
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
        <div className="ws-alert" data-tone="error" role="alert">
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
        <div className="space-y-4">
          {draft && active && !editorDoc && (
            <div className="ws-alert" data-tone="warn">
              Tienes un borrador sin activar («{draft.name}»).{' '}
              <button type="button" onClick={() => openDraft(draft)}>
                Continuar editando
              </button>
            </div>
          )}

          {active ? (
            <section className="ws-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="ws-eyebrow">PLAN ALIMENTICIO ACTIVO</span>
                  <h2>{active.name}</h2>
                  <p className="training-muted">
                    Versión {active.number} · Activo desde {formatDay(active.createdAt)} · visible en el móvil del cliente.
                  </p>
                </div>
                <div className="training-actions">
                  {canWrite && (
                    <button
                      type="button"
                      className="ws-btn"
                      data-variant="primary"
                      onClick={() => (draft ? openDraft(draft) : startFrom(active))}
                    >
                      {draft ? 'Continuar borrador' : 'Crear nueva versión'}
                    </button>
                  )}
                  <button type="button" className="ws-btn" onClick={() => setTab('plan')}>
                    Ver detalle
                  </button>
                </div>
              </div>
              <NutritionView plan={active} />
            </section>
          ) : draft ? (
            <section className="ws-card space-y-3">
              <span className="ws-eyebrow">BORRADOR</span>
              <h2>{draft.name}</h2>
              <p className="training-muted">
                El cliente todavía no lo ve en su aplicación móvil. Revísalo y actívalo cuando esté listo.
              </p>
              <div className="training-actions">
                {canWrite && (
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
          ) : (
            <section className="ws-card training-start">
              <Icon name="layers" size={32} />
              <h2>{clientName} aún no tiene plan alimenticio</h2>
              <p>Prescribe sus tiempos de comida, cantidades e indicaciones de forma manual.</p>
              {canWrite && (
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => startFrom()}
                >
                  <Icon name="plus" size={16} /> Crear plan alimenticio
                </button>
              )}
            </section>
          )}
        </div>
      )}

      {tab === 'plan' &&
        !loading &&
        (editorDoc ? (
          <form
            className="training-editing"
            onSubmit={(e) => {
              e.preventDefault();
              void saveAndActivate();
            }}
          >
            <div className="training-savebar">
              <div className="training-savebar-status">
                <strong>{active ? 'Nueva versión nutricional' : 'Nuevo plan alimenticio'}</strong>
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
                  onClick={() => {
                    setEditorDoc(null);
                    setTab('summary');
                  }}
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
                <button className="ws-btn" data-variant="primary" disabled={busy}>
                  {active ? 'Guardar y reemplazar activo' : 'Guardar y activar'}
                </button>
              </div>
            </div>

            <NutritionEditor
              value={editorDoc}
              onChange={(next) => {
                setEditorDoc(next);
                setDirty(true);
              }}
              disabled={busy}
            />
          </form>
        ) : active ? (
          <section className="ws-card space-y-4">
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
            <Icon name="layers" size={32} />
            <h2>Sin plan alimenticio activo</h2>
            {canWrite && (
              <button
                type="button"
                className="ws-btn"
                data-variant="primary"
                onClick={() => (draft ? openDraft(draft) : startFrom())}
              >
                {draft ? 'Continuar borrador' : 'Crear plan alimenticio'}
              </button>
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
                Cada activación conserva la versión anterior sin sobrescribir el historial del cliente.
              </p>
            </div>
          </div>
          {versions.length === 0 && <p className="ws-empty">Todavía no hay planes alimenticios.</p>}
          <ol className="training-history">
            {versions.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>{v.name}</strong>
                  <small>
                    Versión {v.number} · {formatDay(v.createdAt)} · {v.meals.length} comidas
                  </small>
                </div>
                <Badge tone={v.id === active?.id ? 'ok' : v.published ? 'neutral' : 'warn'}>
                  {v.id === active?.id ? 'Activo' : v.published ? 'Anterior' : 'Borrador'}
                </Badge>
                <div className="training-actions">
                  <button type="button" className="ws-btn" onClick={() => setViewing(v)}>
                    Ver
                  </button>
                  {canWrite && v.published && v.id !== active?.id && !draft && (
                    <button type="button" className="ws-btn" onClick={() => startFrom(v)}>
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
    </>
  );
}
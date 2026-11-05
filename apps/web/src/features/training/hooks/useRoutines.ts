import { useEffect, useRef, useState } from 'react';
import { guardNavigation } from '../../../utils/navigation';
import { confirmDialog } from '../../../services/confirm';
import { useOperations } from '../../../hooks/useOperations';
import { onSynced } from '../../../services/offline/sync';
import {
  clonePrescription,
  documentOf,
  emptyPrescription,
  isVersion,
  object,
  readVersions,
  trainingWrite,
  type VersionsResponse,
} from '../services/training';
import type { Prescription, TrainingVersion } from '../types/training';

export interface Editor {
  planId: string;
  id: string;
  revision: number;
  published: boolean;
  newPlan: boolean;
  newVersion: boolean;
  document: Prescription;
}
const fromVersion = (v: TrainingVersion): Editor => ({
  planId: v.planId,
  id: v.id,
  revision: v.revision,
  published: v.published,
  newPlan: false,
  newVersion: false,
  document: documentOf(v),
});
const message = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;
const confirmDiscard = () =>
  confirmDialog({
    title: '¿Descartar los cambios sin guardar?',
    message: 'Si sales ahora, se perderán los cambios de esta rutina.',
    confirmLabel: 'Descartar cambios',
    cancelLabel: 'Seguir editando',
    danger: true,
  });

/**
 * Routines of one client (or the professional's templates when clientId is
 * absent): server reads merged with unsent offline drafts, plus the editor.
 */
export function useRoutines(clientId?: string) {
  const base = clientId
    ? `/api/clients/${encodeURIComponent(clientId)}/training-plans`
    : '/api/training/templates';
  const [data, setData] = useState<VersionsResponse | null>(null),
    [editor, setEditor] = useState<Editor | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0),
    [dirty, setDirty] = useState(false),
    // Only typed changes deserve a "discard?" question; a fresh copy does not.
    [edited, setEdited] = useState(false);
  const operations = useOperations(),
    epoch = useRef(0);
  const reload = () => setAttempt((n) => n + 1);

  useEffect(() => {
    const current = ++epoch.current;
    void readVersions(base)
      .then((result) => {
        if (current !== epoch.current) return;
        setData(result);
        setError('');
      })
      .catch((e) => {
        if (current === epoch.current)
          setError(message(e, 'No pudimos consultar las rutinas.'));
      })
      .finally(() => {
        if (current === epoch.current) setLoading(false);
      });
    return () => {
      epoch.current = current + 1;
    };
  }, [base, attempt]);
  useEffect(() => onSynced(reload), []);
  useEffect(() => {
    if (
      dirty ||
      !editor ||
      !data ||
      operations.some((op) => op.entityKey === editor.planId)
    )
      return;
    const current = data.versions.find((v) => v.id === editor.id);
    if (current && current.revision > editor.revision)
      // A confirmed server revision replaces only a clean, older editor.
      // eslint-disable-next-line react/set-state-in-effect
      setEditor(fromVersion(current));
  }, [data, operations, dirty, editor]);
  useEffect(() => {
    if (!edited) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const release = guardNavigation(confirmDiscard);
    window.addEventListener('beforeunload', warn);
    return () => {
      release();
      window.removeEventListener('beforeunload', warn);
    };
  }, [edited]);

  const canLeave = async () => !edited || confirmDiscard();

  // Unsent drafts stay visible as local routines until the outbox syncs.
  const routines = [...(data?.versions ?? [])];
  for (const op of operations.filter(
    (op) => op.readEndpoint === base && object(op.body.prescription)
  )) {
    const id = String(
      op.body.versionId ?? op.endpoint.match(/\/versions\/([^/]+)/)?.[1] ?? ''
    );
    const existing = routines.findIndex((v) => v.id === id);
    const local: TrainingVersion = {
      ...(op.body.prescription as unknown as Prescription),
      id,
      planId: String(
        op.body.id ??
          op.endpoint
            .match(/training-plans\/([^/]+)|templates\/([^/]+)/)
            ?.slice(1)
            .find(Boolean) ??
          ''
      ),
      clientId: clientId ?? null,
      number: existing >= 0 ? routines[existing].number : 1,
      revision: typeof op.body.revision === 'number' ? op.body.revision + 1 : 1,
      published: false,
      createdAt: new Date(op.createdAt).toISOString(),
    };
    if (existing >= 0) routines[existing] = local;
    else routines.unshift(local);
  }
  const active = routines.find((v) => v.id === data?.activeVersionId) ?? null;
  const draft = clientId ? (routines.find((v) => !v.published) ?? null) : null;
  const pending = (planId: string) =>
    operations.some((op) => op.entityKey === planId);

  async function open(v: TrainingVersion) {
    if (!(await canLeave())) return false;
    setEditor(fromVersion(v));
    setDirty(false);
    setEdited(false);
    setNotice('');
    return true;
  }
  /** `force` skips the question when the caller just saved (its `dirty` is stale). */
  async function close(force = false) {
    if (!force && !(await canLeave())) return false;
    setEditor(null);
    setDirty(false);
    setEdited(false);
    return true;
  }
  /** Starts (or reuses) the editable draft; published routines are never edited in place. */
  async function newDraft(source?: Prescription) {
    if (!(await canLeave())) return false;
    setNotice('');
    setEdited(false);
    if (draft) {
      setEditor({
        ...fromVersion(draft),
        document: source ? clonePrescription(source) : documentOf(draft),
      });
      setDirty(!!source);
      return true;
    }
    const previous = clientId ? routines[0] : undefined;
    setEditor({
      planId: previous?.planId ?? crypto.randomUUID(),
      id: crypto.randomUUID(),
      revision: 0,
      published: false,
      newPlan: !previous,
      newVersion: true,
      document: source ? clonePrescription(source) : emptyPrescription(),
    });
    setDirty(true);
    return true;
  }
  function change(document: Prescription) {
    if (!editor) return;
    setEditor({ ...editor, document });
    setDirty(true);
    setEdited(true);
  }
  /** Returns the saved editor state so callers can chain activation. */
  async function save(): Promise<Editor | null> {
    if (!editor) return null;
    setBusy(true);
    setError('');
    let saved: Editor;
    try {
      const endpoint = editor.newPlan
        ? base
        : editor.newVersion
          ? `${base}/${editor.planId}/versions`
          : `${base}/${editor.planId}/versions/${editor.id}`;
      const outcome = await trainingWrite({
        kind: 'training.save',
        endpoint,
        method: editor.newVersion ? 'POST' : 'PATCH',
        body: editor.newVersion
          ? {
              id: editor.planId,
              versionId: editor.id,
              prescription: editor.document,
            }
          : { revision: editor.revision, prescription: editor.document },
        label: `Guardar rutina: ${editor.document.name}`,
        clientId: clientId ?? null,
        clientName: data?.clientName ?? null,
        entityKey: editor.planId,
        readEndpoint: base,
      });
      if (outcome.queued) {
        const queued = operations.find(
          (op) =>
            op.entityKey === editor.planId &&
            op.attempts === 0 &&
            object(op.body.prescription)
        );
        const revision = queued
          ? typeof queued.body.revision === 'number'
            ? queued.body.revision + 1
            : 1
          : editor.newVersion
            ? 1
            : editor.revision + 1;
        saved = { ...editor, newPlan: false, newVersion: false, revision };
        setNotice('Guardado en este dispositivo · se enviará al reconectar.');
      } else {
        if (!object(outcome.result) || !isVersion(outcome.result.version))
          throw new Error('No pudimos confirmar el guardado.');
        saved = fromVersion(outcome.result.version);
        reload();
        setNotice(
          clientId
            ? 'Borrador guardado. El cliente lo verá cuando lo actives.'
            : 'Plantilla guardada.'
        );
      }
      setEditor(saved);
      setDirty(false);
      setEdited(false);
      return saved;
    } catch (e) {
      setError(message(e, 'No pudimos guardar. Tus cambios siguen aquí.'));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function activate(target = editor) {
    if (!target || !clientId || !data) return false;
    setBusy(true);
    setError('');
    try {
      const outcome = await trainingWrite({
        kind: 'training.activate',
        endpoint: `${base}/${target.planId}/versions/${target.id}/activate`,
        method: 'POST',
        body: {
          revision: target.revision,
          activeRevision: data.activeRevision,
        },
        label: `Activar rutina: ${target.document.name}`,
        clientId,
        clientName: data.clientName,
        entityKey: target.planId,
        readEndpoint: base,
      });
      setNotice(
        outcome.queued
          ? 'Activación pendiente de enviar. El cliente conserva su rutina anterior.'
          : '¡Rutina activada! Ya aparece en el móvil del cliente.'
      );
      if (!outcome.queued) {
        if (object(outcome.result) && isVersion(outcome.result.version))
          setEditor(fromVersion(outcome.result.version));
        reload();
      }
      return true;
    } catch (e) {
      setError(message(e, 'No pudimos activar la rutina.'));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveZone(timeZone: string) {
    if (!clientId || !data) return;
    setBusy(true);
    setError('');
    try {
      const outcome = await trainingWrite({
        kind: 'training.zone',
        method: 'PATCH',
        endpoint: `/api/clients/${clientId}/training-time-zone`,
        body: { timeZone, revision: data.clientRevision },
        label: 'Cambiar zona horaria',
        clientId,
        clientName: data.clientName,
        entityKey: `zone:${clientId}`,
        readEndpoint: base,
      });
      setNotice(
        outcome.queued
          ? 'Zona horaria pendiente de enviar.'
          : 'Zona horaria actualizada para registros futuros.'
      );
      if (!outcome.queued) reload();
    } catch (e) {
      setError(message(e, 'No pudimos cambiar la zona horaria.'));
    } finally {
      setBusy(false);
    }
  }
  return {
    base,
    data,
    loading,
    error,
    setError,
    notice,
    setNotice,
    busy,
    attempt,
    reload,
    routines,
    active,
    draft,
    pending,
    editor,
    dirty,
    canLeave,
    open,
    close,
    newDraft,
    change,
    save,
    activate,
    saveZone,
  };
}
export type Routines = ReturnType<typeof useRoutines>;

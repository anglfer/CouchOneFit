import { useEffect, useRef, useState } from 'react';
import { guardNavigation } from '../../../utils/navigation';
import { Link } from '../../../components/Link';
import { PageHeader } from '../../../components/ui';
import { useOperations } from '../../../hooks/useOperations';
import { onSynced } from '../../../services/offline/sync';
import { sessionRequest } from '../../auth/services/session';
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
import PrescriptionEditor from '../components/PrescriptionEditor';
import SessionLog from '../components/SessionLog';
import '../training.css';

interface Editor {
  planId: string;
  id: string;
  revision: number;
  number: number;
  published: boolean;
  newPlan: boolean;
  newVersion: boolean;
  document: Prescription;
}
const fromVersion = (v: TrainingVersion): Editor => ({
  planId: v.planId,
  id: v.id,
  revision: v.revision,
  number: v.number,
  published: v.published,
  newPlan: false,
  newVersion: false,
  document: documentOf(v),
});
export default function TrainingPage({
  clientId,
  accountId,
}: {
  clientId?: string;
  accountId: string;
}) {
  const base = clientId
    ? `/api/clients/${encodeURIComponent(clientId)}/training-plans`
    : '/api/training/templates';
  const [data, setData] = useState<VersionsResponse | null>(null),
    [templates, setTemplates] = useState<TrainingVersion[]>([]),
    [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0),
    [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState(''),
    [clients, setClients] = useState<{ id: string; fullName: string }[]>([]),
    [target, setTarget] = useState(''),
    [timeZone, setTimeZone] = useState('');
  const operations = useOperations(),
    epoch = useRef(0);
  useEffect(() => {
    const current = ++epoch.current;
    void readVersions(base)
      .then((result) => {
        if (current === epoch.current) {
          setData(result);
          setTimeZone(result.timeZone ?? '');
          setError('');
        }
      })
      .catch((e) => {
        if (current === epoch.current)
          setError(
            e instanceof Error ? e.message : 'No pudimos consultar las rutinas.'
          );
      })
      .finally(() => {
        if (current === epoch.current) setLoading(false);
      });
    return () => {
      epoch.current = current + 1;
    };
  }, [base, accountId, attempt]);
  useEffect(() => onSynced(() => setAttempt((n) => n + 1)), []);
  useEffect(() => {
    if (
      !dirty &&
      editor &&
      data &&
      !operations.some((op) => op.entityKey === editor.planId)
    ) {
      const current = data.versions.find((v) => v.id === editor.id);
      if (current && current.revision > editor.revision)
        // A confirmed server revision replaces only a clean, older editor.
        // eslint-disable-next-line react/set-state-in-effect
        setEditor(fromVersion(current));
    }
  }, [data, operations, dirty, editor]);
  useEffect(() => {
    let live = true;
    if (clientId)
      void readVersions('/api/training/templates')
        .then((r) => {
          if (live) setTemplates(r.versions);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [clientId]);
  useEffect(() => {
    if (clientId) return;
    let live = true;
    const timer = setTimeout(() => {
      void sessionRequest<unknown>(
        `/api/clients?search=${encodeURIComponent(search)}&status=active&pageSize=20`
      )
        .then((r) => {
          if (live && object(r) && Array.isArray(r.clients))
            setClients(
              r.clients.filter(
                (c): c is { id: string; fullName: string } =>
                  object(c) &&
                  typeof c.id === 'string' &&
                  typeof c.fullName === 'string'
              )
            );
        })
        .catch(() => {
          if (live) setClients([]);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search, clientId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const release = guardNavigation(() =>
      window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')
    );
    window.addEventListener('beforeunload', warn);
    return () => {
      release();
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty]);
  const canLeave = () =>
    !dirty || window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?');
  const localVersions = [...(data?.versions ?? [])];
  for (const op of operations.filter(
    (op) => op.readEndpoint === base && object(op.body.prescription)
  )) {
    const id = String(
      op.body.versionId ?? op.endpoint.match(/\/versions\/([^/]+)/)?.[1] ?? ''
    );
    const document = op.body.prescription as unknown as Prescription;
    const existing = localVersions.findIndex((v) => v.id === id);
    const planId = String(
      op.body.id ??
        op.endpoint
          .match(/training-plans\/([^/]+)|templates\/([^/]+)/)
          ?.slice(1)
          .find(Boolean) ??
        ''
    );
    const local: TrainingVersion = {
      ...document,
      id,
      planId,
      clientId: clientId ?? null,
      number: existing >= 0 ? localVersions[existing].number : 1,
      revision: typeof op.body.revision === 'number' ? op.body.revision + 1 : 1,
      published: false,
      createdAt: new Date(op.createdAt).toISOString(),
    };
    if (existing >= 0) localVersions[existing] = local;
    else localVersions.unshift(local);
  }
  function newDraft(source?: Prescription) {
    if (!canLeave()) return;
    const existing = clientId
      ? localVersions.find((v) => !v.published)
      : undefined;
    if (existing) {
      setEditor({
        ...fromVersion(existing),
        document: source ? clonePrescription(source) : documentOf(existing),
      });
      setDirty(!!source);
      return;
    }
    const previous = clientId ? localVersions[0] : undefined;
    setEditor({
      planId: previous?.planId ?? crypto.randomUUID(),
      id: crypto.randomUUID(),
      revision: 0,
      number: (previous?.number ?? 0) + 1,
      published: false,
      newPlan: !previous,
      newVersion: true,
      document: source ? clonePrescription(source) : emptyPrescription(),
    });
    setDirty(true);
    setMessage('');
  }
  async function save() {
    if (!editor) return;
    setBusy(true);
    setError('');
    try {
      const endpoint = editor.newPlan
        ? base
        : editor.newVersion
          ? `${base}/${editor.planId}/versions`
          : `${base}/${editor.planId}/versions/${editor.id}`;
      const body = editor.newVersion
        ? {
            id: editor.planId,
            versionId: editor.id,
            prescription: editor.document,
          }
        : { revision: editor.revision, prescription: editor.document };
      const outcome = await trainingWrite({
        kind: 'training.save',
        endpoint,
        method: editor.newVersion ? 'POST' : 'PATCH',
        body,
        label: `Guardar rutina: ${editor.document.name}`,
        clientId: clientId ?? null,
        clientName: null,
        entityKey: editor.planId,
        readEndpoint: base,
      });
      if (outcome.queued) {
        const pending = operations.find(
          (op) =>
            op.entityKey === editor.planId &&
            op.attempts === 0 &&
            object(op.body.prescription)
        );
        const revision = pending
          ? typeof pending.body.revision === 'number'
            ? pending.body.revision + 1
            : 1
          : editor.newVersion
            ? 1
            : editor.revision + 1;
        setEditor({ ...editor, newPlan: false, newVersion: false, revision });
        setMessage(
          'Borrador guardado en este dispositivo · pendiente de enviar.'
        );
      } else {
        if (!object(outcome.result) || !isVersion(outcome.result.version))
          throw new Error('No pudimos confirmar el borrador.');
        setEditor(fromVersion(outcome.result.version));
        setAttempt((n) => n + 1);
        setMessage('Borrador guardado. El cliente todavía no lo ve.');
      }
      setDirty(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No pudimos guardar. Tu captura permanece aquí.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    if (!editor || !clientId || !data) return;
    setBusy(true);
    setError('');
    try {
      const outcome = await trainingWrite({
        kind: 'training.activate',
        endpoint: `${base}/${editor.planId}/versions/${editor.id}/activate`,
        method: 'POST',
        body: {
          revision: editor.revision,
          activeRevision: data.activeRevision,
        },
        label: `Activar rutina: ${editor.document.name}`,
        clientId,
        clientName: null,
        entityKey: editor.planId,
        readEndpoint: base,
      });
      setMessage(
        outcome.queued
          ? 'Activación pendiente de enviar. El cliente conserva su rutina anterior.'
          : 'Rutina activada. Ya está disponible para el cliente.'
      );
      if (!outcome.queued) {
        if (object(outcome.result) && isVersion(outcome.result.version))
          setEditor(fromVersion(outcome.result.version));
        setAttempt((n) => n + 1);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No pudimos activar la rutina.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    if (!editor || !target) return;
    setBusy(true);
    setError('');
    try {
      const destination = `/api/clients/${encodeURIComponent(target)}/training-plans`,
        current = await readVersions(destination),
        draft = current.versions.find((v) => !v.published),
        previous = current.versions[0];
      if (
        draft &&
        !window.confirm(
          'El cliente tiene un borrador. ¿Sustituirlo por una copia de esta plantilla?'
        )
      )
        return;
      const planId = previous?.planId ?? crypto.randomUUID(),
        versionId = draft?.id ?? crypto.randomUUID();
      const outcome = await trainingWrite({
        kind: 'training.save',
        endpoint: draft
          ? `${destination}/${planId}/versions/${draft.id}`
          : previous
            ? `${destination}/${planId}/versions`
            : destination,
        method: draft ? 'PATCH' : 'POST',
        body: draft
          ? {
              revision: draft.revision,
              prescription: clonePrescription(editor.document),
            }
          : {
              id: planId,
              versionId,
              prescription: clonePrescription(editor.document),
            },
        label: `Asignar ${editor.document.name}`,
        clientId: target,
        clientName: clients.find((c) => c.id === target)?.fullName ?? null,
        entityKey: planId,
        readEndpoint: destination,
      });
      setMessage(
        outcome.queued
          ? 'Asignación pendiente de enviar. Abre el entrenamiento del cliente para continuar.'
          : 'Copia asignada como borrador. Revísala y actívala desde el expediente del cliente.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos asignar.');
    } finally {
      setBusy(false);
    }
  }
  async function saveZone() {
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
        clientName: null,
        entityKey: `zone:${clientId}`,
        readEndpoint: base,
      });
      setMessage(
        outcome.queued
          ? 'Zona horaria pendiente de enviar.'
          : 'Zona actualizada para registros futuros.'
      );
      if (!outcome.queued) setAttempt((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cambiar la zona.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="training-page">
      <PageHeader
        eyebrow={
          clientId ? 'PRESCRIPCIÓN DEL CLIENTE' : 'BIBLIOTECA PROFESIONAL'
        }
        title="Entrenamiento"
        lead={
          clientId
            ? 'Programa, revisa y comparte una rutina que el cliente pueda seguir.'
            : 'Crea plantillas propias y adapta una copia para cada cliente.'
        }
        actions={
          <div className="training-actions">
            {clientId && (
              <Link className="ws-btn" to={`/app/clientes/${clientId}`}>
                Volver al expediente
              </Link>
            )}
            <button
              type="button"
              className="ws-btn"
              data-variant="primary"
              onClick={() => newDraft()}
            >
              {clientId ? 'Crear / continuar borrador' : 'Nueva plantilla'}
            </button>
          </div>
        }
      />
      {error && (
        <div role="alert" className="ws-alert" data-tone="bad">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Actualizar lectura
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="training-notice">
          {message}
        </p>
      )}
      {loading && <p role="status">Consultando rutinas…</p>}
      <div className="training-workspace">
        <aside className="training-library ws-card">
          <h2>{clientId ? 'Rutinas del cliente' : 'Mis plantillas'}</h2>
          {!loading && !localVersions.length && (
            <p>
              Aún no hay {clientId ? 'rutinas para este cliente' : 'plantillas'}
              . Crea la primera desde aquí.
            </p>
          )}
          {localVersions.map((v) => (
            <button
              type="button"
              key={v.id}
              className="training-version"
              aria-pressed={editor?.id === v.id}
              onClick={() => {
                if (canLeave()) {
                  setEditor(fromVersion(v));
                  setDirty(false);
                  setMessage('');
                }
              }}
            >
              <strong>{v.name}</strong>
              <span>
                {v.id === data?.activeVersionId
                  ? 'Activa'
                  : v.published
                    ? clientId
                      ? 'Anterior'
                      : 'Guardada'
                    : 'Borrador'}{' '}
                · {new Date(v.createdAt).toLocaleDateString('es-MX')}
              </span>
              {operations.some((op) => op.entityKey === v.planId) && (
                <small>Pendiente de enviar</small>
              )}
            </button>
          ))}
          {clientId && (
            <>
              <label>
                Usar una plantilla
                <select
                  value=""
                  onChange={(e) => {
                    const template = templates.find(
                      (v) => v.id === e.target.value
                    );
                    if (template) newDraft(template);
                  }}
                >
                  <option value="">Selecciona una plantilla</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <details>
                <summary>Zona horaria del cliente</summary>
                <label>
                  Zona IANA
                  <input
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                    placeholder="America/Mexico_City"
                  />
                </label>
                <p>Los cambios no reinterpretan sesiones anteriores.</p>
                <button
                  type="button"
                  className="ws-btn"
                  disabled={busy}
                  onClick={() => void saveZone()}
                >
                  Guardar zona
                </button>
              </details>
            </>
          )}
        </aside>
        <section className="training-content">
          {editor ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="training-toolbar">
                <div>
                  <span className="training-eyebrow">
                    {editor.id === data?.activeVersionId
                      ? 'ACTIVA EN EL MÓVIL'
                      : editor.published
                        ? 'SOLO LECTURA'
                        : 'BORRADOR'}
                  </span>
                  <h2>{editor.document.name}</h2>
                </div>
                <div className="training-actions">
                  {editor.published ? (
                    <button
                      type="button"
                      className="ws-btn"
                      data-variant="primary"
                      disabled={busy}
                      title="Crea una copia editable; lo anterior y sus registros se conservan."
                      onClick={() => newDraft(editor.document)}
                    >
                      Editar rutina
                    </button>
                  ) : (
                    <button
                      className="ws-btn"
                      data-variant="primary"
                      disabled={busy}
                    >
                      {busy ? 'Guardando…' : 'Guardar borrador'}
                    </button>
                  )}
                  {clientId && (
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={
                        busy ||
                        dirty ||
                        editor.newVersion ||
                        editor.id === data?.activeVersionId
                      }
                      onClick={() => void activate()}
                    >
                      Activar
                    </button>
                  )}
                  {!clientId && (
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={busy}
                      onClick={() => newDraft(editor.document)}
                    >
                      Duplicar plantilla
                    </button>
                  )}
                </div>
              </div>
              <PrescriptionEditor
                key={editor.id}
                value={editor.document}
                readOnly={editor.published || busy}
                onChange={(document) => {
                  setEditor({ ...editor, document });
                  setDirty(true);
                }}
              />
              {!clientId && (
                <section className="ws-card training-assignment">
                  <h2>Asignar una copia a un cliente</h2>
                  <p>
                    La copia se personaliza y activa desde su expediente. Esta
                    plantilla se conserva independiente.
                  </p>
                  <div className="training-fields">
                    <label>
                      Buscar cliente
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label>
                      Cliente
                      <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      >
                        <option value="">Selecciona</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="ws-btn"
                    data-variant="primary"
                    disabled={!target || busy || dirty}
                    onClick={() => void assign()}
                  >
                    Asignar a cliente
                  </button>
                  {target && (
                    <Link
                      className="ws-btn"
                      to={`/app/clientes/${target}/entrenamiento`}
                    >
                      Abrir entrenamiento del cliente
                    </Link>
                  )}
                </section>
              )}
            </form>
          ) : (
            <div className="training-welcome ws-card">
              <span aria-hidden="true">↗</span>
              <h2>Una rutina, paso a paso</h2>
              <p>
                Elige una plantilla o crea un borrador. Programa los días, añade
                ejercicios y ajusta cada serie.
              </p>
              <p>
                Solo la rutina que actives se mostrará en el móvil del cliente.
              </p>
            </div>
          )}
        </section>
      </div>
      {clientId && (
        <SessionLog
          clientId={clientId}
          versions={data?.versions ?? []}
          refresh={attempt}
        />
      )}
      <footer className="training-credit">
        Exercise data by{' '}
        <a href="https://repdb.co/" target="_blank" rel="noreferrer">
          RepDB
        </a>
        . Las ilustraciones acompañan las indicaciones del profesional.
      </footer>
    </div>
  );
}

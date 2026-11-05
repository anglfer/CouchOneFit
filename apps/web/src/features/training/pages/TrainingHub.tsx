import { useState } from 'react';
import { Link } from '../../../components/Link';
import { Icon } from '../../../components/Icon';
import { Badge, PageHeader } from '../../../components/ui';
import { navigate } from '../../../utils/navigation';
import { confirmDialog } from '../../../services/confirm';
import { ClientPicker } from '../components/Pickers';
import PrescriptionEditor from '../components/PrescriptionEditor';
import RoutineWeek from '../components/RoutineWeek';
import { useRoutines } from '../hooks/useRoutines';
import {
  assignTemplate,
  count,
  type TrainingClient,
  routineStats,
  scheduleLabel,
} from '../services/training';
import type { TrainingVersion } from '../types/training';

/** Rutinas: reusable templates. Each client's routine lives in their record. */
export default function TrainingHub() {
  return (
    <>
      <PageHeader
        eyebrow="Rutinas"
        title="Plantillas de rutina"
        lead="Diseña una rutina una vez y asígnala a tus clientes. La rutina de cada cliente se gestiona desde su ficha."
        actions={
          <Link to="/app/clientes" className="ws-btn">
            <Icon name="users" size={16} /> Ir a clientes
          </Link>
        }
      />
      <TemplatesBoard />
    </>
  );
}

function TemplatesBoard() {
  const r = useRoutines();
  const [assigning, setAssigning] = useState<TrainingVersion | null>(null);
  const editing = r.editor;
  async function assign(template: TrainingVersion, client: TrainingClient) {
    if (
      client.hasDraft &&
      !(await confirmDialog({
        title: '¿Sustituir el borrador?',
        message: `${client.fullName} ya tiene un borrador sin activar. Se reemplazará por esta plantilla.`,
        confirmLabel: 'Sustituir borrador',
        danger: true,
      }))
    )
      return;
    setAssigning(null);
    try {
      await assignTemplate(template, client);
      navigate(`/app/clientes/${client.id}/entrenamiento`);
    } catch (e) {
      r.setError(e instanceof Error ? e.message : 'No pudimos asignar.');
    }
  }
  if (editing) {
    const saved = r.routines.find((v) => v.id === editing.id);
    return (
      <form
        className="training-editing"
        onSubmit={(e) => {
          e.preventDefault();
          void r.save();
        }}
      >
        <div className="training-savebar">
          <button
            type="button"
            className="ws-btn"
            onClick={() => void r.close()}
          >
            ← Plantillas
          </button>
          <div className="training-savebar-status">
            <strong>{editing.document.name || 'Plantilla sin nombre'}</strong>
            <small>
              {r.busy
                ? 'Guardando…'
                : r.dirty
                  ? 'Cambios sin guardar'
                  : 'Todo guardado'}
            </small>
          </div>
          <div className="training-actions">
            {saved && !r.dirty && (
              <button
                type="button"
                className="ws-btn"
                onClick={() => setAssigning(saved)}
              >
                Asignar a cliente
              </button>
            )}
            <button
              className="ws-btn"
              data-variant="primary"
              disabled={r.busy || !r.dirty}
            >
              Guardar plantilla
            </button>
          </div>
        </div>
        <Notices r={r} />
        <PrescriptionEditor
          key={editing.id}
          value={editing.document}
          onChange={r.change}
          disabled={r.busy}
        />
        {assigning && (
          <ClientPicker
            onClose={() => setAssigning(null)}
            onPick={(c) => void assign(assigning, c)}
          />
        )}
      </form>
    );
  }
  return (
    <section aria-label="Plantillas">
      <Notices r={r} />
      {r.loading && <p role="status">Consultando plantillas…</p>}
      <ul className="training-template-grid">
        <li>
          <button
            type="button"
            className="ws-plain training-template-card training-template-new"
            onClick={() => void r.newDraft()}
          >
            <Icon name="plus" size={28} />
            <strong>Nueva plantilla</strong>
            <small>
              Diseña una rutina una vez y asígnala a varios clientes.
            </small>
          </button>
        </li>
        {r.routines.map((t) => {
          const stats = routineStats(t);
          return (
            <li key={t.id} className="training-template-card">
              <div>
                <strong>{t.name}</strong>
                <small>
                  {scheduleLabel(t)} · {count(stats.trainingDays, 'día')} ·{' '}
                  {count(stats.exercises, 'ejercicio')}
                </small>
                {r.pending(t.planId) && (
                  <Badge tone="warn">Pendiente de enviar</Badge>
                )}
              </div>
              <RoutineWeek routine={t} compact />
              <div className="training-actions">
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => setAssigning(t)}
                >
                  Asignar
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => void r.open(t)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() =>
                    void r.newDraft({ ...t, name: `${t.name} (copia)` })
                  }
                >
                  Duplicar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {assigning && (
        <ClientPicker
          onClose={() => setAssigning(null)}
          onPick={(c) => void assign(assigning, c)}
        />
      )}
    </section>
  );
}

export function Notices({ r }: { r: ReturnType<typeof useRoutines> }) {
  return (
    <>
      {r.error && (
        <div role="alert" className="ws-alert" data-tone="bad">
          {r.error}{' '}
          <button type="button" onClick={r.reload}>
            Actualizar
          </button>
        </div>
      )}
      {r.notice && (
        <p role="status" className="ws-alert" data-tone="ok">
          {r.notice}
        </p>
      )}
    </>
  );
}

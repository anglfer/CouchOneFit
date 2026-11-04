import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '../../../components/Link';
import { Icon, type IconName } from '../../../components/Icon';
import { Badge } from '../../../components/ui';
import Modal from '../components/Modal';
import { TemplatePicker } from '../components/Pickers';
import PrescriptionEditor from '../components/PrescriptionEditor';
import RoutineView from '../components/RoutineView';
import RoutineWeek from '../components/RoutineWeek';
import SessionLog from '../components/SessionLog';
import { useRoutines, type Routines } from '../hooks/useRoutines';
import {
  initials,
  readSessions,
  relativeDay,
  routineStats,
  scheduleLabel,
} from '../services/training';
import type {
  Prescription,
  TrainingSession,
  TrainingVersion,
} from '../types/training';
import { Notices } from './TrainingHub';

type Tab = 'summary' | 'routine' | 'logs' | 'history';
const tabs: [Tab, string, IconName][] = [
  ['summary', 'Resumen', 'home'],
  ['routine', 'Rutina', 'dumbbell'],
  ['logs', 'Registros', 'chart'],
  ['history', 'Historial', 'layers'],
];
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function ClientTraining({ clientId }: { clientId: string }) {
  const r = useRoutines(clientId);
  const [tab, setTab] = useState<Tab>('summary'),
    [choosing, setChoosing] = useState(false),
    [viewing, setViewing] = useState<TrainingVersion | null>(null);
  const name = r.data?.clientName ?? 'Cliente';
  const editing = r.editor && !r.editor.published ? r.editor : null;
  const status = r.active
    ? ({ tone: 'ok', text: 'Rutina activa' } as const)
    : r.draft
      ? ({ tone: 'warn', text: 'Borrador sin activar' } as const)
      : ({ tone: 'info', text: 'Sin rutina' } as const);
  const startFrom = (source?: Prescription) => {
    if (r.newDraft(source)) setTab('routine');
  };
  const continueDraft = () => {
    if (r.draft && r.open(r.draft)) setTab('routine');
  };
  async function saveAndActivate() {
    const saved = r.dirty || r.editor?.newVersion ? await r.save() : r.editor;
    if (saved && (await r.activate(saved))) {
      r.close();
      setTab('summary');
    }
  }
  return (
    <>
      <header className="training-client-header">
        <Link to="/app/entrenamiento" className="training-back">
          ← Entrenamiento
        </Link>
        <div className="training-client-identity">
          <span className="ws-avatar ws-avatar-lg" aria-hidden="true">
            {initials(name)}
          </span>
          <div>
            <span className="ws-eyebrow">ENTRENAMIENTO DEL CLIENTE</span>
            <h1 className="ws-title">{name}</h1>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <Link to={`/app/clientes/${clientId}`} className="ws-btn">
            Ver expediente
          </Link>
        </div>
      </header>
      <div className="training-tabs" role="tablist" aria-label="Secciones">
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
            {key === 'routine' && editing && (
              <span className="training-dot" aria-label="borrador abierto" />
            )}
          </button>
        ))}
      </div>
      <Notices r={r} />
      {r.loading && <p role="status">Consultando entrenamiento…</p>}

      {tab === 'summary' && !r.loading && (
        <div className="training-summary">
          <div className="training-summary-main">
            {r.draft && r.active && !editing && (
              <div className="ws-alert" data-tone="warn">
                Tienes cambios sin activar en «{r.draft.name}».{' '}
                <button type="button" onClick={continueDraft}>
                  Continuar editando
                </button>
              </div>
            )}
            {r.active ? (
              <RoutineCard
                eyebrow="RUTINA ACTIVA"
                routine={r.active}
                note={`Activa desde ${day(r.active.createdAt)} · es la que ve el cliente en su móvil.`}
              >
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() =>
                    r.draft ? continueDraft() : startFrom(r.active!)
                  }
                >
                  Editar rutina
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => setChoosing(true)}
                >
                  Cambiar por plantilla
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => setTab('routine')}
                >
                  Ver detalle
                </button>
              </RoutineCard>
            ) : r.draft ? (
              <RoutineCard
                eyebrow="BORRADOR"
                routine={r.draft}
                note="El cliente todavía no lo ve. Revísalo y actívalo cuando esté listo."
              >
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={continueDraft}
                >
                  Revisar y activar
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => setChoosing(true)}
                >
                  Usar otra plantilla
                </button>
              </RoutineCard>
            ) : (
              <StartChoices
                name={name}
                onTemplate={() => setChoosing(true)}
                onScratch={() => startFrom()}
              />
            )}
          </div>
          <aside className="training-summary-side">
            <RecentActivity
              clientId={clientId}
              routines={r.routines}
              refresh={r.attempt}
              onAll={() => setTab('logs')}
            />
            <TimeZoneCard r={r} />
          </aside>
        </div>
      )}

      {tab === 'routine' &&
        !r.loading &&
        (editing ? (
          <form
            className="training-editing"
            onSubmit={(e) => {
              e.preventDefault();
              void saveAndActivate();
            }}
          >
            <div className="training-savebar">
              <div className="training-savebar-status">
                <strong>
                  {r.active ? 'Editando la rutina' : 'Nueva rutina'}
                </strong>
                <small>
                  {r.busy
                    ? 'Guardando…'
                    : r.dirty
                      ? 'Cambios sin guardar · el cliente aún no los ve'
                      : 'Borrador guardado · el cliente aún no lo ve'}
                </small>
              </div>
              <div className="training-actions">
                <button
                  type="button"
                  className="ws-btn"
                  disabled={r.busy}
                  onClick={() => {
                    if (r.close()) setTab('summary');
                  }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  disabled={r.busy || !r.dirty}
                  onClick={() => void r.save()}
                >
                  Guardar borrador
                </button>
                <button
                  className="ws-btn"
                  data-variant="primary"
                  disabled={r.busy}
                >
                  {r.active
                    ? 'Guardar y reemplazar activa'
                    : 'Guardar y activar'}
                </button>
              </div>
            </div>
            <PrescriptionEditor
              key={editing.id}
              value={editing.document}
              onChange={r.change}
              disabled={r.busy}
            />
          </form>
        ) : r.active ? (
          <section className="ws-card">
            <div className="training-section-head">
              <div>
                <span className="ws-eyebrow">LO QUE VE EL CLIENTE</span>
                <h2>{r.active.name}</h2>
              </div>
              <button
                type="button"
                className="ws-btn"
                data-variant="primary"
                onClick={() =>
                  r.draft ? continueDraft() : startFrom(r.active!)
                }
              >
                Editar rutina
              </button>
            </div>
            <RoutineView routine={r.active} />
          </section>
        ) : (
          <StartChoices
            name={name}
            onTemplate={() => setChoosing(true)}
            onScratch={() => (r.draft ? continueDraft() : startFrom())}
          />
        ))}

      {tab === 'logs' && (
        <SessionLog
          clientId={clientId}
          versions={r.routines}
          refresh={r.attempt}
        />
      )}

      {tab === 'history' && (
        <section className="ws-card">
          <div className="training-section-head">
            <div>
              <span className="ws-eyebrow">HISTORIAL</span>
              <h2>Rutinas de {name}</h2>
              <p>
                Cada cambio guarda la rutina anterior; los registros del cliente
                siguen ligados a lo que tenía en ese momento.
              </p>
            </div>
          </div>
          {r.routines.length === 0 && (
            <p className="ws-empty">Todavía no hay rutinas.</p>
          )}
          <ol className="training-history">
            {r.routines.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>{v.name}</strong>
                  <small>
                    {day(v.createdAt)} · {scheduleLabel(v)}
                  </small>
                </div>
                <Badge
                  tone={
                    v.id === r.active?.id
                      ? 'ok'
                      : v.published
                        ? 'neutral'
                        : 'warn'
                  }
                >
                  {v.id === r.active?.id
                    ? 'Activa'
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
                  {v.published && v.id !== r.active?.id && (
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

      {choosing && (
        <TemplatePicker
          onClose={() => setChoosing(false)}
          onPick={(t) => {
            setChoosing(false);
            startFrom(t);
          }}
        />
      )}
      {viewing && (
        <Modal wide title={viewing.name} onClose={() => setViewing(null)}>
          <RoutineView routine={viewing} />
        </Modal>
      )}
    </>
  );
}

function RoutineCard({
  eyebrow,
  routine,
  note,
  children,
}: {
  eyebrow: string;
  routine: TrainingVersion;
  note: string;
  children: ReactNode;
}) {
  const stats = routineStats(routine);
  return (
    <section className="ws-card training-routine-card">
      <span className="ws-eyebrow">{eyebrow}</span>
      <h2>{routine.name}</h2>
      <p className="training-chips">
        <span>{scheduleLabel(routine)}</span>
        <span>{stats.trainingDays} días de entrenamiento</span>
        <span>{stats.exercises} ejercicios</span>
      </p>
      <RoutineWeek routine={routine} />
      <p className="training-muted">{note}</p>
      <div className="training-actions">{children}</div>
    </section>
  );
}

function StartChoices({
  name,
  onTemplate,
  onScratch,
}: {
  name: string;
  onTemplate: () => void;
  onScratch: () => void;
}) {
  return (
    <section className="ws-card training-start">
      <Icon name="dumbbell" size={32} />
      <h2>{name} aún no tiene rutina</h2>
      <p>¿Cómo quieres empezar?</p>
      <div className="training-start-grid">
        <button type="button" className="ws-plain" onClick={onTemplate}>
          <Icon name="layers" size={24} />
          <strong>Desde una plantilla</strong>
          <small>Copia una de tus plantillas y ajústala a este cliente.</small>
        </button>
        <button type="button" className="ws-plain" onClick={onScratch}>
          <Icon name="plus" size={24} />
          <strong>Empezar desde cero</strong>
          <small>Arma los días y ejercicios con el catálogo.</small>
        </button>
      </div>
    </section>
  );
}

function RecentActivity({
  clientId,
  routines,
  refresh,
  onAll,
}: {
  clientId: string;
  routines: TrainingVersion[];
  refresh: number;
  onAll: () => void;
}) {
  const [sessions, setSessions] = useState<TrainingSession[] | null>(null);
  useEffect(() => {
    let live = true;
    void readSessions(clientId, 0)
      .then((r) => live && setSessions(r.sessions))
      .catch(() => live && setSessions([]));
    return () => {
      live = false;
    };
  }, [clientId, refresh]);
  return (
    <section className="ws-card">
      <h3 className="training-panel-title">Actividad reciente</h3>
      {!sessions && <p role="status">Cargando…</p>}
      {sessions?.length === 0 && (
        <p className="training-muted">
          Aún no registra entrenamientos desde su móvil.
        </p>
      )}
      <ul className="training-activity">
        {sessions?.slice(0, 4).map((s) => {
          const plan = routines.find((v) => v.id === s.versionId);
          const d = plan?.days.find((x) => x.id === s.dayId);
          const total = d?.exercises.reduce((n, e) => n + e.sets.length, 0);
          const done = s.results.filter((x) => x.state === 'performed').length;
          return (
            <li key={s.id}>
              <span data-status={s.status} aria-hidden="true" />
              <div>
                <strong>{d?.name ?? 'Entrenamiento'}</strong>
                <small>
                  {relativeDay(s.localDate)} · {done}
                  {total ? `/${total}` : ''} series ·{' '}
                  {s.status === 'finalized' ? 'Finalizado' : 'En progreso'}
                </small>
              </div>
            </li>
          );
        })}
      </ul>
      {!!sessions?.length && (
        <button type="button" className="ws-btn" onClick={onAll}>
          Ver todos los registros
        </button>
      )}
    </section>
  );
}

function TimeZoneCard({ r }: { r: Routines }) {
  const [zone, setZone] = useState('');
  const current = r.data?.timeZone ?? '';
  return (
    <details className="ws-card training-settings">
      <summary>Ajustes · zona horaria ({current || '—'})</summary>
      <p className="training-muted">
        Define qué día es «hoy» para el cliente. No cambia registros anteriores.
      </p>
      <label>
        Zona IANA
        <input
          value={zone || current}
          onChange={(e) => setZone(e.target.value)}
          placeholder="America/Mexico_City"
        />
      </label>
      <button
        type="button"
        className="ws-btn"
        disabled={r.busy || !zone || zone === current}
        onClick={() => void r.saveZone(zone)}
      >
        Guardar zona
      </button>
    </details>
  );
}

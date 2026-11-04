import { useEffect, useState } from 'react';
import { Link } from '../../../components/Link';
import { Icon } from '../../../components/Icon';
import { Badge, PageHeader } from '../../../components/ui';
import { navigate } from '../../../utils/navigation';
import { ClientPicker } from '../components/Pickers';
import PrescriptionEditor from '../components/PrescriptionEditor';
import RoutineWeek from '../components/RoutineWeek';
import { useRoutines } from '../hooks/useRoutines';
import {
  assignTemplate,
  readTrainingClients,
  relativeDay,
  type TrainingClient,
  initials,
  routineStats,
  scheduleLabel,
} from '../services/training';
import type { TrainingVersion } from '../types/training';

export default function TrainingHub({ tab }: { tab: 'clients' | 'templates' }) {
  return (
    <>
      <PageHeader
        eyebrow="ENTRENAMIENTO"
        title="Entrenamiento"
        lead="Asigna rutinas a tus clientes y organiza plantillas reutilizables."
      />
      <nav className="training-tabs" aria-label="Secciones de entrenamiento">
        <Link
          to="/app/entrenamiento"
          aria-current={tab === 'clients' ? 'page' : undefined}
        >
          <Icon name="users" size={16} /> Clientes
        </Link>
        <Link
          to="/app/entrenamiento/plantillas"
          aria-current={tab === 'templates' ? 'page' : undefined}
        >
          <Icon name="layers" size={16} /> Plantillas
        </Link>
      </nav>
      {tab === 'clients' ? <ClientsBoard /> : <TemplatesBoard />}
    </>
  );
}

type Filter = 'all' | 'none' | 'draft' | 'active';
function status(c: TrainingClient) {
  if (c.status !== 'active')
    return { tone: 'neutral', text: 'Inactivo' } as const;
  if (c.activeRoutine) return { tone: 'ok', text: 'Rutina activa' } as const;
  if (c.hasDraft)
    return { tone: 'warn', text: 'Borrador sin activar' } as const;
  return { tone: 'info', text: 'Sin rutina' } as const;
}

function ClientsBoard() {
  const [clients, setClients] = useState<TrainingClient[] | null>(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState<Filter>('all'),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void readTrainingClients()
      .then((r) => {
        if (!live) return;
        setClients(r);
        setError('');
      })
      .catch(() => live && setError('No pudimos consultar tus clientes.'));
    return () => {
      live = false;
    };
  }, [attempt]);
  const active = clients?.filter((c) => c.status === 'active') ?? [];
  const counts = {
    all: active.length,
    active: active.filter((c) => c.activeRoutine).length,
    none: active.filter((c) => !c.activeRoutine && !c.hasDraft).length,
    draft: active.filter((c) => c.hasDraft).length,
  };
  const visible = (clients ?? []).filter(
    (c) =>
      c.fullName
        .toLocaleLowerCase('es')
        .includes(search.trim().toLocaleLowerCase('es')) &&
      (filter === 'all' ||
        (c.status === 'active' &&
          (filter === 'active'
            ? !!c.activeRoutine
            : filter === 'draft'
              ? c.hasDraft
              : !c.activeRoutine && !c.hasDraft)))
  );
  return (
    <section aria-label="Clientes">
      <div className="training-stats">
        <div>
          <span>Clientes activos</span>
          <strong>{counts.all}</strong>
        </div>
        <div>
          <span>Con rutina activa</span>
          <strong>{counts.active}</strong>
        </div>
        <div data-tone={counts.none ? 'warn' : undefined}>
          <span>Sin rutina</span>
          <strong>{counts.none}</strong>
        </div>
        <div>
          <span>Entrenaron esta semana</span>
          <strong>{active.filter((c) => c.sessionsLast7 > 0).length}</strong>
        </div>
      </div>
      <div className="training-toolbar">
        <label className="training-search">
          <span className="sr-only">Buscar cliente</span>
          <input
            type="search"
            placeholder="Buscar cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="training-segmented" role="group" aria-label="Filtrar">
          {(
            [
              ['all', 'Todos'],
              ['none', `Sin rutina · ${counts.none}`],
              ['draft', `Borrador · ${counts.draft}`],
              ['active', `Activa · ${counts.active}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      )}
      {!clients && !error && <p role="status">Consultando clientes…</p>}
      {clients?.length === 0 && (
        <div className="ws-card ws-empty">
          <Icon name="users" size={28} />
          <p>Aún no tienes clientes en tu cartera.</p>
          <Link to="/app/clientes" className="ws-btn" data-variant="primary">
            Ir a Clientes
          </Link>
        </div>
      )}
      <ul className="training-client-grid">
        {visible.map((c) => {
          const s = status(c);
          return (
            <li key={c.id} data-inactive={c.status !== 'active' || undefined}>
              <Link
                to={`/app/clientes/${c.id}/entrenamiento`}
                className="training-client-card"
              >
                <div className="training-client-top">
                  <span className="ws-avatar" aria-hidden="true">
                    {initials(c.fullName)}
                  </span>
                  <div>
                    <strong>{c.fullName}</strong>
                    <Badge tone={s.tone}>{s.text}</Badge>
                  </div>
                </div>
                <p className="training-client-routine">
                  {c.activeRoutine ??
                    (c.hasDraft
                      ? 'Borrador en preparación'
                      : 'Sin rutina asignada')}
                </p>
                <p className="training-client-meta">
                  {c.lastSession
                    ? `Último entreno ${relativeDay(c.lastSession)} · ${c.sessionsLast7} en 7 días`
                    : 'Sin entrenamientos registrados'}
                </p>
                <span className="training-client-cta">
                  {c.status !== 'active'
                    ? 'Ver historial'
                    : c.activeRoutine
                      ? 'Ver entrenamiento'
                      : c.hasDraft
                        ? 'Revisar y activar'
                        : 'Asignar rutina'}{' '}
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {clients && clients.length > 0 && visible.length === 0 && (
        <p className="ws-empty">Ningún cliente coincide con el filtro.</p>
      )}
    </section>
  );
}

function TemplatesBoard() {
  const r = useRoutines();
  const [assigning, setAssigning] = useState<TrainingVersion | null>(null);
  const editing = r.editor;
  async function assign(template: TrainingVersion, client: TrainingClient) {
    if (
      client.hasDraft &&
      !window.confirm(
        `${client.fullName} ya tiene un borrador. ¿Sustituirlo por esta plantilla?`
      )
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
          <button type="button" className="ws-btn" onClick={() => r.close()}>
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
            onClick={() => r.newDraft()}
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
                  {scheduleLabel(t)} · {stats.trainingDays} días ·{' '}
                  {stats.exercises} ejercicios
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
                  onClick={() => r.open(t)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() =>
                    r.newDraft({ ...t, name: `${t.name} (copia)` })
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

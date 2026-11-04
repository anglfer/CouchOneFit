import { useEffect, useState } from 'react';
import { Badge } from '../../../components/ui';
import {
  initials,
  readTrainingClients,
  readVersions,
  routineStats,
  scheduleLabel,
  type TrainingClient,
} from '../services/training';
import type { TrainingVersion } from '../types/training';
import Modal from './Modal';
import RoutineWeek from './RoutineWeek';

/** Choose one of the professional's templates as the base of a routine. */
export function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (template: TrainingVersion) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<TrainingVersion[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void readVersions('/api/training/templates')
      .then((r) => live && setTemplates(r.versions))
      .catch(() => live && setError('No pudimos cargar tus plantillas.'));
    return () => {
      live = false;
    };
  }, []);
  return (
    <Modal
      wide
      title="Elegir una plantilla"
      subtitle="Se crea una copia para este cliente; tu plantilla no cambia."
      onClose={onClose}
    >
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}
      {!templates && !error && <p role="status">Cargando plantillas…</p>}
      {templates?.length === 0 && (
        <div className="ws-empty">
          <p>Aún no tienes plantillas.</p>
          <p>
            Créalas en Entrenamiento → Plantillas para reutilizarlas con
            cualquier cliente.
          </p>
        </div>
      )}
      <div className="training-template-grid">
        {templates?.map((t) => {
          const stats = routineStats(t);
          return (
            <button
              type="button"
              key={t.id}
              className="ws-plain training-template-card"
              onClick={() => onPick(t)}
            >
              <strong>{t.name}</strong>
              <small>
                {scheduleLabel(t)} · {stats.trainingDays} días ·{' '}
                {stats.exercises} ejercicios
              </small>
              <RoutineWeek routine={t} compact />
              <span className="training-catalog-add">Usar esta plantilla</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** Choose an active client to receive a copy of a template. */
export function ClientPicker({
  onPick,
  onClose,
}: {
  onPick: (client: TrainingClient) => void;
  onClose: () => void;
}) {
  const [clients, setClients] = useState<TrainingClient[] | null>(null),
    [search, setSearch] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void readTrainingClients()
      .then((r) => live && setClients(r.filter((c) => c.status === 'active')))
      .catch(() => live && setError('No pudimos cargar tus clientes.'));
    return () => {
      live = false;
    };
  }, []);
  const visible = clients?.filter((c) =>
    c.fullName.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))
  );
  return (
    <Modal
      title="Asignar a un cliente"
      subtitle="Quedará como borrador para que lo revises y actives."
      onClose={onClose}
    >
      <label className="training-search">
        <span className="sr-only">Buscar cliente</span>
        <input
          autoFocus
          type="search"
          placeholder="Buscar cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}
      <ul className="training-client-list">
        {visible?.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="ws-plain"
              onClick={() => onPick(c)}
            >
              <span className="ws-avatar" aria-hidden="true">
                {initials(c.fullName)}
              </span>
              <span>
                <strong>{c.fullName}</strong>
                <small>{c.activeRoutine ?? 'Sin rutina activa'}</small>
              </span>
              {c.hasDraft && <Badge tone="warn">Tiene borrador</Badge>}
            </button>
          </li>
        ))}
      </ul>
      {visible?.length === 0 && (
        <p className="ws-empty">No hay clientes activos con ese nombre.</p>
      )}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { readCatalog, type CatalogExercise } from '../services/training';
import ExerciseAnimation from './ExerciseAnimation';
import Modal from './Modal';

export default function ExercisePicker({
  onSelect,
  onCustom,
  onClose,
}: {
  onSelect: (exercise: CatalogExercise) => void;
  onCustom: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(''),
    [muscle, setMuscle] = useState(''),
    [equipment, setEquipment] = useState(''),
    [offset, setOffset] = useState(0);
  const [data, setData] = useState<Awaited<
      ReturnType<typeof readCatalog>
    > | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0),
    [added, setAdded] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      void readCatalog(
        new URLSearchParams({
          search,
          muscle,
          equipment,
          offset: String(offset),
        })
      )
        .then((value) => {
          if (active) {
            setData(value);
            setError('');
          }
        })
        .catch(() => {
          if (active) setError('No pudimos cargar el catálogo.');
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, muscle, equipment, offset, attempt]);
  const reset = () => setOffset(0);
  return (
    <Modal
      wide
      title="Añadir ejercicios"
      subtitle="Los nombres están en inglés. Añade varios seguidos; pulsa Listo al terminar."
      onClose={onClose}
    >
      <div className="training-catalog-filters">
        <label className="training-search">
          <span className="sr-only">Buscar ejercicio</span>
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
            placeholder="Squat, row, bench press…"
          />
        </label>
        <label>
          <span className="sr-only">Grupo muscular</span>
          <select
            value={muscle}
            onChange={(e) => {
              setMuscle(e.target.value);
              reset();
            }}
          >
            <option value="">Todos los músculos</option>
            {data?.filters.muscles.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Equipo</span>
          <select
            value={equipment}
            onChange={(e) => {
              setEquipment(e.target.value);
              reset();
            }}
          >
            <option value="">Todo el equipo</option>
            {data?.filters.equipment.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((x) => x + 1)}>
            Reintentar
          </button>
        </p>
      )}
      {busy && !data && (
        <p role="status" className="training-muted">
          Cargando catálogo…
        </p>
      )}
      <div className="training-catalog-grid" aria-busy={busy}>
        {data?.exercises.map((e) => {
          const count = added.filter((id) => id === e.id).length;
          return (
            <button
              type="button"
              key={e.id}
              className="ws-plain training-catalog-item"
              data-added={count > 0 || undefined}
              onClick={() => {
                onSelect(e);
                setAdded((list) => [...list, e.id]);
              }}
            >
              <ExerciseAnimation images={e.images} name={e.name} />
              <strong>{e.name}</strong>
              <small>
                {e.muscles[0] ?? e.bodyPart}
                {e.equipment.length ? ` · ${e.equipment[0]}` : ' · Sin equipo'}
              </small>
              <span className="training-catalog-add">
                {count
                  ? `✓ Añadido${count > 1 ? ` ×${count}` : ''}`
                  : '+ Añadir'}
              </span>
            </button>
          );
        })}
      </div>
      {!busy && !error && data?.exercises.length === 0 && (
        <div className="ws-empty">
          <p>No hay coincidencias. Cambia los filtros o crea uno propio.</p>
        </div>
      )}
      <footer className="training-catalog-foot">
        <button
          type="button"
          className="ws-btn"
          onClick={() => {
            onCustom();
            onClose();
          }}
        >
          Crear ejercicio propio
        </button>
        <div className="training-actions">
          <button
            type="button"
            className="ws-btn"
            disabled={offset === 0 || busy}
            onClick={() => setOffset(Math.max(0, offset - 40))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="ws-btn"
            disabled={data?.nextOffset == null || busy}
            onClick={() => setOffset(data!.nextOffset!)}
          >
            Siguiente
          </button>
          <button
            type="button"
            className="ws-btn"
            data-variant="primary"
            onClick={onClose}
          >
            Listo{added.length ? ` (${added.length})` : ''}
          </button>
        </div>
      </footer>
      <small className="training-credit">
        Animaciones ©{' '}
        <a
          href="https://gymvisual.com/"
          target="_blank"
          rel="nofollow noreferrer"
        >
          Gym visual
        </a>
      </small>
    </Modal>
  );
}

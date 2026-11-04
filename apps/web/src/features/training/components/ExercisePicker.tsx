import { useEffect, useState } from 'react';
import { readCatalog, type CatalogExercise } from '../services/training';
import ExerciseAnimation from './ExerciseAnimation';

export default function ExercisePicker({
  onSelect,
  onClose,
}: {
  onSelect: (exercise: CatalogExercise) => void;
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
    [attempt, setAttempt] = useState(0);
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
          if (active)
            setError(
              'No pudimos cargar el catálogo. Puedes crear un ejercicio manual.'
            );
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
  return (
    <section
      className="training-catalog ws-card"
      aria-label="Catálogo de ejercicios"
    >
      <div className="training-row">
        <div>
          <p className="training-eyebrow">BIBLIOTECA DE MOVIMIENTO</p>
          <h2>Elige un ejercicio</h2>
        </div>
        <button type="button" className="ws-btn" onClick={onClose}>
          Cerrar catálogo
        </button>
      </div>
      <div className="training-fields">
        <label>
          Buscar en español
          <input
            autoFocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Sentadilla, remo, press…"
          />
        </label>
        <label>
          Grupo muscular
          <select
            value={muscle}
            onChange={(e) => {
              setMuscle(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos</option>
            {data?.filters.muscles.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Equipo
          <select
            value={equipment}
            onChange={(e) => {
              setEquipment(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todos</option>
            {data?.filters.equipment.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {busy && <p role="status">Buscando ejercicios…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((x) => x + 1)}>
            Reintentar
          </button>
        </p>
      )}
      <div className="training-catalog-grid">
        {!busy &&
          !error &&
          data?.exercises.map((e) => (
            <article key={e.id} className="training-catalog-item">
              <ExerciseAnimation images={e.images} name={e.name} />
              <div>
                <h3>{e.name}</h3>
                <p>
                  {e.bodyPart} ·{' '}
                  {e.equipment.join(', ') || 'Equipo no especificado'}
                </p>
                <details>
                  <summary>Ver instrucciones</summary>
                  <ol>
                    {e.guidance.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </details>
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="primary"
                  onClick={() => onSelect(e)}
                >
                  Añadir ejercicio
                </button>
              </div>
            </article>
          ))}
      </div>
      {!busy && !error && data?.exercises.length === 0 && (
        <p>
          No hay coincidencias. Cambia los filtros o crea un ejercicio manual.
        </p>
      )}
      <div className="training-row">
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
      </div>
      <small>
        Exercise data by{' '}
        <a href="https://repdb.co/" target="_blank" rel="noreferrer">
          RepDB
        </a>{' '}
        · Demostración animada con posición inicial y final
      </small>
    </section>
  );
}

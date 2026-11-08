import { useEffect, useState } from 'react';
import { readSessions, setTarget } from '../services/training';
import type { TrainingSession, TrainingVersion } from '../types/training';

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

export default function SessionLog({
  clientId,
  versions,
  refresh,
}: {
  clientId: string;
  versions: TrainingVersion[];
  refresh: number;
}) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]),
    [next, setNext] = useState<number | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void readSessions(clientId, 0)
      .then((r) => {
        if (!live) return;
        setSessions(r.sessions);
        setNext(r.nextOffset);
        setError('');
      })
      .catch(() => {
        if (live) setError('No pudimos consultar los registros del cliente.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [clientId, refresh]);
  async function more() {
    if (next === null) return;
    try {
      const r = await readSessions(clientId, next);
      setSessions((s) => [...s, ...r.sessions]);
      setNext(r.nextOffset);
    } catch {
      setError('No pudimos consultar más registros.');
    }
  }
  return (
    <section className="ws-card training-log" aria-labelledby="training-log">
      <h2 id="training-log">Registros del cliente</h2>
      <p>
        Lo que el cliente realizó en cada serie, junto a lo que prescribiste.
      </p>
      {loading && <p role="status">Consultando registros…</p>}
      {error && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {error}
        </p>
      )}
      {!loading && !error && sessions.length === 0 && (
        <p>El cliente todavía no ha registrado entrenamientos.</p>
      )}
      {sessions.map((session) => {
        const plan = versions.find((v) => v.id === session.versionId),
          day = plan?.days.find((d) => d.id === session.dayId),
          done = session.results.filter((r) => r.state === 'performed').length,
          total =
            day?.exercises.reduce((n, e) => n + e.sets.length, 0) ??
            session.results.length;
        return (
          <article key={session.id}>
            <h3>
              {dateLabel(session.localDate)} · {day?.name ?? 'Entrenamiento'}
            </h3>
            <small>
              {session.status === 'finalized' ? 'Finalizado' : 'En progreso'} ·{' '}
              {done} de {total} series realizadas
            </small>
            {day?.exercises.map((exercise) => (
              <div key={exercise.id}>
                <h4>{exercise.name}</h4>
                <div className="training-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Serie</th>
                        <th>Prescrito</th>
                        <th>Reps</th>
                        <th>Carga</th>
                        <th>RPE</th>
                        <th>RIR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exercise.sets.map((set, i) => {
                        const result = session.results.find(
                          (r) => r.setId === set.id
                        );
                        return (
                          <tr key={set.id} data-state={result?.state}>
                            <th>{i + 1}</th>
                            <td>{setTarget(set)}</td>
                            {!result ? (
                              <td colSpan={4}>Sin registrar</td>
                            ) : result.state === 'not_performed' ? (
                              <td colSpan={4}>No realizada</td>
                            ) : (
                              <>
                                <td>{result.reps}</td>
                                <td>
                                  {exercise.loadMode === 'bodyweight'
                                    ? 'Corporal'
                                    : `${result.loadKg} kg`}
                                </td>
                                <td>{result.rpe ?? '—'}</td>
                                <td>{result.rir ?? '—'}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </article>
        );
      })}
      {next !== null && (
        <button type="button" className="ws-btn" onClick={() => void more()}>
          Ver registros anteriores
        </button>
      )}
    </section>
  );
}

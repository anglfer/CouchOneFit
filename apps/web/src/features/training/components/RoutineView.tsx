import { useState } from 'react';
import {
  count,
  routineStats,
  scheduleLabel,
  setTarget,
} from '../services/training';
import type { Prescription } from '../types/training';
import ExerciseAnimation from './ExerciseAnimation';
import RoutineWeek from './RoutineWeek';

/** Read-only routine: what the client sees, day by day. */
export default function RoutineView({ routine }: { routine: Prescription }) {
  const firstTraining = Math.max(
    0,
    routine.days.findIndex((d) => d.kind === 'training')
  );
  const [selected, setSelected] = useState(firstTraining);
  const day = routine.days[Math.min(selected, routine.days.length - 1)];
  const stats = routineStats(routine);
  return (
    <div className="training-view">
      <p className="training-chips">
        <span>{scheduleLabel(routine)}</span>
        <span>
          Desde{' '}
          {new Date(`${routine.startDate}T12:00:00Z`).toLocaleDateString(
            'es-MX',
            { day: 'numeric', month: 'long', timeZone: 'UTC' }
          )}
        </span>
        <span>
          {count(
            stats.trainingDays,
            'día de entrenamiento',
            'días de entrenamiento'
          )}
        </span>
        <span>{count(stats.exercises, 'ejercicio')}</span>
      </p>
      <div className="training-view-days" role="tablist" aria-label="Días">
        {routine.days.map((d, i) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            className="ws-plain"
            aria-selected={d === day}
            data-kind={d.kind}
            onClick={() => setSelected(i)}
          >
            {routine.schedule === 'weekly'
              ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i]
              : `Día ${i + 1}`}
          </button>
        ))}
      </div>
      {day.kind === 'rest' ? (
        <div className="training-rest">
          <span aria-hidden="true">☾</span>
          <h4>Descanso</h4>
        </div>
      ) : (
        <>
          <h3 className="training-view-title">{day.name}</h3>
          <ol className="training-view-list">
            {day.exercises.map((e, i) => (
              <li key={e.id}>
                <ExerciseAnimation images={e.images} name={e.name} size={72} />
                <div>
                  <strong>
                    {i + 1}. {e.name}
                  </strong>
                  <small>
                    {e.loadMode === 'bodyweight' ? 'Peso corporal' : 'Con peso'}
                    {e.restSeconds !== null && ` · descanso ${e.restSeconds} s`}
                  </small>
                  {e.instructions && <em>{e.instructions}</em>}
                  <ul className="training-view-sets">
                    {e.sets.map((s, si) => (
                      <li key={s.id}>
                        <b>{si + 1}</b> {setTarget(s)}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      <details className="training-view-week">
        <summary>Ver toda la semana de un vistazo</summary>
        <RoutineWeek routine={routine} />
      </details>
    </div>
  );
}

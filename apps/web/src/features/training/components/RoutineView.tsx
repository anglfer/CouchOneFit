import { useState } from 'react';
import { Icon } from '../../../components/Icon';
import {
  count,
  routineStats,
  scheduleLabel,
  SET_KINDS,
  setKindBadge,
  setTarget,
} from '../services/training';
import type { Prescription, TrainingExercise } from '../types/training';
import ExerciseAnimation from './ExerciseAnimation';
import ExerciseDemoModal from './ExerciseDemoModal';
import RoutineWeek from './RoutineWeek';

/** Read-only routine: what the client sees, day by day. */
export default function RoutineView({
  routine,
  initialDay,
}: {
  routine: Prescription;
  initialDay?: number;
}) {
  const firstTraining = Math.max(
    0,
    routine.days.findIndex((d) => d.kind === 'training')
  );
  const [selected, setSelected] = useState(initialDay ?? firstTraining);
  const [prevInitial, setPrevInitial] = useState(initialDay);
  if (initialDay !== prevInitial) {
    setPrevInitial(initialDay);
    if (initialDay !== undefined) setSelected(initialDay);
  }
  const [preview, setPreview] = useState<TrainingExercise | null>(null);
  const day = routine.days[Math.min(selected, routine.days.length - 1)];
  const stats = routineStats(routine);
  const hasDayImages =
    day.kind === 'training' && day.exercises.some((e) => e.images.length > 0);
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
          <Icon name="moon" size={28} />
          <h4>Descanso</h4>
        </div>
      ) : (
        <>
          <h3 className="training-view-title">{day.name}</h3>
          <ol className="training-view-list">
            {day.exercises.map((e, i) => {
              const hasMediaOrGuidance =
                e.images.length > 0 || e.guidance.length > 0;
              let workNumber = 0;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="ws-plain training-anim-btn"
                    onClick={() => setPreview(e)}
                    aria-label={`Ver demostración y técnica de ${e.name}`}
                    title="Ver demostración y técnica"
                  >
                    <ExerciseAnimation
                      images={e.images}
                      name={e.name}
                      size={72}
                    />
                    {e.images.length > 0 && (
                      <span className="training-anim-zoom" aria-hidden="true">
                        <Icon name="arrow-up-right" size={12} />
                      </span>
                    )}
                  </button>
                  <div className="training-view-body">
                    <div className="training-view-head">
                      <strong>
                        {i + 1}. {e.name}
                      </strong>
                      {hasMediaOrGuidance ? (
                        <button
                          type="button"
                          className="ws-plain training-link-btn"
                          onClick={() => setPreview(e)}
                        >
                          Ver GIF y técnica
                        </button>
                      ) : (
                        !e.catalogId && (
                          <span className="training-custom-pill">
                            Personalizado · sin GIF
                          </span>
                        )
                      )}
                    </div>
                    <small>
                      {e.loadMode === 'bodyweight'
                        ? 'Peso corporal'
                        : 'Con peso'}
                      {e.restSeconds !== null &&
                        ` · descanso ${e.restSeconds} s`}
                    </small>
                    {e.instructions && <em>{e.instructions}</em>}
                    <ul className="training-view-sets">
                      {e.sets.map((s) => {
                        if (s.kind !== 'warmup') workNumber++;
                        const label = setTarget(s, {
                          loadMode: e.loadMode,
                          includeKind: false,
                        });
                        return (
                          <li key={s.id}>
                            <span
                              className="training-set-badge"
                              data-kind={s.kind}
                              title={SET_KINDS[s.kind].label}
                            >
                              {setKindBadge(s.kind, workNumber)}
                            </span>
                            <span>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
          {hasDayImages && (
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
          )}
        </>
      )}
      <details className="training-view-week">
        <summary>Ver toda la semana de un vistazo</summary>
        <RoutineWeek
          routine={routine}
          onSelectDay={(index) => setSelected(index)}
        />
      </details>
      {preview && (
        <ExerciseDemoModal
          exercise={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

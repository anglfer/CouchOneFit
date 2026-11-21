import { count } from '../services/training';
import type { Prescription } from '../types/training';

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const fullWeekdays = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];
/** Read-only day strip: what each day of the routine contains. */
export default function RoutineWeek({
  routine,
  compact = false,
  onSelectDay,
}: {
  routine: Prescription;
  compact?: boolean;
  onSelectDay?: (index: number) => void;
}) {
  return (
    <ol
      className="training-week"
      data-compact={compact || undefined}
      data-weekly={routine.schedule === 'weekly' || undefined}
    >
      {routine.days.map((day, i) => {
        const label =
          routine.schedule === 'weekly'
            ? weekdays[i]
            : routine.schedule === 'calendar' && day.date
              ? new Date(`${day.date}T12:00:00Z`).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })
              : `Día ${i + 1}`;
        const name = day.name.trim().toLowerCase();
        // A default name ("Lunes" under LUN, "Día 2" under DÍA 2) adds nothing.
        const custom =
          name &&
          name !== label.toLowerCase() &&
          !(routine.schedule === 'weekly' && name === fullWeekdays[i]);
        const inner = (
          <>
            <span className="training-week-label">{label}</span>
            {compact ? (
              // Tiny cells: a number (or a dash for rest) reads better than cut words.
              <small>
                <span aria-hidden="true">
                  {day.kind === 'rest' ? '—' : day.exercises.length}
                </span>
                <span className="sr-only">
                  {day.kind === 'rest'
                    ? 'descanso'
                    : count(day.exercises.length, 'ejercicio')}
                </span>
              </small>
            ) : day.kind === 'rest' ? (
              routine.schedule === 'weekly' ? (
                // The wide week squeezes rest days; a dash reads better than "Desca…".
                <strong>
                  <span className="sm:sr-only">Descanso</span>
                  <span aria-hidden="true" className="hidden sm:inline">
                    —
                  </span>
                </strong>
              ) : (
                <strong>Descanso</strong>
              )
            ) : (
              custom && <strong>{day.name}</strong>
            )}
            {!compact &&
              day.kind === 'training' &&
              (day.exercises.length ? (
                <ul>
                  {day.exercises.map((e) => (
                    <li key={e.id}>
                      {e.name} <small>· {e.sets.length}×</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <small>Sin ejercicios</small>
              ))}
          </>
        );
        return (
          <li key={day.id} data-kind={day.kind}>
            {onSelectDay ? (
              <button
                type="button"
                className="ws-plain training-week-btn"
                onClick={() => onSelectDay(i)}
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}

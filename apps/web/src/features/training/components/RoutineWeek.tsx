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
}: {
  routine: Prescription;
  compact?: boolean;
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
        return (
          <li key={day.id} data-kind={day.kind}>
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
              <strong>Descanso</strong>
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
          </li>
        );
      })}
    </ol>
  );
}

import type { Prescription } from '../types/training';

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
/** Read-only day strip: what each day of the routine contains. */
export default function RoutineWeek({
  routine,
  compact = false,
}: {
  routine: Prescription;
  compact?: boolean;
}) {
  return (
    <ol className="training-week" data-compact={compact || undefined}>
      {routine.days.map((day, i) => (
        <li key={day.id} data-kind={day.kind}>
          <span className="training-week-label">
            {routine.schedule === 'weekly'
              ? weekdays[i]
              : routine.schedule === 'calendar' && day.date
                ? new Date(`${day.date}T12:00:00Z`).toLocaleDateString(
                    'es-MX',
                    { day: 'numeric', month: 'short', timeZone: 'UTC' }
                  )
                : `Día ${i + 1}`}
          </span>
          <strong>{day.kind === 'rest' ? 'Descanso' : day.name}</strong>
          {!compact && day.kind === 'training' && (
            <ul>
              {day.exercises.map((e) => (
                <li key={e.id}>
                  {e.name} <small>· {e.sets.length}×</small>
                </li>
              ))}
            </ul>
          )}
          {compact && day.kind === 'training' && (
            <small>{day.exercises.length} ejerc.</small>
          )}
        </li>
      ))}
    </ol>
  );
}

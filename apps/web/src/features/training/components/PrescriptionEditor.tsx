import { useState } from 'react';
import { Icon } from '../../../components/Icon';
import type { Prescription, TrainingExercise } from '../types/training';
import {
  clonePrescription,
  setTarget,
  type CatalogExercise,
} from '../services/training';
import ExercisePicker from './ExercisePicker';
import ExerciseAnimation from './ExerciseAnimation';

// Blank optional inputs mean "not prescribed", never zero.
const optionalNumber = (input: HTMLInputElement) =>
  input.value === '' ? null : input.valueAsNumber;
const weekdays = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
const isoPlus = (start: string, days: number) =>
  new Date(Date.parse(start + 'T12:00:00Z') + days * 86400000)
    .toISOString()
    .slice(0, 10);

function exerciseSummary(e: TrainingExercise) {
  const targets = new Set(e.sets.map(setTarget));
  return targets.size === 1
    ? `${e.sets.length} × ${[...targets][0]}`
    : `${e.sets.length} series`;
}

export default function PrescriptionEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: Prescription;
  onChange: (p: Prescription) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState(0),
    [picker, setPicker] = useState(false);
  const index = Math.min(selected, value.days.length - 1),
    day = value.days[index];
  const change = (work: (p: Prescription) => void) => {
    const copy = structuredClone(value);
    work(copy);
    onChange(copy);
  };
  const changeDay = (work: (d: Prescription['days'][number]) => void) =>
    change((p) => work(p.days[index]));
  const dayLabel = (i: number) =>
    value.schedule === 'weekly'
      ? weekdays[i]
      : value.schedule === 'calendar' && value.days[i].date
        ? new Date(`${value.days[i].date}T12:00:00Z`).toLocaleDateString(
            'es-MX',
            {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            }
          )
        : `Día ${i + 1}`;
  function addExercise(source?: CatalogExercise) {
    const exercise: TrainingExercise = {
      id: crypto.randomUUID(),
      catalogId: source?.id ?? null,
      name: source?.name ?? 'Ejercicio propio',
      instructions: '',
      guidance: source?.guidance ?? [],
      images: source?.images ?? [],
      loadMode: source?.equipment.length === 0 ? 'bodyweight' : 'external',
      restSeconds: 90,
      sets: [0, 1, 2].map(() => ({
        id: crypto.randomUUID(),
        reps: 8,
        repsMax: 12,
        rpe: 8,
        rir: null,
        targetLoadKg: null,
      })),
    };
    changeDay((d) => {
      d.kind = 'training';
      d.exercises.push(exercise);
    });
  }
  const copyDay = () => clonePrescription({ ...value, days: [day] }).days[0];
  return (
    <fieldset className="training-editor" disabled={disabled}>
      <section className="training-panel">
        <h3 className="training-panel-title">Datos de la rutina</h3>
        <div className="training-fields">
          <label className="training-span-2">
            Nombre
            <input
              required
              maxLength={150}
              value={value.name}
              placeholder="Ej. Fuerza 4 días"
              onChange={(e) =>
                change((p) => {
                  p.name = e.target.value;
                })
              }
            />
          </label>
          <label>
            Cómo se repite
            <select
              value={value.schedule}
              onChange={(e) => {
                const schedule = e.target.value as Prescription['schedule'];
                if (
                  value.days.length > 7 &&
                  schedule === 'weekly' &&
                  !window.confirm(
                    'La semana usa siete días. Se conservarán los primeros siete.'
                  )
                )
                  return;
                change((p) => {
                  p.schedule = schedule;
                  if (schedule === 'weekly') {
                    p.days = p.days.slice(0, 7);
                    while (p.days.length < 7)
                      p.days.push({
                        id: crypto.randomUUID(),
                        name: weekdays[p.days.length],
                        kind: 'rest',
                        date: null,
                        exercises: [],
                      });
                  }
                  p.days.forEach((d, i) => {
                    d.date =
                      schedule === 'calendar' ? isoPlus(p.startDate, i) : null;
                  });
                });
              }}
            >
              <option value="weekly">Cada semana (lunes a domingo)</option>
              <option value="cycle">Ciclo de días (Día 1, Día 2…)</option>
              <option value="calendar">Fechas concretas</option>
            </select>
          </label>
          <label>
            Empieza el
            <input
              required
              type="date"
              value={value.startDate}
              onChange={(e) =>
                change((p) => {
                  p.startDate = e.target.value;
                })
              }
            />
          </label>
        </div>
      </section>

      <div className="training-days" role="tablist" aria-label="Días">
        {value.days.map((d, i) => (
          <button
            type="button"
            role="tab"
            key={d.id}
            className="ws-plain training-day"
            data-kind={d.kind}
            aria-selected={index === i}
            onClick={() => setSelected(i)}
          >
            <span>{dayLabel(i)}</span>
            <strong>{d.kind === 'rest' ? 'Descanso' : d.name}</strong>
            <small>
              {d.kind === 'rest'
                ? '—'
                : `${d.exercises.length} ejercicio${d.exercises.length === 1 ? '' : 's'}`}
            </small>
          </button>
        ))}
        {value.schedule !== 'weekly' && (
          <button
            type="button"
            className="ws-plain training-day training-day-add"
            disabled={
              value.days.length >= (value.schedule === 'calendar' ? 366 : 28)
            }
            onClick={() =>
              change((p) => {
                p.days.push({
                  id: crypto.randomUUID(),
                  name: `Día ${p.days.length + 1}`,
                  kind: 'training',
                  date:
                    p.schedule === 'calendar'
                      ? isoPlus(p.startDate, p.days.length)
                      : null,
                  exercises: [],
                });
                setSelected(p.days.length - 1);
              })
            }
          >
            <Icon name="plus" size={18} />
            <strong>Añadir día</strong>
          </button>
        )}
      </div>

      {day && (
        <section className="training-panel">
          <div className="training-day-head">
            <label className="training-day-name">
              <span className="sr-only">Nombre del día</span>
              <input
                required
                maxLength={100}
                value={day.name}
                onChange={(e) =>
                  changeDay((d) => {
                    d.name = e.target.value;
                  })
                }
              />
            </label>
            <div
              className="training-segmented"
              role="group"
              aria-label="Tipo de día"
            >
              {(['training', 'rest'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={day.kind === kind}
                  onClick={() => {
                    if (
                      kind === 'rest' &&
                      day.exercises.length &&
                      !window.confirm(
                        'Marcar descanso quitará los ejercicios de este día.'
                      )
                    )
                      return;
                    changeDay((d) => {
                      d.kind = kind;
                      if (kind === 'rest') d.exercises = [];
                    });
                  }}
                >
                  {kind === 'training' ? 'Entrenamiento' : 'Descanso'}
                </button>
              ))}
            </div>
          </div>
          <div className="training-day-tools">
            {value.schedule === 'calendar' && (
              <label>
                Fecha
                <input
                  required
                  type="date"
                  value={day.date ?? ''}
                  onChange={(e) =>
                    changeDay((d) => {
                      d.date = e.target.value;
                    })
                  }
                />
              </label>
            )}
            {value.schedule === 'weekly' ? (
              day.kind === 'training' && (
                <label>
                  Copiar este día a
                  <select
                    value=""
                    onChange={(e) => {
                      const to = Number(e.target.value);
                      if (
                        window.confirm(
                          `¿Sustituir ${weekdays[to].toLowerCase()} por una copia de este día?`
                        )
                      )
                        change((p) => {
                          const copy = copyDay();
                          copy.name = day.name;
                          p.days[to] = copy;
                        });
                    }}
                  >
                    <option value="">Elige un día…</option>
                    {value.days.map(
                      (d, i) =>
                        i !== index && (
                          <option key={d.id} value={i}>
                            {weekdays[i]}
                          </option>
                        )
                    )}
                  </select>
                </label>
              )
            ) : (
              <div className="training-actions">
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() =>
                    change((p) => {
                      const copy = copyDay();
                      copy.name += ' (copia)';
                      if (p.schedule === 'calendar')
                        copy.date = isoPlus(p.startDate, p.days.length);
                      p.days.push(copy);
                      setSelected(p.days.length - 1);
                    })
                  }
                >
                  Duplicar día
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  data-variant="danger"
                  disabled={value.days.length === 1}
                  onClick={() => {
                    if (window.confirm('¿Quitar este día de la rutina?'))
                      change((p) => {
                        p.days.splice(index, 1);
                        setSelected(Math.max(0, index - 1));
                      });
                  }}
                >
                  Quitar día
                </button>
              </div>
            )}
          </div>

          {day.kind === 'rest' ? (
            <div className="training-rest">
              <span aria-hidden="true">☾</span>
              <h4>Día de descanso</h4>
              <p>El cliente verá que hoy toca recuperarse. No hay series.</p>
            </div>
          ) : (
            <>
              {day.exercises.length === 0 && (
                <div className="training-rest">
                  <Icon name="dumbbell" size={28} />
                  <h4>Aún no hay ejercicios</h4>
                  <p>Añade ejercicios del catálogo o crea uno propio.</p>
                </div>
              )}
              <ol className="training-exercises">
                {day.exercises.map((exercise, ei) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    order={ei}
                    last={ei === day.exercises.length - 1}
                    onChange={(work) => changeDay((d) => work(d.exercises[ei]))}
                    onMove={(delta) =>
                      changeDay((d) => {
                        const [item] = d.exercises.splice(ei, 1);
                        d.exercises.splice(ei + delta, 0, item);
                      })
                    }
                    onDuplicate={() =>
                      changeDay((d) => {
                        const copy = structuredClone(exercise);
                        copy.id = crypto.randomUUID();
                        copy.sets.forEach((s) => {
                          s.id = crypto.randomUUID();
                        });
                        d.exercises.splice(ei + 1, 0, copy);
                      })
                    }
                    onRemove={() => {
                      if (window.confirm(`¿Quitar ${exercise.name}?`))
                        changeDay((d) => {
                          d.exercises.splice(ei, 1);
                        });
                    }}
                  />
                ))}
              </ol>
              <button
                type="button"
                className="ws-plain training-add-exercise"
                disabled={day.exercises.length >= 40}
                onClick={() => setPicker(true)}
              >
                <Icon name="plus" size={18} /> Añadir ejercicios
              </button>
            </>
          )}
        </section>
      )}
      {picker && !disabled && (
        <ExercisePicker
          onSelect={addExercise}
          onCustom={() => addExercise()}
          onClose={() => setPicker(false)}
        />
      )}
    </fieldset>
  );
}

function ExerciseCard({
  exercise,
  order,
  last,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  exercise: TrainingExercise;
  order: number;
  last: boolean;
  onChange: (work: (e: TrainingExercise) => void) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const setField = (
    si: number,
    key: 'reps' | 'repsMax' | 'rpe' | 'rir' | 'targetLoadKg',
    input: HTMLInputElement
  ) =>
    onChange((e) => {
      e.sets[si][key] = (
        key === 'reps' ? input.valueAsNumber : optionalNumber(input)
      ) as never;
    });
  const bodyweight = exercise.loadMode === 'bodyweight';
  return (
    <li className="training-exercise">
      <header className="training-exercise-head">
        <span className="training-order">{order + 1}</span>
        <ExerciseAnimation
          images={exercise.images}
          name={exercise.name}
          size={64}
        />
        <button
          type="button"
          className="ws-plain training-exercise-title"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <strong>{exercise.name}</strong>
          <small>
            {exerciseSummary(exercise)}
            {exercise.restSeconds !== null &&
              ` · descanso ${exercise.restSeconds} s`}
          </small>
        </button>
        <div className="training-icon-row">
          <button
            type="button"
            className="ws-plain training-icon-btn"
            disabled={order === 0}
            aria-label={`Subir ${exercise.name}`}
            title="Subir"
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="ws-plain training-icon-btn"
            disabled={last}
            aria-label={`Bajar ${exercise.name}`}
            title="Bajar"
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="ws-plain training-icon-btn"
            aria-label={`Duplicar ${exercise.name}`}
            title="Duplicar"
            onClick={onDuplicate}
          >
            ⧉
          </button>
          <button
            type="button"
            className="ws-plain training-icon-btn"
            data-danger
            aria-label={`Quitar ${exercise.name}`}
            title="Quitar"
            onClick={onRemove}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>
      {open && (
        <div className="training-exercise-body">
          <div className="training-fields">
            {!exercise.catalogId && (
              <label className="training-span-2">
                Nombre del ejercicio
                <input
                  required
                  value={exercise.name}
                  maxLength={150}
                  onChange={(e) =>
                    onChange((x) => {
                      x.name = e.target.value;
                    })
                  }
                />
              </label>
            )}
            <label>
              Carga
              <select
                value={exercise.loadMode}
                onChange={(e) =>
                  onChange((x) => {
                    x.loadMode = e.target.value as TrainingExercise['loadMode'];
                    x.sets.forEach((s) => {
                      s.targetLoadKg = null;
                    });
                  })
                }
              >
                <option value="external">Con peso (kg)</option>
                <option value="bodyweight">Peso corporal</option>
              </select>
            </label>
            <label>
              Descanso entre series (s)
              <input
                type="number"
                min={0}
                max={900}
                step={5}
                placeholder="Opcional"
                value={exercise.restSeconds ?? ''}
                onChange={(e) =>
                  onChange((x) => {
                    x.restSeconds = optionalNumber(e.target);
                  })
                }
              />
            </label>
            <label className="training-span-2">
              Indicaciones para el cliente
              <input
                maxLength={500}
                placeholder="Opcional · ej. controla la bajada en 3 segundos"
                value={exercise.instructions}
                onChange={(e) =>
                  onChange((x) => {
                    x.instructions = e.target.value;
                  })
                }
              />
            </label>
          </div>
          <div className="training-table-scroll">
            <table className="training-sets">
              <caption className="sr-only">Series de {exercise.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Serie</th>
                  <th scope="col">Reps</th>
                  <th scope="col" title="Déjalo vacío para reps fijas">
                    Hasta
                  </th>
                  <th scope="col" title="Esfuerzo percibido 1–10">
                    RPE
                  </th>
                  <th scope="col" title="Repeticiones en reserva">
                    RIR
                  </th>
                  {!bodyweight && <th scope="col">Kg objetivo</th>}
                  <th scope="col">
                    <span className="sr-only">Quitar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {exercise.sets.map((s, si) => (
                  <tr key={s.id}>
                    <th scope="row">{si + 1}</th>
                    <td>
                      <input
                        aria-label={`Repeticiones serie ${si + 1}`}
                        type="number"
                        required
                        min={1}
                        max={100}
                        value={Number.isFinite(s.reps) ? s.reps : ''}
                        onChange={(e) => setField(si, 'reps', e.target)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Repeticiones máximas serie ${si + 1}`}
                        type="number"
                        min={Number.isFinite(s.reps) ? s.reps : 1}
                        max={100}
                        placeholder="—"
                        value={s.repsMax ?? ''}
                        onChange={(e) => setField(si, 'repsMax', e.target)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RPE serie ${si + 1}`}
                        type="number"
                        min={1}
                        max={10}
                        step={0.5}
                        placeholder="—"
                        value={s.rpe ?? ''}
                        onChange={(e) => setField(si, 'rpe', e.target)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`RIR serie ${si + 1}`}
                        type="number"
                        min={0}
                        max={10}
                        placeholder="—"
                        value={s.rir ?? ''}
                        onChange={(e) => setField(si, 'rir', e.target)}
                      />
                    </td>
                    {!bodyweight && (
                      <td>
                        <input
                          aria-label={`Carga objetivo serie ${si + 1}`}
                          type="number"
                          min={0.1}
                          max={1000}
                          step={0.1}
                          placeholder="—"
                          value={s.targetLoadKg ?? ''}
                          onChange={(e) =>
                            setField(si, 'targetLoadKg', e.target)
                          }
                        />
                      </td>
                    )}
                    <td>
                      <button
                        type="button"
                        className="ws-plain training-icon-btn"
                        disabled={exercise.sets.length === 1}
                        aria-label={`Quitar serie ${si + 1}`}
                        onClick={() =>
                          onChange((x) => {
                            x.sets.splice(si, 1);
                          })
                        }
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="training-actions">
            <button
              type="button"
              className="ws-btn"
              disabled={exercise.sets.length >= 20}
              onClick={() =>
                onChange((x) => {
                  x.sets.push({ ...x.sets.at(-1)!, id: crypto.randomUUID() });
                })
              }
            >
              <Icon name="plus" size={16} /> Serie
            </button>
            {exercise.sets.length > 1 && (
              <button
                type="button"
                className="ws-btn"
                onClick={() =>
                  onChange((x) => {
                    x.sets = x.sets.map((s) => ({ ...x.sets[0], id: s.id }));
                  })
                }
              >
                Igualar a la serie 1
              </button>
            )}
            <small>Vacío = no se prescribe. RPE y RIR son opcionales.</small>
          </div>
        </div>
      )}
    </li>
  );
}

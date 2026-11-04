import { useState } from 'react';
import type { Prescription, TrainingExercise } from '../types/training';
import { clonePrescription, type CatalogExercise } from '../services/training';
import ExercisePicker from './ExercisePicker';
import ExerciseAnimation from './ExerciseAnimation';

// Blank optional inputs mean "not prescribed", never zero.
const optionalNumber = (input: HTMLInputElement) =>
  input.value === '' ? null : input.valueAsNumber;

export default function PrescriptionEditor({
  value,
  onChange,
  readOnly = false,
}: {
  value: Prescription;
  onChange: (p: Prescription) => void;
  readOnly?: boolean;
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
  function addExercise(source?: CatalogExercise) {
    const exercise: TrainingExercise = {
      id: crypto.randomUUID(),
      catalogId: source?.id ?? null,
      name: source?.name ?? 'Ejercicio personalizado',
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
    setPicker(false);
  }
  const copyDay = () => clonePrescription({ ...value, days: [day] }).days[0];
  return (
    <div className="training-editor">
      <fieldset disabled={readOnly}>
        <div className="training-fields">
          <label>
            Nombre de la rutina
            <input
              required
              maxLength={150}
              value={value.name}
              onChange={(e) =>
                change((p) => {
                  p.name = e.target.value;
                })
              }
            />
          </label>
          <label>
            Programación
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
                        name: `Día ${p.days.length + 1}`,
                        kind: 'rest',
                        date: null,
                        exercises: [],
                      });
                  }
                  p.days.forEach((d, i) => {
                    d.date =
                      schedule === 'calendar'
                        ? new Date(
                            Date.parse(p.startDate + 'T12:00:00Z') +
                              i * 86400000
                          )
                            .toISOString()
                            .slice(0, 10)
                        : null;
                  });
                });
              }}
            >
              <option value="weekly">Semana fija · lunes a domingo</option>
              <option value="cycle">Ciclo de días</option>
              <option value="calendar">Calendario por fechas</option>
            </select>
          </label>
          <label>
            Fecha inicial
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
      </fieldset>
      <div className="training-days" aria-label="Días de la rutina">
        {value.days.map((d, i) => (
          <button
            type="button"
            key={d.id}
            className="training-day"
            aria-pressed={index === i}
            onClick={() => {
              setSelected(i);
              setPicker(false);
            }}
          >
            <span>
              {value.schedule === 'weekly'
                ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i]
                : (d.date ?? `Día ${i + 1}`)}
            </span>
            <strong>{d.name}</strong>
            <small>
              {d.kind === 'rest'
                ? 'Descanso'
                : `${d.exercises.length} ejercicios`}
            </small>
          </button>
        ))}
      </div>
      {day && (
        <>
          <fieldset disabled={readOnly}>
            <div className="training-fields">
              <label>
                Nombre del día
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
              <label>
                Tipo de día
                <select
                  value={day.kind}
                  onChange={(e) => {
                    if (
                      e.target.value === 'rest' &&
                      day.exercises.length &&
                      !window.confirm(
                        'Marcar descanso quitará los ejercicios de este borrador.'
                      )
                    )
                      return;
                    changeDay((d) => {
                      d.kind = e.target.value as 'training' | 'rest';
                      if (d.kind === 'rest') d.exercises = [];
                    });
                  }}
                >
                  <option value="rest">Descanso</option>
                  <option value="training">Entrenamiento</option>
                </select>
              </label>
            </div>
            {!readOnly && (
              <div className="training-row">
                {value.schedule === 'weekly' ? (
                  <label>
                    Copiar este día a
                    <select
                      value=""
                      onChange={(e) => {
                        const to = Number(e.target.value);
                        if (
                          window.confirm(
                            '¿Sustituir los ejercicios del día elegido en este borrador?'
                          )
                        )
                          change((p) => {
                            const copy = copyDay();
                            copy.name = p.days[to].name;
                            p.days[to] = copy;
                          });
                      }}
                    >
                      <option value="">Selecciona un día</option>
                      {value.days.map(
                        (d, i) =>
                          i !== index && (
                            <option key={d.id} value={i}>
                              {
                                [
                                  'Lunes',
                                  'Martes',
                                  'Miércoles',
                                  'Jueves',
                                  'Viernes',
                                  'Sábado',
                                  'Domingo',
                                ][i]
                              }
                            </option>
                          )
                      )}
                    </select>
                  </label>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ws-btn"
                      onClick={() =>
                        change((p) => {
                          const copy = copyDay();
                          copy.name += ' (copia)';
                          if (p.schedule === 'calendar') copy.date = '';
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
                      disabled={value.days.length === 1}
                      onClick={() => {
                        if (window.confirm('¿Quitar este día del borrador?'))
                          change((p) => {
                            p.days.splice(index, 1);
                            setSelected(0);
                          });
                      }}
                    >
                      Quitar día
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      onClick={() =>
                        change((p) => {
                          p.days.push({
                            id: crypto.randomUUID(),
                            name: `Día ${p.days.length + 1}`,
                            kind: 'rest',
                            date: p.schedule === 'calendar' ? '' : null,
                            exercises: [],
                          });
                          setSelected(p.days.length - 1);
                        })
                      }
                    >
                      Añadir día
                    </button>
                  </>
                )}
              </div>
            )}
            {day.kind === 'rest' ? (
              <div className="training-rest">
                <span aria-hidden="true">☾</span>
                <h3>Descanso programado</h3>
                <p>Este día no requiere registrar series.</p>
              </div>
            ) : (
              <>
                {day.exercises.map((exercise, ei) => (
                  <article
                    key={exercise.id}
                    className="training-exercise ws-card"
                  >
                    <div className="training-row">
                      <div className="training-exercise-heading">
                        <span className="training-order">{ei + 1}</span>
                        <div>
                          <h3>{exercise.name}</h3>
                          <small>
                            {exercise.sets.length} series ·{' '}
                            {exercise.loadMode === 'bodyweight'
                              ? 'Peso corporal'
                              : 'Carga externa'}
                            {exercise.restSeconds !== null &&
                              ` · descanso ${exercise.restSeconds} s`}
                          </small>
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="training-actions">
                          <button
                            type="button"
                            className="ws-btn"
                            disabled={ei === 0}
                            aria-label={`Subir ${exercise.name}`}
                            onClick={() =>
                              changeDay((d) => {
                                [d.exercises[ei - 1], d.exercises[ei]] = [
                                  d.exercises[ei],
                                  d.exercises[ei - 1],
                                ];
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="ws-btn"
                            disabled={ei === day.exercises.length - 1}
                            aria-label={`Bajar ${exercise.name}`}
                            onClick={() =>
                              changeDay((d) => {
                                [d.exercises[ei], d.exercises[ei + 1]] = [
                                  d.exercises[ei + 1],
                                  d.exercises[ei],
                                ];
                              })
                            }
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="ws-btn"
                            onClick={() =>
                              changeDay((d) => {
                                const copy = structuredClone(exercise);
                                copy.id = crypto.randomUUID();
                                copy.sets.forEach((s) => {
                                  s.id = crypto.randomUUID();
                                });
                                d.exercises.splice(ei + 1, 0, copy);
                              })
                            }
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className="ws-btn"
                            onClick={() => {
                              if (
                                window.confirm(
                                  '¿Quitar este ejercicio del borrador?'
                                )
                              )
                                changeDay((d) => {
                                  d.exercises.splice(ei, 1);
                                });
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="training-exercise-body">
                      <div>
                        <ExerciseAnimation
                          images={exercise.images}
                          name={exercise.name}
                        />
                        {exercise.guidance.length > 0 && (
                          <details>
                            <summary>Instrucciones del catálogo</summary>
                            <ol>
                              {exercise.guidance.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ol>
                          </details>
                        )}
                      </div>
                      <div>
                        <div className="training-fields">
                          {!exercise.catalogId && (
                            <label>
                              Ejercicio
                              <input
                                required
                                value={exercise.name}
                                maxLength={150}
                                onChange={(e) =>
                                  changeDay((d) => {
                                    d.exercises[ei].name = e.target.value;
                                  })
                                }
                              />
                            </label>
                          )}
                          <label>
                            Modalidad de carga
                            <select
                              value={exercise.loadMode}
                              onChange={(e) =>
                                changeDay((d) => {
                                  d.exercises[ei].loadMode = e.target
                                    .value as TrainingExercise['loadMode'];
                                  d.exercises[ei].sets.forEach((s) => {
                                    s.targetLoadKg = null;
                                  });
                                })
                              }
                            >
                              <option value="external">Externa · kg</option>
                              <option value="bodyweight">
                                Corporal · 0 kg de carga externa
                              </option>
                            </select>
                          </label>
                          <label>
                            Descanso entre series (s) · opcional
                            <input
                              type="number"
                              min={0}
                              max={900}
                              step={5}
                              placeholder="Sin definir"
                              value={exercise.restSeconds ?? ''}
                              onChange={(e) =>
                                changeDay((d) => {
                                  d.exercises[ei].restSeconds = optionalNumber(
                                    e.target
                                  );
                                })
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Indicaciones del profesional
                          <textarea
                            maxLength={500}
                            value={exercise.instructions}
                            onChange={(e) =>
                              changeDay((d) => {
                                d.exercises[ei].instructions = e.target.value;
                              })
                            }
                          />
                        </label>
                        <div className="training-table-scroll">
                          <table>
                            <caption>
                              Parámetros por serie · deja vacío lo que no
                              quieras prescribir
                            </caption>
                            <thead>
                              <tr>
                                <th>Serie</th>
                                <th>Reps</th>
                                <th>Hasta (rango)</th>
                                <th>RPE</th>
                                <th>RIR</th>
                                <th>Carga objetivo (kg)</th>
                                {!readOnly && <th>Acción</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {exercise.sets.map((s, si) => (
                                <tr key={s.id}>
                                  <th>{si + 1}</th>
                                  <td>
                                    <input
                                      aria-label={`Repeticiones serie ${si + 1} de ${exercise.name}`}
                                      type="number"
                                      required
                                      min={1}
                                      max={100}
                                      step={1}
                                      value={
                                        Number.isFinite(s.reps) ? s.reps : ''
                                      }
                                      onChange={(e) =>
                                        changeDay((d) => {
                                          d.exercises[ei].sets[si].reps =
                                            e.target.valueAsNumber;
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      aria-label={`Repeticiones máximas serie ${si + 1} de ${exercise.name}`}
                                      type="number"
                                      min={Number.isFinite(s.reps) ? s.reps : 1}
                                      max={100}
                                      step={1}
                                      placeholder="Fijas"
                                      value={s.repsMax ?? ''}
                                      onChange={(e) =>
                                        changeDay((d) => {
                                          d.exercises[ei].sets[si].repsMax =
                                            optionalNumber(e.target);
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      aria-label={`RPE serie ${si + 1} de ${exercise.name}`}
                                      type="number"
                                      min={1}
                                      max={10}
                                      step={0.5}
                                      placeholder="—"
                                      value={s.rpe ?? ''}
                                      onChange={(e) =>
                                        changeDay((d) => {
                                          d.exercises[ei].sets[si].rpe =
                                            optionalNumber(e.target);
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      aria-label={`RIR serie ${si + 1} de ${exercise.name}`}
                                      type="number"
                                      min={0}
                                      max={10}
                                      step={1}
                                      placeholder="—"
                                      value={s.rir ?? ''}
                                      onChange={(e) =>
                                        changeDay((d) => {
                                          d.exercises[ei].sets[si].rir =
                                            optionalNumber(e.target);
                                        })
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      aria-label={`Carga objetivo serie ${si + 1} de ${exercise.name}`}
                                      type="number"
                                      min={
                                        exercise.loadMode === 'bodyweight'
                                          ? 0
                                          : 0.1
                                      }
                                      max={
                                        exercise.loadMode === 'bodyweight'
                                          ? 0
                                          : 1000
                                      }
                                      step={0.1}
                                      placeholder="Sin definir"
                                      value={s.targetLoadKg ?? ''}
                                      onChange={(e) =>
                                        changeDay((d) => {
                                          d.exercises[ei].sets[
                                            si
                                          ].targetLoadKg = optionalNumber(
                                            e.target
                                          );
                                        })
                                      }
                                    />
                                  </td>
                                  {!readOnly && (
                                    <td>
                                      <button
                                        type="button"
                                        className="ws-btn"
                                        disabled={exercise.sets.length === 1}
                                        aria-label={`Quitar serie ${si + 1}`}
                                        onClick={() =>
                                          changeDay((d) => {
                                            d.exercises[ei].sets.splice(si, 1);
                                          })
                                        }
                                      >
                                        Quitar
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {!readOnly && (
                          <div className="training-actions">
                            <button
                              type="button"
                              className="ws-btn"
                              disabled={exercise.sets.length >= 20}
                              onClick={() =>
                                changeDay((d) => {
                                  d.exercises[ei].sets.push({
                                    ...exercise.sets.at(-1)!,
                                    id: crypto.randomUUID(),
                                  });
                                })
                              }
                            >
                              Añadir serie
                            </button>
                            <button
                              type="button"
                              className="ws-btn"
                              onClick={() =>
                                changeDay((d) => {
                                  d.exercises[ei].sets = d.exercises[
                                    ei
                                  ].sets.map((s) => ({
                                    ...exercise.sets[0],
                                    id: s.id,
                                  }));
                                })
                              }
                            >
                              Aplicar primera serie a todas
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                {!readOnly && (
                  <div className="training-actions">
                    <button
                      type="button"
                      className="ws-btn"
                      data-variant="primary"
                      onClick={() => setPicker(true)}
                    >
                      Elegir del catálogo
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      onClick={() => addExercise()}
                    >
                      Ejercicio personalizado
                    </button>
                  </div>
                )}
                {day.exercises.length === 0 && (
                  <p>
                    Selecciona al menos un ejercicio para guardar este día de
                    entrenamiento.
                  </p>
                )}
              </>
            )}
          </fieldset>
          {picker && !readOnly && (
            <ExercisePicker
              onSelect={addExercise}
              onClose={() => setPicker(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

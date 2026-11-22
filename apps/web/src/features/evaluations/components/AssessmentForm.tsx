import { candidateSkinfolds } from '../types/estimation';
import { useOperations } from '../../../hooks/useOperations';
import { guardNavigation } from '../../../utils/navigation';
import { Link } from '../../../components/Link';
import { Icon } from '../../../components/Icon';
import { isConnectionFailure } from '../../../services/offline/connection';
import type { Operation } from '../../../services/offline/outbox';
import type { Evaluation } from '../types/evaluation';
import { confirmDialog } from '../../../services/confirm';
import { useState, useRef, useEffect } from 'react';
import { ApiError } from '../../../services/api';
import { createEvaluation } from '../services/evaluations';
import {
  fieldsByMethod,
  measurementFields,
  methods,
  preview,
  skinfoldNote,
  type AssessmentInput,
  type MeasurementField,
  type Method,
} from '../types/assessment';
import CompositionResults from './CompositionResults';
import AnatomicalGuide from './AnatomicalGuide';
/** Completed years at the measurement date (local today when empty). */
function ageOn(birthDate: string | null, date: string): number | null {
  const day = date || new Date().toLocaleDateString('en-CA');
  if (!birthDate || birthDate > day) return null;
  const years = Number(day.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return day.slice(5) < birthDate.slice(5) ? years - 1 : years;
}
export default function AssessmentForm({
  clientId,
  clientName,
  birthDate,
  baseHeightCm = null,
  previousEvaluations = [],
  onSaved,
  onQueued,
  onBusyChange,
}: {
  clientId: string;
  clientName: string;
  birthDate: string | null;
  baseHeightCm?: number | null;
  previousEvaluations?: Evaluation[];
  onSaved: (evaluation: Evaluation) => void;
  onQueued: (operation: Operation) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [method, setMethod] = useState<Method>('perimetros');
  const [drafts, setDrafts] = useState<
    Partial<Record<Method, Record<string, string>>>
  >({});
  const [equation, setEquation] =
    useState<AssessmentInput['equation']>('not_applicable');
  const [date, setDate] = useState('');
  const [active, setActive] = useState<MeasurementField | null>(null);
  const [phase, setPhase] = useState<
    | 'draft'
    | 'validating'
    | 'saving'
    | 'saved'
    | 'queued'
    | 'error'
    | 'migration'
    | 'uncertain'
  >('draft');
  const [operationId, setOperationId] = useState('');
  const [confirmed, setConfirmed] = useState<Evaluation | null>(null);
  const queuedOperation = useOperations().find((o) => o.id === operationId);
  const busy = phase === 'validating' || phase === 'saving';
  const locked = busy || ['saved', 'queued', 'uncertain'].includes(phase);
  const sending = useRef(false);
  const dirty = useRef(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const lastMeasurements = (() => {
    const out: Partial<Record<MeasurementField, number>> = {};
    for (const item of previousEvaluations) {
      for (const key of Object.keys(measurementFields) as MeasurementField[]) {
        if (out[key] !== undefined) continue;
        const fromAssessment = item.assessment?.measurements[key];
        if (typeof fromAssessment === 'number') {
          out[key] = fromAssessment;
          continue;
        }
        const fromLegacy = (item as unknown as Record<string, unknown>)[key];
        if (typeof fromLegacy === 'number') out[key] = fromLegacy;
      }
    }
    return out;
  })();
  const lastSkinfoldEquation: 'male' | 'female' | null =
    previousEvaluations
      .map((item) => item.assessment?.equation)
      .find(
        (eq): eq is 'male' | 'female' => eq === 'male' || eq === 'female'
      ) ?? null;
  useEffect(
    () =>
      guardNavigation(
        async () =>
          !sending.current &&
          (!dirty.current ||
            (await confirmDialog({
              title: '¿Descartar la evaluación sin guardar?',
              message: 'Se perderán los borradores de los métodos.',
              confirmLabel: 'Descartar borrador',
            })))
      ),
    []
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || sending.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [segmentType, setSegmentType] = useState<'muscle_mass' | 'fat_mass'>(
    'muscle_mass'
  );
  const [segments, setSegments] = useState<Record<string, string>>({});
  const draft = drafts[method] ?? {};
  const estimationVariant =
    method === 'pliegues' && equation !== 'not_applicable' ? equation : null;
  const ageYears = ageOn(birthDate, date);
  const requiredSkinfolds: readonly MeasurementField[] = estimationVariant
    ? candidateSkinfolds[estimationVariant]
    : [];
  const measurements = Object.fromEntries(
    Object.entries(draft)
      .filter(([, v]) => v.trim() !== '')
      .map(([k, v]) => [k, Number(v)])
  );
  const body: AssessmentInput = {
    method,
    equation,
    effectiveDate: date || null,
    measurements,
  };
  if (method === 'bioimpedancia' && Object.values(segments).some(Boolean))
    body.segmental = {
      type: segmentType,
      unit: 'kg',
      values: Object.fromEntries(
        Object.entries(segments)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => [k, Number(v)])
      ),
    };
  const results = preview(body, ageYears);
  const fatGap =
    method === 'pliegues'
      ? skinfoldNote(equation, ageYears, measurements)
      : null;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || phase === 'saved' || phase === 'queued') return;
    sending.current = true;
    setPhase('validating');
    setErrors({});
    const validation: Record<string, string> = {};
    for (const key of requiredSkinfolds) {
      if (!(key in measurements))
        validation[key] = 'Este pliegue es obligatorio para la estimación.';
    }
    for (const key of fieldsByMethod[method]) {
      if (!(key in measurements)) continue;
      const n = measurements[key],
        [, , min, max] = measurementFields[key];
      if (
        !Number.isFinite(n) ||
        n < min ||
        (max !== undefined && n > max) ||
        !Number.isInteger(n * 10)
      )
        validation[key] = 'Revisa el rango y usa como máximo un decimal.';
    }
    if (
      requiredSkinfolds.length === 0 &&
      !Object.keys(measurements).some(
        (k) => !['weightKg', 'heightCm'].includes(k)
      )
    )
      validation.form = 'Registra al menos una medición válida del método.';
    if (Object.keys(validation).length) {
      sending.current = false;
      setPhase('error');
      setErrors(validation);
      document
        .getElementById(`assessment-${Object.keys(validation)[0]}`)
        ?.focus();
      return;
    }
    const payload = JSON.stringify(body);
    if (!attempt.current || attempt.current.payload !== payload)
      attempt.current = { payload, id: crypto.randomUUID() };
    setPhase('saving');
    onBusyChange?.(true);
    try {
      const response = await createEvaluation(
        clientId,
        clientName,
        body,
        attempt.current.id
      );
      if (!mounted.current) return;
      dirty.current = false;
      if (response.status === 'queued') {
        setOperationId(response.operation.id);
        setPhase('queued');
        onQueued(response.operation);
      } else {
        setConfirmed(response.result);
        setPhase('saved');
        onSaved(response.result);
      }
    } catch (error) {
      if (!mounted.current) return;
      const uncertain =
        isConnectionFailure(error) ||
        (error instanceof ApiError && error.code === 'IDEMPOTENCY_IN_PROGRESS');
      setPhase(
        error instanceof ApiError &&
          error.code === 'EVALUATION_UPGRADE_REQUIRED'
          ? 'migration'
          : uncertain
            ? 'uncertain'
            : 'error'
      );
      setErrors(
        error instanceof ApiError
          ? { ...error.fields, form: error.message }
          : {
              form: uncertain
                ? 'No hay confirmación del servidor ni se pudo guardar en la cola local. Conservamos la operación para reintentar con la misma clave.'
                : error instanceof Error
                  ? error.message
                  : 'No pudimos guardar.',
            }
      );
    } finally {
      sending.current = false;
      if (mounted.current) onBusyChange?.(false);
    }
  }
  return (
    <form
      aria-label="Registrar evaluación antropométrica"
      noValidate
      onSubmit={(event) => void save(event)}
      onChangeCapture={() => {
        dirty.current = true;
      }}
      aria-busy={busy}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--ws-border-subtle) bg-(--ws-surface-2) px-4 py-2.5 text-xs font-medium">
        <div className="flex flex-wrap items-center gap-2 text-(--ws-muted)">
          <span className="font-semibold text-(--ws-primary-fg)">
            1. Método y fecha
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={
              Object.keys(measurements).length > 0
                ? 'font-semibold text-(--ws-primary-fg)'
                : ''
            }
          >
            2. Mediciones ({Object.keys(measurements).length})
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={
              phase === 'saved' || phase === 'queued'
                ? 'font-semibold text-(--ws-ok-fg)'
                : ''
            }
          >
            3. Revisión y guardado
          </span>
        </div>
        <span className="text-(--ws-muted)">
          {phase === 'saved'
            ? 'Confirmada por el servidor'
            : phase === 'queued'
              ? 'Conservada localmente'
              : 'Borrador de evaluación'}
        </span>
      </div>
      <fieldset disabled={locked}>
        <legend className="font-semibold mb-3">Metodología</legend>
        <div className="grid gap-3 lg:grid-cols-3">
          {methods.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={method === item.id}
              onClick={() => {
                setMethod(item.id);
                if (
                  item.id === 'pliegues' &&
                  equation === 'not_applicable' &&
                  lastSkinfoldEquation
                ) {
                  setEquation(lastSkinfoldEquation);
                }
                setErrors({});
                setActive(null);
              }}
              className={`rounded-lg border p-4 text-left min-h-11 focus-visible:outline-2 ${method === item.id ? 'border-(--ws-primary) bg-(--ws-selected)' : 'border-(--ws-border)'}`}
            >
              <span className="mb-2 flex items-center gap-2">
                <Icon
                  name={
                    item.id === 'perimetros'
                      ? 'clipboard'
                      : item.id === 'pliegues'
                        ? 'layers'
                        : 'monitor'
                  }
                  size={20}
                />
                <strong>{item.label}</strong>
              </span>
              <span className="mt-1 block text-sm text-(--ws-muted)">
                {item.id === 'perimetros'
                  ? 'Mediciones con cinta. ICC e ICE disponibles.'
                  : item.id === 'pliegues'
                    ? 'Sitios medidos con plicómetro.'
                    : 'Transcripción de resultados del equipo.'}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Fecha de la medición (opcional)
          <input
            className="ws-input block w-full min-h-11"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={locked}
          />
          <span className="text-xs text-(--ws-muted)">
            Déjala vacía si mediste hoy.
          </span>
        </label>
        {method === 'pliegues' && (
          <label>
            Ecuación para el % de grasa
            <select
              className="ws-input block w-full min-h-11"
              value={equation}
              aria-describedby="skinfold-equation-notice"
              onChange={(e) => {
                setEquation(e.target.value as AssessmentInput['equation']);
                setErrors({});
              }}
              disabled={locked}
            >
              <option value="not_applicable">Sin % de grasa</option>
              <option value="male">Hombre · pectoral, abdomen y muslo</option>
              <option value="female">
                Mujer · tríceps, suprailiaco y muslo
              </option>
            </select>
            <span
              id="skinfold-equation-notice"
              className="text-xs text-(--ws-muted)"
            >
              {ageYears === null
                ? 'Sin fecha de nacimiento: no se puede calcular la edad.'
                : `Edad a la fecha de medición: ${ageYears} años.`}
            </span>
          </label>
        )}
      </div>
      <p className="text-sm text-(--ws-muted)">
        {estimationVariant
          ? 'Los tres pliegues marcados son obligatorios para calcular el % de grasa.'
          : 'Captura al menos una medición del método.'}{' '}
        Cambiar de método conserva el borrador de cada uno.
      </p>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,25.5rem)]">
        <div className="space-y-4">
          {(() => {
            const renderField = (key: MeasurementField) => {
              const [label, unit, min, max] = measurementFields[key];
              const required = requiredSkinfolds.includes(key);
              const previousValue = lastMeasurements[key];
              const currentValue = draft[key] ?? '';
              const parsedCurrent =
                currentValue.trim() === '' ? NaN : Number(currentValue);
              const liveDelta =
                previousValue !== undefined && Number.isFinite(parsedCurrent)
                  ? Number((parsedCurrent - previousValue).toFixed(1))
                  : null;
              return (
                <label key={key} className="block">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      {label} ({unit}){' '}
                      <span
                        aria-hidden={required || undefined}
                        className={
                          required
                            ? 'text-xs font-semibold text-(--ws-primary-fg)'
                            : 'text-xs text-(--ws-muted)'
                        }
                      >
                        {required ? 'obligatorio' : 'opcional'}
                      </span>
                    </span>
                    {previousValue !== undefined && (
                      <span className="text-xs font-normal text-(--ws-muted) tabular-nums">
                        Última: {previousValue} {unit}
                        {liveDelta !== null && (
                          <span className="ml-1 font-semibold text-(--ws-text-2)">
                            (
                            {liveDelta > 0
                              ? `+${liveDelta}`
                              : liveDelta === 0
                                ? '0'
                                : `−${Math.abs(liveDelta)}`}{' '}
                            {unit})
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <input
                    id={`assessment-${key}`}
                    name={key}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={min}
                    max={max}
                    required={required}
                    value={currentValue}
                    onFocus={() => setActive(key)}
                    onChange={(e) => {
                      setDrafts((current) => ({
                        ...current,
                        [method]: {
                          ...current[method],
                          [key]: e.target.value,
                        },
                      }));
                      setErrors({});
                    }}
                    aria-invalid={!!errors[key]}
                    aria-describedby={
                      errors[key] ? `assessment-error-${key}` : undefined
                    }
                    className="mt-1 block min-h-11 w-full rounded-lg border border-(--ws-border) bg-(--ws-surface) p-2"
                  />
                  {key === 'heightCm' &&
                    baseHeightCm !== null &&
                    !currentValue.trim() && (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          dirty.current = true;
                          setDrafts((current) => ({
                            ...current,
                            [method]: {
                              ...current[method],
                              heightCm: String(baseHeightCm),
                            },
                          }));
                          setErrors({});
                        }}
                        className="mt-1.5 text-xs font-semibold text-(--ws-primary-fg) underline"
                      >
                        Usar estatura del expediente ({baseHeightCm} cm)
                      </button>
                    )}
                  {errors[key] && (
                    <span id={`assessment-error-${key}`} role="alert">
                      {errors[key]}
                    </span>
                  )}
                </label>
              );
            };

            const generalFields = fieldsByMethod[method].filter((k) =>
              ['weightKg', 'heightCm'].includes(k)
            );
            const methodFields = fieldsByMethod[method].filter(
              (k) => !['weightKg', 'heightCm'].includes(k)
            );
            const methodTitle =
              method === 'perimetros'
                ? 'Perímetros · cinta métrica'
                : method === 'pliegues'
                  ? 'Pliegues · plicómetro'
                  : 'Composición corporal · valores del equipo';

            const showSplitSkinfolds =
              method === 'pliegues' && requiredSkinfolds.length > 0;
            const optionalSkinfolds = showSplitSkinfolds
              ? methodFields.filter((k) => !requiredSkinfolds.includes(k))
              : [];

            return (
              <>
                <fieldset
                  disabled={locked}
                  className="grid gap-5 rounded-xl border border-(--ws-border) p-5 sm:grid-cols-2"
                >
                  <legend className="px-2 font-semibold">
                    Datos generales de la evaluación
                  </legend>
                  {generalFields.map(renderField)}
                </fieldset>
                <fieldset
                  disabled={locked}
                  className="space-y-4 rounded-xl border border-(--ws-border) p-5"
                >
                  <legend className="px-2 font-semibold">{methodTitle}</legend>
                  {showSplitSkinfolds ? (
                    <>
                      <div className="ws-skinfold-required space-y-3">
                        <p className="text-xs font-semibold text-(--ws-primary-fg)">
                          Pliegues obligatorios para la ecuación (3)
                        </p>
                        <div className="grid gap-5 sm:grid-cols-2">
                          {requiredSkinfolds.map(renderField)}
                        </div>
                      </div>
                      <details
                        className="ws-skinfold-optional"
                        open={optionalSkinfolds.some((k) =>
                          Boolean(draft[k]?.trim())
                        )}
                      >
                        <summary className="cursor-pointer text-xs font-medium text-(--ws-muted)">
                          Pliegues complementarios (opcionales ·{' '}
                          {optionalSkinfolds.length} campos)
                        </summary>
                        <div className="mt-3 grid gap-5 sm:grid-cols-2">
                          {optionalSkinfolds.map(renderField)}
                        </div>
                      </details>
                    </>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                      {methodFields.map(renderField)}
                    </div>
                  )}
                </fieldset>
              </>
            );
          })()}
          {method === 'bioimpedancia' && (
            <details
              className="rounded-xl border border-(--ws-border) p-4"
              open={Object.values(segments).some(Boolean)}
            >
              <summary className="cursor-pointer font-semibold">
                Segmentos opcionales · valores en kg (5 segmentos)
              </summary>
              <fieldset
                disabled={locked}
                className="mt-3 space-y-3 border-0! bg-transparent! p-0!"
              >
                <legend className="sr-only">
                  Segmentos opcionales · valores homogéneos en kg
                </legend>
                <label>
                  Tipo de medición
                  <select
                    value={segmentType}
                    onChange={(e) => {
                      const next = e.target.value as typeof segmentType;
                      void (async () => {
                        if (
                          Object.values(segments).some(Boolean) &&
                          !(await confirmDialog({
                            title: '¿Cambiar el tipo de medición segmental?',
                            message:
                              'Los valores anteriores se borrarán para evitar reinterpretar masa muscular como masa grasa.',
                            confirmLabel: 'Cambiar y vaciar valores',
                          }))
                        )
                          return;
                        setSegments({});
                        setSegmentType(next);
                      })();
                    }}
                    className="block min-h-11 border rounded-lg p-2"
                  >
                    <option value="muscle_mass">Masa muscular</option>
                    <option value="fat_mass">Masa grasa</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['leftArm', 'Brazo izquierdo'],
                    ['rightArm', 'Brazo derecho'],
                    ['trunk', 'Tronco'],
                    ['leftLeg', 'Pierna izquierda'],
                    ['rightLeg', 'Pierna derecha'],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label} (kg)
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="block w-full min-h-11 rounded-lg border p-2"
                        value={segments[key] ?? ''}
                        onChange={(e) =>
                          setSegments((v) => ({ ...v, [key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="text-xs text-(--ws-muted)">
                  Solo transcribe masas en kg del mismo tipo; índices y
                  porcentajes segmentales no son compatibles con esta captura.
                </p>
              </fieldset>
            </details>
          )}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-4">
          <CompositionResults
            method={method}
            note={fatGap}
            preliminary={phase !== 'saved'}
            results={
              phase === 'saved'
                ? (confirmed?.assessment?.results ?? {})
                : results
            }
          />
          {method !== 'bioimpedancia' && (
            <AnatomicalGuide
              active={active}
              method={method}
              requiredFields={requiredSkinfolds}
              onSelect={(key) => {
                setActive(key);
                document.getElementById(`assessment-${key}`)?.focus();
              }}
            />
          )}
        </aside>
      </div>
      {errors.form && (
        <p role="alert" className="ws-alert" data-tone="bad">
          {errors.form}
        </p>
      )}
      <div aria-live="polite" className="space-y-3">
        {phase === 'validating' && <p role="status">Validando los campos…</p>}
        {phase === 'saving' && (
          <div role="status" className="ws-alert space-y-2" data-tone="info">
            <p className="font-medium">
              Guardando evaluación en el expediente…
            </p>
            <progress
              aria-label="Guardando evaluación"
              className="w-full max-w-md"
            />
            <p className="text-sm">
              Si no hay confirmación de red, intentaremos conservar esta
              evaluación localmente para sincronizarla después.
            </p>
          </div>
        )}
        {phase === 'saved' && (
          <div role="status" className="ws-alert space-y-2" data-tone="ok">
            <p className="font-semibold">
              La evaluación se guardó correctamente. El servidor confirmó la
              persistencia.
            </p>
            <p className="text-sm">
              Puedes revisar la gráfica de evolución, abrir el historial o
              capturar otra medición con otro método.
            </p>
          </div>
        )}
        {phase === 'queued' && (
          <div role="status" className="ws-alert space-y-2" data-tone="warn">
            <p className="font-semibold">
              {queuedOperation?.state === 'failed'
                ? 'Operación fallida: requiere atención y no está confirmada.'
                : queuedOperation
                  ? 'Evaluación pendiente de sincronización: guardada en este dispositivo, todavía no confirmada por el servidor.'
                  : 'La operación ya no figura en la bandeja local. Consulta el historial para comprobar el resultado confirmado.'}
              {queuedOperation?.error && (
                <span className="mt-1 block font-normal">
                  {queuedOperation.error}
                </span>
              )}
            </p>
            <p className="text-sm">
              La fecha de creación se asignará al aceptarla el servidor; la
              fecha efectiva capturada se conserva.
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer">Detalle técnico</summary>
              <p className="mt-1 break-all">
                Operación: <code>{operationId}</code>
              </p>
            </details>
            <Link to="/app/pendientes" className="ws-btn">
              Revisar pendientes
            </Link>
          </div>
        )}
        {phase === 'migration' && (
          <p role="alert" className="ws-alert" data-tone="warn">
            Migración pendiente. No se guardó ni se encoló esta solicitud.
            Conservamos el formulario. Reintenta solo después de aplicar la
            migración autorizada.
          </p>
        )}
        {phase === 'uncertain' && (
          <p role="alert" className="ws-alert" data-tone="warn">
            Resultado incierto. Reintentar comprobará la misma operación, sin
            crear una nueva. Las mediciones se mantienen bloqueadas para
            conservar esa identidad.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-(--ws-border) pt-5">
        {!['saved', 'queued'].includes(phase) && (
          <button
            className="ws-btn min-h-11"
            data-variant="primary"
            disabled={busy}
            type="submit"
          >
            {busy
              ? 'Guardando…'
              : phase === 'uncertain'
                ? 'Reintentar la misma operación'
                : 'Guardar evaluación'}
          </button>
        )}
        {phase === 'saved' && (
          <>
            <Link
              to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion#evolucion-antropometrica`}
              className="ws-btn min-h-11"
              data-variant="primary"
            >
              Ver evolución
            </Link>
            <Link
              to={`/app/clientes/${encodeURIComponent(clientId)}/nutricion`}
              className="ws-btn min-h-11"
            >
              Ir a Alimentación
            </Link>
            <button
              type="button"
              className="ws-btn min-h-11"
              onClick={() => {
                setConfirmed(null);
                setOperationId('');
                attempt.current = null;
                setDrafts((current) => ({ ...current, [method]: {} }));
                if (method === 'bioimpedancia') setSegments({});
                setPhase('draft');
                setErrors({});
              }}
            >
              Registrar otra evaluación
            </button>
          </>
        )}
        <Link
          to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion#historial`}
          className="ws-btn min-h-11"
        >
          Volver al historial
        </Link>
      </div>
    </form>
  );
}

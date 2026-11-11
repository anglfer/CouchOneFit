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
  type AssessmentInput,
  type MeasurementField,
  type Method,
} from '../types/assessment';
import CompositionResults from './CompositionResults';
import AnatomicalGuide from './AnatomicalGuide';
export default function AssessmentForm({
  clientId,
  clientName,
  onSaved,
  onQueued,
  onBusyChange,
}: {
  clientId: string;
  clientName: string;
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
  const results = preview(body);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || phase === 'saved' || phase === 'queued') return;
    sending.current = true;
    setPhase('validating');
    setErrors({});
    const validation: Record<string, string> = {};
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
      <p className="text-sm text-(--ws-muted)">
        {phase === 'saved'
          ? 'Confirmada por el servidor'
          : phase === 'queued'
            ? 'Conservada localmente'
            : 'Borrador de evaluación'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          Fecha efectiva (opcional)
          <input
            className="block w-full min-h-11 rounded-lg border p-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={locked}
          />
          <span className="text-xs">
            Sin fecha, se asigna el día UTC de aceptación. La creación siempre
            usa el reloj del servidor.
          </span>
        </label>
        <label>
          Selección de ecuación
          <select
            className="block w-full min-h-11 rounded-lg border p-2"
            value={equation}
            onChange={(e) =>
              setEquation(e.target.value as AssessmentInput['equation'])
            }
            disabled={locked}
          >
            <option value="not_applicable">
              No aplica / sin cálculo estimado
            </option>
            <option value="male">Ecuación masculina</option>
            <option value="female">Ecuación femenina</option>
          </select>
        </label>
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
      <p className="text-sm">
        Cada campo es opcional; captura al menos una medición del método.
        Cambiar de método conserva el borrador de cada uno.
      </p>
      {method !== 'bioimpedancia' && (
        <p className="ws-alert" data-tone="warn">
          {method === 'perimetros' ? 'Navy' : 'Jackson–Pollock 3P y Siri'}:
          cálculo de grasa deshabilitado hasta verificar las fuentes y el
          protocolo. Se conservan las mediciones originales.
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="space-y-4">
          {[
            {
              title: 'Datos generales de la evaluación',
              fields: fieldsByMethod[method].filter((k) =>
                ['weightKg', 'heightCm'].includes(k)
              ),
            },
            {
              title:
                method === 'perimetros'
                  ? 'Perímetros · cinta métrica'
                  : method === 'pliegues'
                    ? 'Pliegues · plicómetro'
                    : 'Composición corporal · valores del equipo',
              fields: fieldsByMethod[method].filter(
                (k) => !['weightKg', 'heightCm'].includes(k)
              ),
            },
          ].map((group) => (
            <fieldset
              key={group.title}
              disabled={locked}
              className="grid gap-5 rounded-xl border border-(--ws-border) p-5 sm:grid-cols-2"
            >
              <legend className="px-2 font-semibold">{group.title}</legend>
              {group.fields.map((key) => {
                const [label, unit, min, max] = measurementFields[key];
                return (
                  <label key={key} className="block">
                    {label} ({unit}){' '}
                    <span className="text-xs text-(--ws-muted)">opcional</span>
                    <input
                      id={`assessment-${key}`}
                      name={key}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min={min}
                      max={max}
                      value={draft[key] ?? ''}
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
                      className="mt-1 min-h-11 block w-full rounded-lg border border-(--ws-border) bg-(--ws-surface) p-2"
                    />
                    {errors[key] && (
                      <span id={`assessment-error-${key}`} role="alert">
                        {errors[key]}
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
          ))}
          {method === 'bioimpedancia' && (
            <fieldset disabled={locked} className="space-y-3">
              <legend className="font-semibold">
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
              <p className="text-xs">
                Solo transcribe masas en kg del mismo tipo; índices y
                porcentajes segmentales no son compatibles con esta captura.
              </p>
            </fieldset>
          )}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-4">
          <CompositionResults
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
              onSelect={(key) => {
                setActive(key);
                document.getElementById(`assessment-${key}`)?.focus();
              }}
            />
          )}
        </aside>
      </div>
      {errors.form && (
        <p role="alert" className="ws-alert" data-tone="danger">
          {errors.form}
        </p>
      )}
      <div aria-live="polite" className="space-y-3">
        {phase === 'validating' && <p role="status">Validando los campos…</p>}
        {phase === 'saving' && (
          <div role="status">
            <p>Guardando · esperando confirmación del servidor…</p>
            <progress
              aria-label="Guardando evaluación"
              className="w-full max-w-md"
            />
            <p className="text-sm">
              Se comprueban sesión, CSRF y persistencia. Si no hay confirmación
              en 20 segundos, se intentará conservar esta misma operación en la
              cola local.
            </p>
          </div>
        )}
        {phase === 'saved' && (
          <p role="status" className="ws-alert" data-tone="success">
            La evaluación se guardó correctamente. El servidor confirmó la
            persistencia.
          </p>
        )}
        {phase === 'queued' && (
          <div role="status" className="ws-alert" data-tone="warn">
            <p>
              {queuedOperation?.state === 'failed'
                ? 'Operación fallida: requiere atención y no está confirmada.'
                : queuedOperation
                  ? 'Evaluación pendiente de sincronización: guardada en este dispositivo, todavía no confirmada por el servidor.'
                  : 'La operación ya no figura en la bandeja local. Consulta el historial para comprobar el resultado confirmado.'}
              {queuedOperation?.error && (
                <span className="block">{queuedOperation.error}</span>
              )}
            </p>
            <p>
              La fecha de creación se asignará al aceptarla el servidor; la
              fecha efectiva capturada se conserva.
            </p>
            <p className="break-all">
              Operación: <code>{operationId}</code>
            </p>
            <Link to="/app/pendientes" className="underline">
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
          <p role="alert">
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
        <Link
          to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion`}
          className="ws-btn min-h-11"
        >
          Volver al historial
        </Link>
      </div>
    </form>
  );
}

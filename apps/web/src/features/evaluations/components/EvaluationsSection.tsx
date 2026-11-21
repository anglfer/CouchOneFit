import {
  measurementFields,
  skinfoldNote,
  type MeasurementField,
} from '../types/assessment';
import { Link } from '../../../components/Link';
import CompositionResults from './CompositionResults';
import { useOperations } from '../../../hooks/useOperations';
import { Icon } from '../../../components/Icon';
import { evolutionDate, evolutionMethod } from '../utils/evolution';
import {
  EVALUATION_FIELDS,
  type EvaluationSection as Section,
  type Evaluation,
} from '../types/evaluation';
export default function EvaluationsSection({
  clientId,
  clientStatus,
  section,
  onRetry,
}: {
  clientId: string;
  clientName: string;
  clientStatus: 'active' | 'inactive';
  section: Section;
  onRetry: () => void;
  onSaved?: () => void;
}) {
  const operations = useOperations().filter(
    (o) => o.kind === 'evaluation.create' && o.clientId === clientId
  );
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Historial de evaluaciones</h3>
      {section.status === 'error' ? (
        <div role="alert">
          <p>No pudimos consultar las evaluaciones confirmadas.</p>
          <button className="ws-btn" onClick={onRetry}>
            Reintentar lectura
          </button>
        </div>
      ) : section.status === 'empty' ? (
        <p className="rounded-lg border border-dashed border-(--ws-border) p-4 text-sm text-(--ws-muted)">
          Aún no hay evaluaciones registradas.
          {clientStatus === 'active'
            ? ' Usa «Nueva evaluación» para capturar la primera.'
            : ''}
          {operations.length > 0
            ? ' Las operaciones locales se muestran por separado.'
            : ''}
        </p>
      ) : (
        <ol
          aria-label="Evaluaciones confirmadas, de la más reciente a la más antigua"
          className="space-y-3"
        >
          {section.evaluations.map((e) => (
            <EvaluationCard key={e.id} evaluation={e} />
          ))}
        </ol>
      )}
      {operations.length > 0 && (
        <section
          aria-label="Operaciones locales"
          className="space-y-3 border-t border-(--ws-border) pt-4"
        >
          <h3 className="font-semibold">
            Operaciones locales · sin confirmación
          </h3>
          <ul className="space-y-3">
            {operations.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-(--ws-border) p-3"
              >
                <p className="font-medium">
                  {o.state === 'syncing'
                    ? 'Sincronizando'
                    : o.state === 'pending'
                      ? 'Pendiente de sincronización'
                      : 'Requiere atención · no confirmada'}
                </p>
                <p className="text-sm break-all">
                  Operación: <code>{o.id}</code>
                </p>
                {o.error && <p className="text-sm">{o.error}</p>}
              </li>
            ))}
          </ul>
          <Link className="ws-btn" to="/app/pendientes">
            Revisar operaciones pendientes
          </Link>
        </section>
      )}
      {clientStatus === 'inactive' && (
        <p>
          Expediente inactivo: puedes consultar el historial, pero no crear
          evaluaciones.
        </p>
      )}
    </div>
  );
}
function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  const measurements = EVALUATION_FIELDS.flatMap(([field, label, unit]) =>
    evaluation[field] === null
      ? []
      : [{ label, unit, value: evaluation[field] }]
  );
  const count = evaluation.assessment
    ? Object.keys(evaluation.assessment.measurements).length
    : measurements.length;
  return (
    <li className="rounded-lg border border-(--ws-border) bg-(--ws-surface)">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ws-primary) [&::-webkit-details-marker]:hidden">
          <Icon
            name="chevron-down"
            size={16}
            className="shrink-0 -rotate-90 text-(--ws-muted) transition-transform group-open:rotate-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {evolutionDate(
                evaluation.assessment?.effectiveDate ??
                  evaluation.evaluationDate
              )}
            </span>
            <span className="block text-sm text-(--ws-muted)">
              {evolutionMethod(evaluation.assessment?.method ?? null)}
              {evaluation.assessment?.results.bodyFatPercentage !==
                undefined &&
                ` · ${evaluation.assessment.results.bodyFatPercentage.toFixed(1)} % grasa`}
            </span>
          </span>
          <span className="text-sm text-(--ws-muted)">
            {count} {count === 1 ? 'medición' : 'mediciones'}
          </span>
        </summary>
        {evaluation.assessment && (
          <div className="space-y-4 border-t border-(--ws-border) p-3">
            <p className="text-sm text-(--ws-muted)">
              Edad de referencia:{' '}
              {evaluation.assessment.ageYears ?? 'no disponible'} ·{' '}
              {evaluation.assessment.calculationStatus ===
              'pending_verification'
                ? 'Mediciones registradas'
                : evaluation.assessment.calculationStatus === 'partial'
                  ? 'Datos parciales'
                  : 'Resultados disponibles'}
            </p>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {Object.entries(evaluation.assessment.measurements).map(
                ([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-(--ws-muted)">
                      {measurementFields[key as MeasurementField]?.[0] ?? key}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {value}{' '}
                      {measurementFields[key as MeasurementField]?.[1] ?? ''}
                    </dd>
                  </div>
                )
              )}
            </dl>
            <CompositionResults
              results={evaluation.assessment.results}
              method={evaluation.assessment.method}
              note={
                evaluation.assessment.method === 'pliegues'
                  ? skinfoldNote(
                      evaluation.assessment.equation,
                      evaluation.assessment.ageYears,
                      evaluation.assessment.measurements
                    )
                  : null
              }
            />
            {evaluation.assessment.segmental && (
              <div aria-label="Valores segmentales">
                {Object.entries(evaluation.assessment.segmental.values).map(
                  ([key, value]) => (
                    <div key={key}>
                      {(
                        {
                          leftArm: 'Brazo izquierdo',
                          rightArm: 'Brazo derecho',
                          trunk: 'Tronco',
                          leftLeg: 'Pierna izquierda',
                          rightLeg: 'Pierna derecha',
                        } as Record<string, string>
                      )[key] ?? key}
                      : {value} kg (
                      {evaluation.assessment!.segmental!.type === 'muscle_mass'
                        ? 'masa muscular'
                        : 'masa grasa'}
                      )
                      <meter
                        min={0}
                        max={Math.max(
                          ...Object.values(
                            evaluation.assessment!.segmental!.values
                          ).filter((v): v is number => typeof v === 'number'),
                          1
                        )}
                        value={value}
                      >
                        {value} kg
                      </meter>
                    </div>
                  )
                )}
              </div>
            )}
            <p className="text-xs break-words text-(--ws-muted)">
              Protocolo {evaluation.assessment.protocol} · versión{' '}
              {evaluation.assessment.version} · registrada el{' '}
              {new Date(evaluation.createdAt).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        )}
        {!evaluation.assessment &&
          (measurements.length ? (
            <dl className="grid gap-x-4 gap-y-2 border-t border-(--ws-border) px-3 py-3 text-sm sm:grid-cols-2">
              {measurements.map((item) => (
                <div key={item.label} className="flex justify-between gap-3">
                  <dt className="text-(--ws-muted)">{item.label}</dt>
                  <dd className="font-medium">
                    {item.value} {item.unit}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="border-t border-(--ws-border) px-3 py-3 text-sm">
              Esta evaluación no contiene mediciones.
            </p>
          ))}
      </details>
    </li>
  );
}

import { measurementFields, type MeasurementField } from '../types/assessment';
import { Link } from '../../../components/Link';
import CompositionResults from './CompositionResults';
import { useOperations } from '../../../hooks/useOperations';
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Historial confirmado</h3>
        {clientStatus === 'active' && (
          <Link
            className="ws-btn min-h-11"
            data-variant="primary"
            to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion/nueva`}
          >
            Nueva evaluación
          </Link>
        )}
      </div>
      {section.status === 'error' ? (
        <div role="alert">
          <p>No pudimos consultar las evaluaciones confirmadas.</p>
          <button className="ws-btn" onClick={onRetry}>
            Reintentar lectura
          </button>
        </div>
      ) : section.status === 'empty' ? (
        <p className="rounded-lg border border-dashed p-4">
          Aún no hay evaluaciones confirmadas por el servidor.
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
  return (
    <li className="rounded-lg border border-(--ws-border) bg-(--ws-surface)">
      <details>
        <summary className="min-h-11 cursor-pointer px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ws-primary)">
          <span>
            Confirmada · Evaluación ·{' '}
            {evaluation.assessment?.effectiveDate ?? evaluation.evaluationDate}
          </span>
          <span className="block text-xs">
            {evaluation.assessment?.method ?? 'Heredada · método desconocido'} ·
            creada {evaluation.createdAt}
          </span>
          <span className="ml-2 text-sm font-normal text-(--ws-muted)">
            {evaluation.assessment
              ? Object.keys(evaluation.assessment.measurements).length
              : measurements.length}{' '}
            {measurements.length === 1 ? 'medición' : 'mediciones'}
          </span>
        </summary>
        {evaluation.assessment && (
          <div className="p-3 space-y-3">
            <p>
              Edad de referencia:{' '}
              {evaluation.assessment.ageYears ?? 'no disponible'} · Protocolo:{' '}
              {evaluation.assessment.protocol} · Versión:{' '}
              {evaluation.assessment.version} ·{' '}
              {evaluation.assessment.calculationStatus ===
              'pending_verification'
                ? 'Cálculo estimado pendiente de verificación'
                : evaluation.assessment.calculationStatus === 'partial'
                  ? 'Datos parciales'
                  : 'Resultados disponibles'}
            </p>
            <dl className="grid gap-2">
              {Object.entries(evaluation.assessment.measurements).map(
                ([key, value]) => (
                  <div key={key}>
                    <dt>
                      {measurementFields[key as MeasurementField]?.[0] ?? key}
                    </dt>
                    <dd>
                      {value}{' '}
                      {measurementFields[key as MeasurementField]?.[1] ?? ''}
                    </dd>
                  </div>
                )
              )}
            </dl>
            <CompositionResults results={evaluation.assessment.results} />
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

import { useState } from 'react';
import {
  measurementFields,
  skinfoldNote,
  type MeasurementField,
} from '../types/assessment';
import { Link } from '../../../components/Link';
import CompositionResults from './CompositionResults';
import { useOperations } from '../../../hooks/useOperations';
import { Icon } from '../../../components/Icon';
import {
  evolutionDate,
  evolutionMethod,
  evolutionValue,
} from '../utils/evolution';
import {
  EVALUATION_FIELDS,
  type EvaluationSection as Section,
  type Evaluation,
} from '../types/evaluation';

function readEvalMeasurement(
  evaluation: Evaluation,
  key: MeasurementField | 'bodyFatPercentage'
): number | null {
  if (key === 'bodyFatPercentage') {
    return (
      evaluation.measuredBodyFatPercentage ??
      evaluation.assessment?.results.bodyFatPercentage ??
      null
    );
  }
  const fromAssessment = evaluation.assessment?.measurements[key];
  if (typeof fromAssessment === 'number') return fromAssessment;
  if (key in evaluation) {
    const val = (evaluation as unknown as Record<string, unknown>)[key];
    if (typeof val === 'number') return val;
  }
  return null;
}

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
  const [compareOpen, setCompareOpen] = useState(false);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  const evaluations = section.status === 'available' ? section.evaluations : [];
  const canCompare = evaluations.length >= 2;
  const newerEval =
    evaluations.find((e) => e.id === leftId) ?? evaluations[0] ?? null;
  const olderEval =
    evaluations.find((e) => e.id === rightId) ?? evaluations[1] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Historial de evaluaciones</h3>
        {canCompare && (
          <button
            type="button"
            className="ws-btn"
            aria-expanded={compareOpen}
            onClick={() => setCompareOpen((v) => !v)}
          >
            <Icon name="swap" size={16} />
            {compareOpen ? 'Cerrar comparación' : 'Comparar evaluaciones'}
          </button>
        )}
      </div>

      {compareOpen && canCompare && newerEval && olderEval && (
        <section
          aria-label="Comparación entre dos evaluaciones"
          className="space-y-4 rounded-xl border border-(--ws-primary) bg-(--ws-surface-2) p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Evaluación reciente
              <select
                className="ws-input mt-1 w-full min-h-11"
                value={newerEval.id}
                onChange={(e) => setLeftId(e.target.value)}
              >
                {evaluations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {evolutionDate(
                      item.assessment?.effectiveDate ?? item.evaluationDate
                    )}{' '}
                    · {evolutionMethod(item.assessment?.method ?? null)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Evaluación de referencia
              <select
                className="ws-input mt-1 w-full min-h-11"
                value={olderEval.id}
                onChange={(e) => setRightId(e.target.value)}
              >
                {evaluations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {evolutionDate(
                      item.assessment?.effectiveDate ?? item.evaluationDate
                    )}{' '}
                    · {evolutionMethod(item.assessment?.method ?? null)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <CompareResults newer={newerEval} older={olderEval} />
        </section>
      )}

      {section.status === 'error' ? (
        <div role="alert" className="ws-alert space-y-2" data-tone="bad">
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
          {evaluations.map((e, index) => (
            <EvaluationCard
              key={e.id}
              evaluation={e}
              previous={evaluations[index + 1]}
            />
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
                className="ws-alert space-y-1"
                data-tone={o.state === 'failed' ? 'bad' : 'warn'}
              >
                <p className="font-semibold">
                  {o.state === 'syncing'
                    ? 'Sincronizando'
                    : o.state === 'pending'
                      ? 'Pendiente de sincronización'
                      : 'Requiere atención · no confirmada'}
                </p>
                {o.error && <p className="text-sm">{o.error}</p>}
                <details className="text-xs opacity-80">
                  <summary className="cursor-pointer">Detalle técnico</summary>
                  <p className="mt-1 break-all">
                    Operación: <code>{o.id}</code>
                  </p>
                </details>
              </li>
            ))}
          </ul>
          <Link className="ws-btn" to="/app/pendientes">
            Revisar operaciones pendientes
          </Link>
        </section>
      )}
      {clientStatus === 'inactive' && (
        <p className="text-sm text-(--ws-muted)">
          Expediente inactivo: puedes consultar el historial, pero no crear
          evaluaciones.
        </p>
      )}
    </div>
  );
}

function CompareResults({
  newer,
  older,
}: {
  newer: Evaluation;
  older: Evaluation;
}) {
  const keys: Array<[MeasurementField | 'bodyFatPercentage', string, string]> =
    [
      ['weightKg', 'Peso', 'kg'],
      ['bodyFatPercentage', 'Grasa corporal', '%'],
      ...Object.entries(measurementFields)
        .filter(([k]) => !['weightKg', 'measuredBodyFatPercentage'].includes(k))
        .map(
          ([k, [label, unit]]) =>
            [k as MeasurementField, label, unit] as [
              MeasurementField,
              string,
              string,
            ]
        ),
    ];

  const comparable = keys
    .map(([key, label, unit]) => {
      const a = readEvalMeasurement(newer, key);
      const b = readEvalMeasurement(older, key);
      return a === null && b === null ? null : { key, label, unit, a, b };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (comparable.length === 0) {
    return (
      <p className="text-sm text-(--ws-muted)">
        No hay mediciones comparables entre estas evaluaciones.
      </p>
    );
  }

  return (
    <div className="ws-compare-grid">
      {comparable.map((row) => {
        const diff =
          row.a !== null && row.b !== null
            ? Number((row.a - row.b).toFixed(1))
            : null;
        const sign =
          diff === null || Math.abs(diff) < 0.05
            ? 'flat'
            : diff > 0
              ? 'up'
              : 'down';
        return (
          <div
            key={row.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--ws-border) bg-(--ws-surface) px-3 py-2 text-sm"
          >
            <span className="font-medium text-(--ws-muted)">{row.label}</span>
            <div className="flex items-center gap-2 tabular-nums">
              <span>
                {row.b !== null ? `${evolutionValue(row.b)} ${row.unit}` : '—'}
              </span>
              <span aria-hidden="true" className="text-(--ws-muted)">
                →
              </span>
              <strong>
                {row.a !== null ? `${evolutionValue(row.a)} ${row.unit}` : '—'}
              </strong>
              {diff !== null && (
                <span className="ws-delta" data-sign={sign}>
                  {Math.abs(diff) < 0.05
                    ? '0.0'
                    : `${diff > 0 ? '+' : '−'}${evolutionValue(Math.abs(diff))}`}{' '}
                  {row.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvaluationCard({
  evaluation,
  previous,
}: {
  evaluation: Evaluation;
  previous?: Evaluation;
}) {
  const measurements = EVALUATION_FIELDS.flatMap(([field, label, unit]) =>
    evaluation[field] === null
      ? []
      : [{ label, unit, value: evaluation[field] }]
  );
  const count = evaluation.assessment
    ? Object.keys(evaluation.assessment.measurements).length
    : measurements.length;
  const weight = readEvalMeasurement(evaluation, 'weightKg');
  const prevWeight = previous
    ? readEvalMeasurement(previous, 'weightKg')
    : null;
  const weightDiff =
    weight !== null && prevWeight !== null
      ? Number((weight - prevWeight).toFixed(1))
      : null;
  const waist = readEvalMeasurement(evaluation, 'waistCm');
  const fat = readEvalMeasurement(evaluation, 'bodyFatPercentage');

  return (
    <li className="rounded-xl border border-(--ws-border) bg-(--ws-surface)">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ws-primary) [&::-webkit-details-marker]:hidden">
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
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
            {weight !== null && (
              <span className="ws-chip">
                {evolutionValue(weight)} kg
                {weightDiff !== null && Math.abs(weightDiff) >= 0.05 && (
                  <span
                    className="ws-delta"
                    data-sign={weightDiff > 0 ? 'up' : 'down'}
                  >
                    {weightDiff > 0 ? '+' : '−'}
                    {evolutionValue(Math.abs(weightDiff))}
                  </span>
                )}
              </span>
            )}
            {fat !== null && (
              <span className="ws-chip">{evolutionValue(fat)} % grasa</span>
            )}
            {waist !== null && (
              <span className="ws-chip">
                {evolutionValue(waist)} cm cintura
              </span>
            )}
            <span className="text-xs text-(--ws-muted)">
              {count} {count === 1 ? 'medición' : 'mediciones'}
            </span>
          </span>
        </summary>
        {evaluation.assessment && (
          <div className="space-y-4 border-t border-(--ws-border) p-4">
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
                  <div
                    key={key}
                    className="flex justify-between gap-3 border-b border-(--ws-border-subtle) py-1"
                  >
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
              <div aria-label="Valores segmentales" className="ws-segment-list">
                {Object.entries(evaluation.assessment.segmental.values).map(
                  ([key, value]) => {
                    const segMax = Math.max(
                      ...Object.values(
                        evaluation.assessment!.segmental!.values
                      ).filter((v): v is number => typeof v === 'number'),
                      1
                    );
                    const segLabel =
                      (
                        {
                          leftArm: 'Brazo izquierdo',
                          rightArm: 'Brazo derecho',
                          trunk: 'Tronco',
                          leftLeg: 'Pierna izquierda',
                          rightLeg: 'Pierna derecha',
                        } as Record<string, string>
                      )[key] ?? key;
                    const tissueLabel =
                      evaluation.assessment!.segmental!.type === 'muscle_mass'
                        ? 'masa muscular'
                        : 'masa grasa';
                    return (
                      <div key={key} className="ws-segment-row">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="font-medium">{segLabel}</span>
                          <span className="tabular-nums text-(--ws-muted)">
                            {value} kg ({tissueLabel})
                          </span>
                        </div>
                        <meter
                          className="ws-segment-meter"
                          min={0}
                          max={segMax}
                          value={value}
                        >
                          {value} kg
                        </meter>
                      </div>
                    );
                  }
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
            <dl className="grid gap-x-4 gap-y-2 border-t border-(--ws-border) px-4 py-3 text-sm sm:grid-cols-2">
              {measurements.map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between gap-3 border-b border-(--ws-border-subtle) py-1"
                >
                  <dt className="text-(--ws-muted)">{item.label}</dt>
                  <dd className="font-medium tabular-nums">
                    {item.value} {item.unit}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="border-t border-(--ws-border) px-4 py-3 text-sm text-(--ws-muted)">
              Esta evaluación no contiene mediciones.
            </p>
          ))}
      </details>
    </li>
  );
}

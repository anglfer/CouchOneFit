import {
  canShowCandidateEstimation,
  type CandidateEstimation,
  type PendingEstimation,
} from '../types/estimation';

export default function EstimationDetails({
  effectiveDate,
  estimation,
}: {
  effectiveDate: string;
  estimation?: PendingEstimation | CandidateEstimation;
}) {
  const candidate =
    estimation && 'technicalFormulaVersion' in estimation ? estimation : null;
  // Defense in depth: production bundles never render candidate percentages.
  const local = canShowCandidateEstimation();
  const result =
    local && candidate?.status === 'candidate_only' ? candidate.result : null;
  const reasons: Record<string, string> = {
    candidate_execution_disabled: 'La estimación aún no está disponible.',
    equation_not_selected: 'Falta seleccionar la ecuación.',
    age_unavailable:
      'No hay fecha de nacimiento para determinar la edad efectiva.',
    outside_reference_age_range:
      'La edad está fuera del intervalo de la ecuación.',
    missing_measurements: 'Faltan pliegues requeridos para la ecuación.',
    invalid_density: 'La densidad calculada no es válida.',
    invalid_estimated_percentage:
      'Las mediciones no produjeron un porcentaje válido.',
  };
  return (
    <section
      aria-label="Estimación de grasa corporal"
      className="rounded-lg border border-(--ws-border) p-4 space-y-2"
    >
      <h3 className="font-semibold">Grasa corporal estimada</h3>
      {candidate && result ? (
        <>
          <p className="text-2xl font-semibold">
            <span aria-label="Porcentaje estimado de grasa corporal">
              {result.estimatedBodyFatPercentage.toFixed(1)} %
            </span>
          </p>
          <p className="text-sm">
            Estimación preliminar, pendiente de validación.
            {candidate.variant === 'female' &&
              candidate.blockers.includes('female_over_40_caution_pending') &&
              ' Se requiere cautela adicional en mayores de 40 años.'}
          </p>
          <details className="space-y-2 text-sm">
            <summary className="cursor-pointer">Datos del cálculo</summary>
            <p>Jackson–Pollock 3P + Siri · Fecha efectiva: {effectiveDate}</p>
            <p className="break-words">
              Versión: {candidate.technicalFormulaVersion} · Restricciones:{' '}
              {candidate.technicalDomainVersion}
            </p>
            <dl className="space-y-1">
              <div>
                <dt className="inline font-medium">Suma de tres pliegues: </dt>
                <dd className="inline">{result.sumSkinfoldMm} mm</dd>
              </div>
              <div>
                <dt className="inline font-medium">Densidad corporal: </dt>
                <dd className="inline break-all">
                  {result.bodyDensityGPerMl} g/mL
                </dd>
              </div>
            </dl>
          </details>
        </>
      ) : (
        <p className="text-sm text-(--ws-muted)">
          {(local && candidate && reasons[candidate.reasons[0]?.code]) ||
            'No disponible. Las mediciones se conservaron.'}
        </p>
      )}
    </section>
  );
}

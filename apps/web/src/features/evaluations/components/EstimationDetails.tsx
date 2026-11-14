import type {
  CandidateEstimation,
  PendingEstimation,
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
  const local =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
      window.location.hostname
    );
  const result =
    local && candidate?.status === 'candidate_only' ? candidate.result : null;
  const reasons: Record<string, string> = {
    candidate_execution_disabled:
      'El servidor no permite cálculos candidatos en este entorno.',
    equation_not_selected:
      'Selecciona una variante para solicitar el cálculo candidato.',
    age_unavailable:
      'No hay fecha de nacimiento para determinar la edad efectiva.',
    outside_reference_age_range:
      'La edad está fuera del intervalo técnico provisional.',
    missing_measurements:
      'Faltan sitios requeridos para la variante seleccionada.',
    invalid_density: 'La densidad calculada no es válida.',
    invalid_estimated_percentage:
      'El porcentaje calculado no supera las guardas técnicas.',
  };
  return (
    <section
      aria-label="Estimación de grasa corporal"
      className="rounded-lg border border-(--ws-border) p-4 space-y-2"
    >
      <h3 className="font-semibold">
        {result
          ? 'Grasa corporal estimada — resultado candidato para pruebas'
          : 'Grasa corporal estimada · no disponible'}
      </h3>
      <p>Jackson–Pollock 3P + Siri · Fecha efectiva: {effectiveDate}</p>
      {candidate && (
        <p className="text-sm break-words">
          Versión técnica: {candidate.technicalFormulaVersion} · Restricciones:{' '}
          {candidate.technicalDomainVersion}
        </p>
      )}
      {result ? (
        <>
          <p className="text-2xl font-semibold">
            <span aria-label="Porcentaje candidato de grasa corporal">
              {result.estimatedBodyFatPercentage.toFixed(1)} %
            </span>
          </p>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Suma de tres pliegues: </dt>
              <dd className="inline">{result.sumSkinfoldMm} mm</dd>
            </div>
            <div>
              <dt className="inline font-medium">
                Densidad corporal candidata:{' '}
              </dt>
              <dd className="inline break-all">
                {result.bodyDensityGPerMl} g/mL
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p>
          {candidate
            ? local
              ? (reasons[candidate.reasons[0]?.code] ??
                'No se cumplen las condiciones del cálculo candidato.')
              : 'La visualización candidata requiere desarrollo local.'
            : 'La verificación científica y del protocolo sigue pendiente. Se conservaron tus mediciones; no se calculó ningún porcentaje.'}
        </p>
      )}
      <p className="ws-alert" data-tone="warn">
        {candidate
          ? 'No está validado científicamente. Solo para pruebas locales; no constituye un diagnóstico ni una medición de grasa informada.'
          : 'Referencia técnica pendiente, sin versión científica aprobada. No es un diagnóstico ni una medición informada por un dispositivo.'}
      </p>
      {candidate?.variant === 'female' && (
        <p className="text-sm">
          Ecuación femenina: cotejo con el original pendiente.
          {candidate.blockers.includes('female_over_40_caution_pending')
            ? ' Se conserva la cautela pendiente para mayores de 40 años.'
            : ''}
        </p>
      )}
    </section>
  );
}

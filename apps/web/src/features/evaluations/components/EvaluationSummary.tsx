import { methods } from '../types/assessment';
import type { EvaluationSection } from '../types/evaluation';
/** Informational only; management belongs to the Evaluation tab. */
export default function EvaluationSummary({
  section,
}: {
  section: EvaluationSection;
}) {
  const latest = section.status === 'available' ? section.evaluations[0] : null;
  if (!latest) return null;
  return (
    <p className="text-sm">
      Última evaluación confirmada:{' '}
      {latest.assessment?.effectiveDate ?? latest.evaluationDate} ·{' '}
      {methods.find((m) => m.id === latest.assessment?.method)?.label ??
        'Heredada · método desconocido'}
    </p>
  );
}

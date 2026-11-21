import { methods } from '../types/assessment';
import { latestBodyFat, type EvaluationSection } from '../types/evaluation';
import { evolutionDate } from '../utils/evolution';
/** Informational only; management belongs to the Evaluation tab. */
export default function EvaluationSummary({
  section,
}: {
  section: EvaluationSection;
}) {
  const latest = section.status === 'available' ? section.evaluations[0] : null;
  if (!latest) return null;
  const fat = latestBodyFat({ status: 'available', evaluations: [latest] });
  return (
    <p className="text-sm">
      <span className="block font-semibold">
        {evolutionDate(
          latest.assessment?.effectiveDate ?? latest.evaluationDate
        )}
      </span>
      <span className="text-(--ws-muted)">
        {methods.find((m) => m.id === latest.assessment?.method)?.label ??
          'Heredada · método desconocido'}
        {fat && ` · ${fat.value.toFixed(1)} % grasa`}
      </span>
    </p>
  );
}

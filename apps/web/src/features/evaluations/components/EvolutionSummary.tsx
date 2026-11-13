import type { ProfessionalRecord } from '../../professional/types/record';
import { Link } from '../../../components/Link';
import { evolutionDate, evolutionValue } from '../utils/evolution';
export default function EvolutionSummary({
  section,
  clientId,
}: {
  section: ProfessionalRecord['sections']['progress'];
  clientId: string;
}) {
  const history = 'history' in section ? section.history : null;
  const weight = history?.samples
    .filter((s) => s.measurements.weightKg !== undefined)
    .at(-1);
  return (
    <div className="space-y-2">
      {section.status === 'available' && history ? (
        <>
          <p className="text-sm">
            Hay evaluaciones disponibles para consultar su evolución.
          </p>
          <p className="text-sm">
            {history.samples.length} evaluaciones en la página del expediente.
            {history.pageInfo.hasMore ? ' Hay más páginas por consultar.' : ''}
          </p>
          {weight && (
            <p className="text-sm">
              Peso más reciente de esta página:{' '}
              {evolutionValue(weight.measurements.weightKg!)} kg ·{' '}
              {evolutionDate(weight.date)}.
            </p>
          )}
        </>
      ) : section.status === 'empty' ? (
        <p className="text-sm">
          Sin evaluaciones confirmadas en el expediente consultado.
        </p>
      ) : section.status === 'error' ? (
        <p role="alert" className="text-sm">
          No pudimos consultar el resumen de evolución. Puedes reintentar desde
          Evaluación.
        </p>
      ) : (
        <p className="text-sm text-(--ws-muted)">
          La evolución aún no está integrada en el expediente consultado.
        </p>
      )}
      <Link
        className="ws-btn min-h-11"
        to={`/app/clientes/${encodeURIComponent(clientId)}/evaluacion#evolucion-antropometrica`}
      >
        Ver evolución
      </Link>
    </div>
  );
}

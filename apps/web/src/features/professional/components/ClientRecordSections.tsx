import type { ProfessionalRecord, RecordSection } from '../types/record';
import { Link } from '../../../components/Link';
import { Badge, Card } from '../../../components/ui';
import type { EvolutionSection } from '../../evaluations/types/evolution';
import EvolutionSummary from '../../evaluations/components/EvolutionSummary';
import EvaluationSummary from '../../evaluations/components/EvaluationSummary';
import type { BodyWeightEntry } from '../../follow-up/types/followUp';

export function SectionState({
  section,
}: {
  section: RecordSection | EvolutionSection;
}) {
  switch (section.status) {
    case 'not_integrated':
      return (
        <p className="text-sm text-(--ws-muted)">
          Esta sección todavía no está disponible.
        </p>
      );
    case 'available':
      return (
        <p className="text-sm">
          Hay evaluaciones disponibles para consultar su evolución.
        </p>
      );
    case 'empty':
      return <p className="text-sm">Sin registros.</p>;
    case 'error':
      return (
        <p role="alert" className="text-sm">
          No pudimos consultar esta sección. Reintenta la lectura del
          expediente.
        </p>
      );
    default:
      // Unknown or malformed metadata is not evidence of an empty module.
      return (
        <p role="alert" className="text-sm">
          No pudimos interpretar el estado de esta sección.
        </p>
      );
  }
}

function NutritionSectionCard({
  section,
  clientId,
}: {
  section: ProfessionalRecord['sections']['nutritionPlan'];
  clientId: string;
}) {
  const nutritionPath = `/app/clientes/${clientId}/nutricion`;
  return (
    <Card
      title="Alimentación"
      icon="bowl"
      labelId="record-plans-title"
      action={
        <Link to={nutritionPath} className="ws-btn">
          Gestionar alimentación
        </Link>
      }
    >
      {section.status === 'available' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{section.plan.name}</p>
            <Badge tone="ok">v{section.plan.number}</Badge>
          </div>
          <p className="text-sm text-(--ws-muted)">
            {section.plan.meals.length}{' '}
            {section.plan.meals.length === 1
              ? 'tiempo de comida'
              : 'tiempos de comida'}
            {section.plan.caloriesTarget !== null
              ? ` · ${section.plan.caloriesTarget} kcal`
              : ''}
            {section.plan.proteinTargetG !== null
              ? ` · P ${section.plan.proteinTargetG}g`
              : ''}
            {section.plan.carbsTargetG !== null
              ? ` · C ${section.plan.carbsTargetG}g`
              : ''}
            {section.plan.fatTargetG !== null
              ? ` · G ${section.plan.fatTargetG}g`
              : ''}
          </p>
        </div>
      ) : section.status === 'empty' ? (
        <div className="space-y-3">
          <p className="text-sm text-(--ws-muted)">
            Todavía no tiene un plan alimenticio activo.
          </p>
          <Link to={nutritionPath} className="ws-btn" data-variant="primary">
            Crear plan alimenticio
          </Link>
        </div>
      ) : (
        <SectionState section={section} />
      )}
    </Card>
  );
}

/** Latest daily weights from check-ins; the full history lives in Seguimiento. */
function BodyWeightSummary({
  entries,
  clientId,
}: {
  entries: BodyWeightEntry[];
  clientId: string;
}) {
  const label = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="text-lg font-semibold tabular-nums">
          {entries[0].weightKg} kg
        </span>{' '}
        <span className="text-(--ws-muted)">
          · {label(entries[0].localDate)} · check-in del cliente
        </span>
      </p>
      {entries.length > 1 && (
        <p className="text-(--ws-muted) tabular-nums">
          Anteriores:{' '}
          {entries
            .slice(1, 5)
            .map((e) => `${e.weightKg} kg (${label(e.localDate)})`)
            .join(' · ')}
        </p>
      )}
      <Link
        to={`/app/clientes/${clientId}/seguimiento`}
        className="font-semibold underline"
      >
        Ver seguimiento
      </Link>
    </div>
  );
}

/** Modules that other epics connect to the record (training has its own card). */
export default function ClientRecordSections({
  sections,
  clientId,
}: {
  sections: ProfessionalRecord['sections'];
  clientId: string;
}) {
  return (
    <div className="client-hub-modules">
      <NutritionSectionCard
        section={sections.nutritionPlan}
        clientId={clientId}
      />
      {sections.evaluations.status === 'available' &&
        sections.evaluations.evaluations.length > 0 && (
          <Card title="Última evaluación" icon="clipboard">
            <EvaluationSummary section={sections.evaluations} />
          </Card>
        )}
      <Card title="Progreso" icon="chart" labelId="record-progress-title">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Seguimiento y evolución</h3>
            <EvolutionSummary section={sections.progress} clientId={clientId} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              Historial de peso corporal
            </h3>
            {sections.bodyWeightHistory.status === 'available' ? (
              <BodyWeightSummary
                entries={sections.bodyWeightHistory.entries}
                clientId={clientId}
              />
            ) : (
              <SectionState section={sections.bodyWeightHistory} />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

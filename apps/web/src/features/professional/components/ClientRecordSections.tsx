import type { ProfessionalRecord, RecordSection } from '../types/record';
import { Card } from '../../../components/ui';

export function SectionState({ section }: { section: RecordSection }) {
  switch (section.status) {
    case 'not_integrated':
      return (
        <p className="text-sm text-(--ws-muted)">
          Esta sección todavía no está disponible.
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

/** Modules that other epics connect to the record (training has its own card). */
export default function ClientRecordSections({
  sections,
}: {
  sections: ProfessionalRecord['sections'];
}) {
  return (
    <div className="client-hub-modules">
      <Card title="Alimentación" icon="bowl" labelId="record-plans-title">
        <SectionState section={sections.nutritionPlan} />
      </Card>
      <Card
        title="Evaluaciones"
        icon="clipboard"
        labelId="record-evaluations-title"
      >
        <SectionState section={sections.evaluations} />
      </Card>
      <Card title="Progreso" icon="chart" labelId="record-progress-title">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Seguimiento y evolución</h3>
            <SectionState section={sections.progress} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              Historial de peso corporal
            </h3>
            <SectionState section={sections.bodyWeightHistory} />
          </div>
        </div>
      </Card>
    </div>
  );
}

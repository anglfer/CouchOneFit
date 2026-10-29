import type { ProfessionalRecord, RecordSection } from '../types/record';

function SectionState({ section }: { section: RecordSection }) {
  switch (section.status) {
    case 'not_integrated':
      return <p>Esta sección todavía no está disponible.</p>;
    case 'empty':
      return <p>Sin registros.</p>;
    case 'error':
      return (
        <p role="alert">
          No pudimos consultar esta sección. Reintenta la lectura del
          expediente.
        </p>
      );
    default:
      // Unknown or malformed metadata is not evidence of an empty module.
      return (
        <p role="alert">No pudimos interpretar el estado de esta sección.</p>
      );
  }
}

export default function ClientRecordSections({
  sections,
}: {
  sections: ProfessionalRecord['sections'];
}) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="record-plans-title">
        <h2 id="record-plans-title" className="font-bold">
          Planes
        </h2>
        <h3>Alimentación</h3>
        <SectionState section={sections.nutritionPlan} />
        <h3>Entrenamiento</h3>
        <SectionState section={sections.trainingPlan} />
      </section>
      <section aria-labelledby="record-evaluations-title">
        <h2 id="record-evaluations-title" className="font-bold">
          Evaluaciones
        </h2>
        <SectionState section={sections.evaluations} />
      </section>
      <section aria-labelledby="record-progress-title">
        <h2 id="record-progress-title" className="font-bold">
          Progreso
        </h2>
        <h3>Seguimiento y evolución</h3>
        <SectionState section={sections.progress} />
        <h3>Historial de peso corporal</h3>
        <SectionState section={sections.bodyWeightHistory} />
      </section>
    </div>
  );
}

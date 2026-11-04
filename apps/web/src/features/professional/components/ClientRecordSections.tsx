import type { ProfessionalRecord, RecordSection } from '../types/record';
import { Link } from '../../../components/Link';

function SectionState({ section }: { section: RecordSection }) {
  switch (section.status) {
    case 'not_integrated':
      return (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Esta sección todavía no está disponible.
        </p>
      );
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
  clientId,
}: {
  sections: ProfessionalRecord['sections'];
  clientId: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <section
        aria-labelledby="record-plans-title"
        className="border rounded-lg p-4 space-y-2"
      >
        <h2 id="record-plans-title" className="font-bold">
          Planes
        </h2>
        <h3 className="font-semibold">Alimentación</h3>
        <SectionState section={sections.nutritionPlan} />
        <h3 className="font-semibold">Entrenamiento</h3>
        {sections.trainingPlan.status === 'available' ? (
          <>
            <p className="font-semibold">{sections.trainingPlan.plan.name}</p>
            <p>
              {sections.trainingPlan.plan.schedule === 'weekly'
                ? 'Semana fija'
                : sections.trainingPlan.plan.schedule === 'cycle'
                  ? 'Ciclo de días'
                  : 'Calendario por fechas'}
            </p>
            <ul>
              {sections.trainingPlan.plan.days.map((day) => (
                <li key={day.id}>
                  {day.name}:{' '}
                  {day.kind === 'rest'
                    ? 'Descanso'
                    : `${day.exercises.length} ejercicios`}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <SectionState section={sections.trainingPlan} />
        )}
        <Link to={`/app/clientes/${clientId}/entrenamiento`} className="ws-btn">
          Gestionar rutina y registros
        </Link>
      </section>
      <section
        aria-labelledby="record-evaluations-title"
        className="border rounded-lg p-4 space-y-2"
      >
        <h2 id="record-evaluations-title" className="font-bold">
          Evaluaciones
        </h2>
        <SectionState section={sections.evaluations} />
      </section>
      <section
        aria-labelledby="record-progress-title"
        className="border rounded-lg p-4 space-y-2"
      >
        <h2 id="record-progress-title" className="font-bold">
          Progreso
        </h2>
        <h3 className="font-semibold">Seguimiento y evolución</h3>
        <SectionState section={sections.progress} />
        <h3 className="font-semibold">Historial de peso corporal</h3>
        <SectionState section={sections.bodyWeightHistory} />
      </section>
    </div>
  );
}

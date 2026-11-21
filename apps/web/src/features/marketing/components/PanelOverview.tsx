import type { ReactElement } from 'react';
import { PanelShot } from '../../../components/ProductShot';
import { SectionHeading } from './SectionHeading';
import { ModuleChip, type ModuleId } from '../modules';

const facts: [string, string, ModuleId | null][] = [
  [
    'Quién necesita tu atención',
    'Clientes sin rutina activa o sin entrenar en la última semana.',
    'entrenamiento',
  ],
  [
    'Check-ins del día',
    'Quién ya registró cómo se siente hoy y quién sigue pendiente.',
    'seguimiento',
  ],
  [
    'Adherencia de 7 días',
    'Entrenamiento y alimentación, contando solo los días con plan.',
    'seguimiento',
  ],
  [
    'Instalable y sin conexión',
    'El panel se instala como app y conserva la consulta reciente cuando falla la red.',
    null,
  ],
];

export function PanelOverview(): ReactElement {
  return (
    <section
      className="mx-auto grid w-full max-w-[1360px] gap-14 px-4 py-24 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:py-32"
      aria-labelledby="overview-title"
    >
      <div>
        <SectionHeading id="overview-title" title="Tu día, de un vistazo.">
          Al abrir el panel sabes a quién escribirle primero.
        </SectionHeading>
        <dl className="m-0 mt-10 border-b-[3px] border-(--sg-ink)">
          {facts.map(([term, detail, module]) => (
            <div key={term} className="border-t-[3px] border-(--sg-ink) py-4">
              <dt className="sg-display flex items-center gap-3 text-[15px] font-bold">
                {module && <ModuleChip id={module} size={30} />}
                {term}
              </dt>
              <dd className="m-0 mt-2 text-base leading-relaxed text-(--sg-ink-2)">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="p-6 sm:p-12">
        <PanelShot
          screen="panel-inicio"
          alt="Inicio del panel profesional: clientes activos, quién entrenó esta semana, check-ins de hoy, adherencia de 7 días y lista de clientes que necesitan atención."
          rings={{
            ring1: 'var(--sg-orange)',
            ring2: 'var(--sg-pink)',
            ring3: 'var(--sg-cobalt)',
          }}
          className="aspect-square md:aspect-[16/10]"
        />
      </div>
    </section>
  );
}

import type { ReactElement } from 'react';
import { PanelShot } from '../../../components/ProductShot';
import { SectionHeading } from './SectionHeading';
import { ModuleChip, type ModuleId } from '../modules';

const prescribes: { text: string; module?: ModuleId }[] = [
  {
    text: 'Evaluaciones por bioimpedancia, perímetros o pliegues, con su evolución.',
    module: 'evaluacion',
  },
  {
    text: 'Rutinas por día con series, repeticiones, carga y descanso.',
    module: 'entrenamiento',
  },
  {
    text: 'Planes de alimentación con tiempos de comida, equivalentes y macros.',
    module: 'alimentacion',
  },
  {
    text: 'Qué medidas y qué adherencia ve tu cliente en su app.',
    module: 'seguimiento',
  },
];
const records: { text: string; module?: ModuleId }[] = [
  {
    text: 'Su check-in diario: peso, sueño, energía, estrés, hambre y cumplimiento.',
  },
  { text: 'Cada serie de su rutina, mientras entrena.' },
  { text: 'Correcciones de su registro hasta dos días después.' },
  { text: 'Nunca cambia lo que tú prescribiste.' },
];

function Column({
  title,
  items,
}: {
  title: string;
  items: { text: string; module?: ModuleId }[];
}): ReactElement {
  return (
    <div>
      <h3 className="sg-display text-xl font-bold text-white sm:text-2xl">
        {title}
      </h3>
      <ul className="m-0 mt-6 list-none p-0">
        {items.map((item) => (
          <li
            key={item.text}
            className="flex items-center gap-4 border-t-2 border-white/80 py-4 text-[17px] leading-snug text-white"
          >
            {item.module && <ModuleChip id={item.module} size={34} outlined />}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductFeatures(): ReactElement {
  return (
    <section id="producto" aria-labelledby="record-title">
      <div className="grid lg:grid-cols-2">
        <div className="bg-(--sg-cobalt) px-4 pb-16 pt-20 sm:px-8 lg:pb-14 lg:pl-[max(2rem,calc((100vw-1360px)/2+2rem))] lg:pr-14 lg:pt-28">
          <SectionHeading
            id="record-title"
            tone="white"
            title="Un expediente. Dos lados."
          >
            Lo que tú prescribes y lo que tu cliente vive cada día quedan en el
            mismo lugar, con fecha.
          </SectionHeading>
          <div className="mt-12">
            <Column title="Tú prescribes" items={prescribes} />
          </div>
        </div>
        <div className="flex flex-col justify-end bg-(--sg-pink) px-4 pb-14 pt-16 sm:px-8 lg:pl-14 lg:pr-[max(2rem,calc((100vw-1360px)/2+2rem))]">
          <Column title="Tu cliente registra" items={records} />
        </div>
      </div>
      <div className="bg-(--sg-pink) px-6 pb-24 pt-16 sm:px-8 lg:bg-[linear-gradient(90deg,var(--sg-cobalt)_50%,var(--sg-pink)_50%)] lg:pb-28">
        <PanelShot
          screen="panel-expediente"
          alt="Expediente de una clienta en el panel con su entrenamiento de la semana, plan alimenticio, peso en check-ins, última evaluación y medidas base."
          rings={{
            gap: 'var(--sg-paper)',
            ring1: 'var(--sg-ink)',
            ring2: 'var(--sg-orange)',
            ring3: 'var(--sg-ink)',
          }}
          className="mx-auto aspect-square max-w-[980px] md:aspect-[16/10]"
        />
      </div>
    </section>
  );
}

import type { ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { SectionHeading } from './SectionHeading';

const audiences: {
  icon: IconName;
  label: string;
  title: string;
  surface: string;
  items: string[];
}[] = [
  {
    icon: 'monitor',
    label: 'Para ti',
    title: 'Un espacio para decidir',
    surface: 'Web profesional, instalable como app',
    items: [
      'Clientes activos y capacidad',
      'Check-ins recientes y pendientes',
      'Progreso e historial continuo',
    ],
  },
  {
    icon: 'smartphone',
    label: 'Para tu cliente',
    title: 'Su día, más claro',
    surface: 'Aplicación móvil',
    items: [
      'Entrenamiento y alimentación del día',
      'Registro de check-in en segundos',
      'Consulta de evolución habilitada',
    ],
  },
];

export function ConnectedExperience(): ReactElement {
  return (
    <section
      className="bg-slate-900 py-24 text-white"
      aria-labelledby="connected-title"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          id="connected-title"
          eyebrow="Una experiencia conectada"
          title="Tú ves el contexto. Tu cliente, el siguiente paso."
          tone="dark"
        >
          Un plan no cuenta toda la historia. El sueño, la energía, el estrés y
          el cumplimiento diario ayudan a entender cómo va cada persona.
        </SectionHeading>

        <div className="grid gap-6 md:grid-cols-2">
          {audiences.map((audience) => (
            <article
              key={audience.label}
              className="rounded-2xl border border-slate-700 bg-slate-800/70 p-8"
            >
              <div className="mb-5 flex items-center gap-3">
                <span
                  className="grid size-11 place-items-center rounded-xl bg-indigo-500/20 text-indigo-300"
                  aria-hidden="true"
                >
                  <Icon name={audience.icon} size={22} />
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    {audience.label}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {audience.surface}
                  </p>
                </div>
              </div>
              <h3 className="text-2xl font-semibold tracking-tight">
                {audience.title}
              </h3>
              <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
                {audience.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-base text-slate-200"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-indigo-500/25 text-indigo-300">
                      <Icon name="check" size={12} strokeWidth={2.5} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

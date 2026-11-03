import type { ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { SectionHeading } from './SectionHeading';

const features: {
  icon: IconName;
  title: string;
  text: string;
  tags: string[];
}[] = [
  {
    icon: 'dumbbell',
    title: 'Entrenamiento con intención',
    text: 'Rutinas por día, ejercicios, series, repeticiones e intensidad. Una versión activa para el cliente y las anteriores en su historial.',
    tags: ['Planifica', 'Asigna', 'Acompaña'],
  },
  {
    icon: 'bowl',
    title: 'Tu criterio, en cada comida',
    text: 'Planes con alimentos, cantidades e instrucciones. Objetivos de calorías y macronutrientes cuando los necesites, siempre bajo tu revisión.',
    tags: ['Alimentos', 'Cantidades', 'Indicaciones'],
  },
];

const record: [string, string][] = [
  ['Su objetivo', 'Crear constancia'],
  ['Su punto de partida', 'Evaluación inicial'],
  ['Su recorrido', 'Evaluaciones con fecha'],
];

export function ProductFeatures(): ReactElement {
  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8"
      id="producto"
      aria-labelledby="features-title"
    >
      <SectionHeading
        id="features-title"
        eyebrow="El producto"
        title="Menos información dispersa. Más contexto para acompañar."
      >
        Estamos reuniendo lo que necesitas para planificar y dar seguimiento,
        sin perder de vista a la persona detrás de cada plan.
      </SectionHeading>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:row-span-1">
          <span
            className="mb-5 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"
            aria-hidden="true"
          >
            <Icon name="clipboard" size={22} />
          </span>
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">
            Una persona. Toda su historia.
          </h3>
          <p className="mt-3 leading-relaxed text-slate-600">
            Datos personales, objetivos y evaluaciones físicas en un expediente.
            Peso, medidas y evolución, con su historial como referencia.
          </p>
          <div
            className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
            aria-label="Ejemplo conceptual de un expediente"
          >
            <div className="mb-3 flex items-center gap-3">
              <span
                className="grid size-9 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
                aria-hidden="true"
              >
                AT
              </span>
              <div className="leading-tight">
                <strong className="block text-sm font-semibold text-slate-900">
                  Ana Torres
                </strong>
                <span className="text-xs text-slate-500">
                  Expediente de ejemplo
                </span>
              </div>
            </div>
            <dl className="m-0 divide-y divide-slate-200 text-sm">
              {record.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="m-0 font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>

        {features.map((feature) => (
          <article
            key={feature.title}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <span
              className="mb-5 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"
              aria-hidden="true"
            >
              <Icon name={feature.icon} size={22} />
            </span>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">
              {feature.title}
            </h3>
            <p className="mt-3 leading-relaxed text-slate-600">
              {feature.text}
            </p>
            <ul
              className="m-0 mt-auto flex list-none flex-wrap gap-2 p-0 pt-6"
              aria-label="Incluye"
            >
              {feature.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

import type { ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';
import { SectionHeading } from './SectionHeading';

const steps: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'clipboard',
    title: 'Conoce y registra',
    text: 'Crea el expediente con los datos, las medidas y el objetivo de tu cliente.',
  },
  {
    icon: 'link',
    title: 'Vincula e invita',
    text: 'Entrega un código individual. Tu cliente crea sus credenciales y accede al expediente que ya preparaste.',
  },
  {
    icon: 'chart',
    title: 'Planifica y acompaña',
    text: 'Activa sus planes, consulta sus check-ins y revisa su evolución para orientar el seguimiento.',
  },
];

export function HowItWorks(): ReactElement {
  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8"
      id="como-funciona"
      aria-labelledby="workflow-title"
    >
      <SectionHeading
        id="workflow-title"
        eyebrow="Cómo funciona"
        title="Una relación profesional. Un recorrido compartido."
      >
        Así está pensado el flujo, desde el primer expediente hasta el
        seguimiento del día a día.
      </SectionHeading>

      <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <span
                className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"
                aria-hidden="true"
              >
                <Icon name={step.icon} size={22} />
              </span>
              <span
                className="text-sm font-semibold text-slate-400"
                aria-hidden="true"
              >
                Paso {index + 1}
              </span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">
              {step.title}
            </h3>
            <p className="mt-3 leading-relaxed text-slate-600">{step.text}</p>
          </li>
        ))}
      </ol>

      <p className="mx-auto mt-10 max-w-xl text-center text-sm text-slate-500">
        El código se usa una sola vez. La relación con el profesional y el
        historial permanecen vinculados a la cuenta.
      </p>
    </section>
  );
}

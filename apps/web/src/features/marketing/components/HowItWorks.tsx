import type { ReactElement } from 'react';
import { SectionHeading } from './SectionHeading';

const steps: { title: string; text: string }[] = [
  {
    title: 'Abre su expediente',
    text: 'Registra datos base, objetivo y su primera evaluación.',
  },
  {
    title: 'Envíale su código',
    text: 'Genera un código de un solo uso. Tu cliente crea su usuario y contraseña y entra directo al expediente que preparaste.',
  },
  {
    title: 'Asigna y acompaña',
    text: 'Activa su rutina y su plan de alimentación, y revisa sus check-ins y su evolución.',
  },
];

export function HowItWorks(): ReactElement {
  return (
    <section
      className="mx-auto w-full max-w-[1360px] px-4 py-24 sm:px-8 lg:py-32"
      id="como-funciona"
      aria-labelledby="workflow-title"
    >
      <SectionHeading
        id="workflow-title"
        title="De la primera cita al seguimiento diario."
      />
      <ol className="sg-route m-0 mt-14 grid list-none gap-12 p-0 md:grid-cols-3 md:gap-10">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[64px_1fr] content-start gap-x-6 md:grid-cols-1"
          >
            <span
              className="sg-stop sg-display text-2xl font-bold"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="md:mt-8">
              <h3 className="sg-display text-xl font-bold">
                <span className="sr-only">Paso {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-3 max-w-[34ch] text-base leading-relaxed text-(--sg-ink-2)">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-12 max-w-[40rem] text-sm text-(--sg-ink-2)">
        El código se usa una sola vez. Después tu cliente entra con sus
        credenciales y la relación contigo queda guardada en su cuenta.
      </p>
    </section>
  );
}

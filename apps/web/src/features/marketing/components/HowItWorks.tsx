import type { ReactElement } from 'react';
import { Icon, type IconName } from '../../../components/Icon';

interface StepItem {
  title: string;
  text: string;
  outcome: string;
  icon: IconName;
}

const steps: StepItem[] = [
  {
    title: 'Crea su expediente',
    text: 'Registra sus datos base, su objetivo y su evaluación inicial.',
    outcome: 'Datos base y evaluación',
    icon: 'clipboard',
  },
  {
    title: 'Entrégale su código',
    text: 'Un código individual de un solo uso. Tu cliente crea sus credenciales y queda vinculado al expediente que preparaste.',
    outcome: 'Código individual de 1 uso',
    icon: 'key',
  },
  {
    title: 'Activa sus planes',
    text: 'Su rutina y su plan de alimentación aparecen en su app.',
    outcome: 'Rutina y plan v1 en su app',
    icon: 'dumbbell',
  },
  {
    title: 'Revisa su evolución',
    text: 'Check-ins, sesiones y evaluaciones con fecha para ajustar el seguimiento.',
    outcome: 'Adherencia 7 d, 4 s o 3 m',
    icon: 'chart',
  },
];

const guarantees = [
  {
    title: 'El cliente nunca edita lo prescrito',
    description:
      'Consulta sus planes y registra su cumplimiento diario sin alterar rutinas, calorías ni evaluaciones.',
  },
  {
    title: 'Historial protegido con baja lógica',
    description:
      'Inactivar un expediente libera el cupo de tu cartera manteniendo sus evaluaciones y versiones previas.',
  },
  {
    title: 'Web instalable en computadora o teléfono',
    description:
      'Trabaja desde tu escritorio o instala la PWA para consultar expedientes incluso sin internet.',
  },
];

/** Un solo recorrido: la línea continua une los pasos en orden. */
export function HowItWorks(): ReactElement {
  return (
    <section
      id="como-funciona"
      aria-labelledby="workflow-title"
      className="scroll-mt-16 border-y border-brand-border bg-brand-surface"
    >
      <div className="mx-auto w-full max-w-[1240px] px-4 py-24 sm:px-8 sm:py-32">
        <h2
          id="workflow-title"
          className="max-w-[18ch] font-display text-[clamp(2rem,1.2rem+2.4vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-brand-ink"
        >
          Del primer expediente al seguimiento diario.
        </h2>

        <ol className="m-0 mt-14 grid list-none gap-10 p-0 sm:mt-20 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[40px_1fr] gap-x-5 lg:block"
            >
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-10 left-[19px] top-10 w-0.5 bg-brand-primary lg:-right-8 lg:bottom-auto lg:left-10 lg:top-[19px] lg:h-0.5 lg:w-auto"
                />
              )}
              <span className="relative z-10 grid size-10 place-items-center rounded-full bg-brand-primary text-base font-semibold tabular-nums text-white ring-[6px] ring-brand-surface">
                {index + 1}
              </span>
              <div className="lg:mt-7 lg:pr-4">
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-brand-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-brand-muted">
                  {step.text}
                </p>
                <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-brand-border-strong bg-white px-2.5 py-1 text-xs font-semibold text-brand-ink">
                  <Icon
                    name={step.icon}
                    size={14}
                    className="text-brand-primary"
                  />
                  {step.outcome}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-14 max-w-[60ch] text-sm leading-relaxed text-[#5b6388]">
          El código se usa una sola vez. Después, tu cliente entra con su
          usuario y contraseña, y la relación con su historial permanece
          vinculada a su cuenta.
        </p>

        <div className="mt-12 grid gap-6 border-t border-brand-border pt-10 md:grid-cols-3 md:gap-0">
          {guarantees.map((guarantee, index) => (
            <div
              key={guarantee.title}
              className={
                index > 0
                  ? 'md:border-l md:border-brand-border md:pl-8'
                  : 'md:pr-8'
              }
            >
              <h3 className="text-base font-semibold text-brand-ink">
                {guarantee.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
                {guarantee.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

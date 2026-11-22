import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';

const questions = [
  {
    question: '¿Para quién está pensado CouchOne Fit?',
    answer:
      'Para entrenadores y nutriólogos que llevan el seguimiento individual de sus clientes. Tú administras expedientes, evaluaciones, alimentación y entrenamiento; tu cliente consulta lo asignado y registra su seguimiento diario.',
  },
  {
    question: '¿La web y la app móvil hacen lo mismo?',
    answer:
      'No. La web es tu espacio de trabajo y funciona en computadora, tablet o móvil; puedes instalarla como app. La app móvil es para tu cliente: consulta su día, sus planes activos y el progreso que le habilitas, y registra sus check-ins. Ambas leen el mismo expediente.',
  },
  {
    question: '¿Cómo se vincula un cliente con su profesional?',
    answer:
      'Primero creas su expediente. Después, tu cliente se registra con usuario, correo y contraseña, y un código individual de un solo uso que lo vincula contigo y con su expediente, sin volver a capturar sus datos físicos. En los accesos posteriores usa sus credenciales, no el código.',
  },
  {
    question: '¿El cliente puede cambiar sus planes o medidas?',
    answer:
      'No. Los datos base, las evaluaciones y las prescripciones los administras tú. Tu cliente consulta la información habilitada y registra el cumplimiento de sus sesiones y sus check-ins; no modifica lo prescrito.',
  },
  {
    question:
      '¿Puedo usar CouchOne Fit si falla el internet en el gimnasio o consultorio?',
    answer:
      'Sí. La web profesional se instala como app (PWA) y guarda tus expedientes consultados para que sigas trabajando sin señal. Los cambios se quedan en tu bandeja de pendientes y se sincronizan al recuperar conexión, protegiendo versiones.',
  },
  {
    question:
      '¿Qué pasa si un cliente pausa su seguimiento o crece mi cartera?',
    answer:
      'Si marcas un expediente como inactivo, conservas intacto su historial y liberas un lugar activo para otra persona. Cuando necesites más capacidad, puedes cambiar de plan desde tu espacio.',
  },
  {
    question: '¿Ya puedo registrarme o contratar un plan?',
    answer:
      'Sí. Crea tu cuenta o elige un plan para iniciar el registro. Registrarte no realiza un cobro ni activa una suscripción; después inicias sesión y eliges tu plan desde tu espacio.',
  },
];

export function FrequentlyAskedQuestions(): ReactElement {
  return (
    <section
      id="preguntas"
      aria-labelledby="faq-title"
      className="scroll-mt-16 border-t border-brand-border"
    >
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <h2
            id="faq-title"
            className="font-display text-[clamp(2rem,1.2rem+2.4vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-brand-ink"
          >
            Preguntas frecuentes
          </h2>
          <p className="mt-5 text-base leading-relaxed text-brand-muted">
            ¿Tienes otra duda?{' '}
            <Link
              to="/registro"
              className="font-semibold text-brand-primary underline decoration-brand-border-strong underline-offset-4 hover:decoration-brand-primary"
            >
              Contáctanos
            </Link>
            .
          </p>
        </div>
        <div className="mk-faq border-b border-brand-border lg:col-span-8">
          {questions.map((item) => (
            <details
              key={item.question}
              className="group border-t border-brand-border"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-semibold text-brand-ink marker:hidden hover:text-brand-primary [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <Icon
                  name="plus"
                  size={20}
                  className="shrink-0 text-brand-primary transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="-mt-2 max-w-[68ch] pb-7 text-base leading-relaxed text-brand-muted">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

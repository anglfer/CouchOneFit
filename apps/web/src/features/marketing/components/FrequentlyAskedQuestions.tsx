import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { SectionHeading } from './SectionHeading';

const questions = [
  {
    question: '¿Para quién está pensado CouchOne Fit?',
    answer:
      'Para entrenadores y nutriólogos que llevan el seguimiento individual de sus clientes. Tú administras expedientes, evaluaciones, alimentación y entrenamiento; tu cliente consulta lo asignado y registra su día.',
  },
  {
    question: '¿La web y la app móvil hacen lo mismo?',
    answer:
      'No. La web es tu espacio de trabajo y se instala como app en computadora, tablet o móvil. La app del cliente muestra su día, sus planes activos y el historial que habilites, y es donde registra sus check-ins y sus series. Ambas usan la misma información.',
  },
  {
    question: '¿Cómo se vincula un cliente conmigo?',
    answer:
      'Primero creas su expediente. Después le das un código individual de un solo uso; con él crea su usuario y contraseña y queda vinculado a ese expediente, sin volver a capturar sus datos. En adelante entra con sus credenciales.',
  },
  {
    question: '¿Mi cliente puede cambiar sus planes o sus medidas?',
    answer:
      'No. Los datos base, las evaluaciones y lo que prescribes los administras tú. Tu cliente registra el cumplimiento de sus sesiones y sus check-ins, y puede corregirlos hasta dos días después.',
  },
  {
    question: '¿Crear mi cuenta tiene costo?',
    answer:
      'No. Registrarte no realiza un cobro ni activa una suscripción. Puedes elegir un plan desde el inicio o más adelante.',
  },
];

export function FrequentlyAskedQuestions(): ReactElement {
  return (
    <section
      className="border-t-[3px] border-(--sg-ink)"
      id="preguntas"
      aria-labelledby="faq-title"
    >
      <div className="mx-auto grid w-full max-w-[1360px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:py-32">
        <SectionHeading id="faq-title" title="Antes de empezar." />
        <div className="sg-faq border-b-[3px] border-(--sg-ink)">
          {questions.map((item) => (
            <details
              key={item.question}
              className="group border-t-[3px] border-(--sg-ink)"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-bold">
                <span>{item.question}</span>
                <Icon
                  name="plus"
                  size={22}
                  strokeWidth={2.4}
                  className="shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-[62ch] pb-6 text-base leading-relaxed text-(--sg-ink-2)">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

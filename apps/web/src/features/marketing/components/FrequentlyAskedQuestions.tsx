import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { SectionHeading } from './SectionHeading';

const questions = [
  {
    question: '¿Para quién está pensado CouchOne Fit?',
    answer:
      'Para entrenadores y nutriólogos que llevan el seguimiento individual de sus clientes. El profesional administra expedientes, evaluaciones, alimentación y entrenamiento; el cliente consulta lo asignado y registra su seguimiento diario.',
  },
  {
    question: '¿La web y la app móvil hacen lo mismo?',
    answer:
      'No. La web/PWA es el espacio de trabajo del profesional, pensado para computadoras, tablets y móviles. La aplicación móvil del cliente está enfocada en consultar su día, sus planes activos y el historial habilitado, además de registrar check-ins. Ambas experiencias compartirán el mismo origen de información.',
  },
  {
    question: '¿Cómo se vincula un cliente con su profesional?',
    answer:
      'Primero, el profesional crea el expediente. Después, el cliente se registra con usuario, correo y contraseña, sus confirmaciones y un código individual de un solo uso. Ese código lo vincula con su profesional y con su expediente existente, sin capturar otra vez sus datos físicos. En los accesos posteriores utiliza sus credenciales, no el código.',
  },
  {
    question: '¿El cliente puede cambiar sus planes o medidas?',
    answer:
      'Los datos base del expediente, las evaluaciones y las prescripciones los administra el profesional. El cliente consulta la información habilitada y registra el cumplimiento de sus sesiones y sus check-ins; no modifica lo prescrito.',
  },
  {
    question: '¿Ya puedo registrarme o contratar un plan?',
    answer:
      'Ya puedes crear tu cuenta desde Contáctanos o elegir un plan para iniciar el registro. Registrarte no realiza un cobro ni activa una suscripción. Después de registrarte puedes iniciar sesión y consultar tu perfil.',
  },
];

export function FrequentlyAskedQuestions(): ReactElement {
  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8"
      id="preguntas"
      aria-labelledby="faq-title"
    >
      <div className="grid gap-12 lg:grid-cols-[2fr_3fr]">
        <SectionHeading
          id="faq-title"
          eyebrow="Preguntas frecuentes"
          title="Antes de dar el siguiente paso"
        >
          Lo esencial sobre CouchOne Fit.
        </SectionHeading>
        <div className="flex flex-col gap-3">
          {questions.map((item) => (
            <details
              key={item.question}
              className="group rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm open:border-indigo-300"
            >
              <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-4 text-base font-semibold text-slate-900">
                <span>{item.question}</span>
                <Icon
                  name="chevron"
                  size={20}
                  className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 leading-relaxed text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

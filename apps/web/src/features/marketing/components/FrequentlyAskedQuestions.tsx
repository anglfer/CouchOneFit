import type { ReactElement } from 'react';

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
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28"
      id="preguntas"
      aria-labelledby="faq-title"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5">
          <h2
            id="faq-title"
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.12]"
          >
            Antes de
            <span className="text-slate-400 font-bold block mt-1">
              dar el siguiente paso.
            </span>
          </h2>
          <p className="text-base text-slate-500 mt-4">
            Lo esencial sobre CouchOne Fit.
          </p>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {questions.map((item) => (
            <details
              key={item.question}
              className="group p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs open:border-indigo-200 transition-all"
            >
              <summary className="flex items-center justify-between text-base font-bold text-slate-900 cursor-pointer list-none select-none gap-4">
                <span>{item.question}</span>
                <span
                  className="w-7 h-7 rounded-full bg-slate-100 group-open:bg-indigo-50 text-slate-500 group-open:text-indigo-600 flex items-center justify-center font-bold text-base shrink-0 group-open:rotate-45 transition-transform"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

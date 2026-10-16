import type { ReactElement } from 'react';
import { Link } from '../../../shared/Link';
import { registrationPlans } from '../../auth/content';

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

export function ProductFeatures(): ReactElement {
  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28"
      id="producto"
      aria-labelledby="features-title"
    >
      <div className="mb-14">
        <h2
          id="features-title"
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]"
        >
          Menos información dispersa.
          <span className="text-slate-400 font-bold block mt-1">
            Más contexto para acompañar.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-500 mt-4 max-w-2xl leading-relaxed">
          Estamos reuniendo lo que necesitas para planificar y dar seguimiento,
          sin perder de vista a la persona detrás de cada plan.
        </p>
      </div>

      <div className="space-y-8">
        {/* Expediente Principal */}
        <article className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 border border-indigo-100/90 shadow-xs">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              Una persona.
              <br />
              Toda su historia.
            </h3>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Datos personales, objetivos y evaluaciones físicas en un
              expediente. Peso, medidas y evolución, con su historial como
              referencia.
            </p>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-indigo-700 bg-indigo-100/70 border border-indigo-200">
                Expediente y evaluaciones
              </span>
            </div>
          </div>

          <div
            className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-md space-y-4"
            aria-label="Ejemplo conceptual de un expediente"
          >
            <div className="flex items-center gap-3">
              <span
                className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs"
                aria-hidden="true"
              >
                AT
              </span>
              <div>
                <strong className="block text-sm font-bold text-slate-900">
                  Ana Torres
                </strong>
                <span className="text-xs text-slate-400 font-medium">
                  Expediente de ejemplo
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-400 font-medium">Su objetivo</dt>
                <dd className="text-slate-800 font-semibold">Crear constancia</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-400 font-medium">Su punto de partida</dt>
                <dd className="text-slate-800 font-semibold">Evaluación inicial</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-400 font-medium">Su recorrido</dt>
                <dd className="text-slate-800 font-semibold">Evaluaciones con fecha</dd>
              </div>
            </dl>

            <div className="flex items-center gap-1.5 pt-2" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-100" />
            </div>
            <p className="text-xs text-slate-400 font-medium pt-1">
              El progreso tiene una historia.
            </p>
          </div>
        </article>

        {/* Entrenamiento y Nutrición en Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <article className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div>
              <span
                className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg mb-6"
                aria-hidden="true"
              >
                ↗
              </span>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                Entrenamiento
                <br />
                con intención.
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mt-3 mb-6">
                Rutinas por día, ejercicios, series, repeticiones e intensidad. Una
                versión activa para el cliente y las anteriores en su historial.
              </p>
              <a
                href="#vista-previa"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Explorar el producto <span aria-hidden="true">→</span>
              </a>
            </div>

            <div
              className="flex items-center gap-2 mt-8 pt-6 border-t border-slate-100 text-xs font-semibold text-slate-500"
              aria-hidden="true"
            >
              <span className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-200/80">
                Planifica
              </span>
              <span className="text-slate-300">→</span>
              <span className="px-3 py-1 rounded-lg bg-slate-50 border border-slate-200/80">
                Asigna
              </span>
              <span className="text-slate-300">→</span>
              <span className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
                Acompaña
              </span>
            </div>
          </article>

          <article className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-purple-200 transition-all">
            <div>
              <span
                className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg mb-6"
                aria-hidden="true"
              >
                ≋
              </span>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                Tu criterio, en
                <br />
                cada comida.
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mt-3 mb-6">
                Planes con alimentos, cantidades e instrucciones. Objetivos de
                calorías y macronutrientes cuando los necesites, siempre bajo tu
                revisión.
              </p>
              <a
                href="#vista-previa"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Explorar el producto <span aria-hidden="true">→</span>
              </a>
            </div>

            <div
              className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-100 text-xs font-medium"
              aria-hidden="true"
            >
              <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700">
                Alimentos
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700">
                Cantidades
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700">
                Indicaciones
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function ConnectedExperience(): ReactElement {
  return (
    <section
      className="bg-slate-900 text-white py-20 sm:py-28"
      aria-labelledby="connected-title"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 space-y-4">
          <h2
            id="connected-title"
            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-[1.15]"
          >
            Tú ves el contexto.
            <span className="text-slate-400 font-bold block mt-1">
              Tu cliente, el siguiente paso.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Un plan no cuenta toda la historia. El sueño, la energía, el estrés
            y el cumplimiento diario ayudan a entender cómo va cada persona.
          </p>
          <div>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Conoce la conexión <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
          <article className="p-6 sm:p-7 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-3 shadow-md">
            <span className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase">
              PARA TI
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Un espacio para decidir.
            </h3>
            <p className="text-xs text-slate-400">Web/PWA profesional</p>
            <ul className="space-y-2 text-xs text-slate-300 pt-2">
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span> Clientes activos y capacidad
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span> Check-ins recientes y pendientes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span> Progreso e historial continuo
              </li>
            </ul>
          </article>

          <article className="p-6 sm:p-7 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-3 shadow-md">
            <span className="text-[11px] font-bold tracking-wider text-purple-400 uppercase">
              PARA TU CLIENTE
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Su día, más claro.
            </h3>
            <p className="text-xs text-slate-400">Aplicación móvil</p>
            <ul className="space-y-2 text-xs text-slate-300 pt-2">
              <li className="flex items-center gap-2">
                <span className="text-purple-400">✓</span> Entrenamiento y alimentación del día
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">✓</span> Registro de check-in en segundos
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">✓</span> Consulta de evolución habilitada
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks(): ReactElement {
  const steps = [
    {
      title: 'Conoce y registra.',
      text: 'Crea el expediente con los datos, las medidas y el objetivo de tu cliente.',
    },
    {
      title: 'Vincula e invita.',
      text: 'Entrega un código individual. Tu cliente crea sus credenciales y accede al expediente que ya preparaste.',
    },
    {
      title: 'Planifica y acompaña.',
      text: 'Activa sus planes, consulta sus check-ins y revisa su evolución para orientar el seguimiento.',
    },
  ];

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28"
      id="como-funciona"
      aria-labelledby="workflow-title"
    >
      <div className="mb-14">
        <h2
          id="workflow-title"
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.12]"
        >
          Una relación profesional.
          <span className="text-slate-400 font-bold block mt-1">
            Un recorrido compartido.
          </span>
        </h2>
        <p className="text-base sm:text-lg text-slate-500 mt-4 max-w-2xl leading-relaxed">
          Así está pensado el flujo, desde el primer expediente hasta el
          seguimiento del día a día.
        </p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between"
          >
            <div>
              <span
                className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 font-extrabold text-lg flex items-center justify-center mb-6 shadow-2xs"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-center text-xs text-slate-500 max-w-xl mx-auto">
        El código se usa una sola vez. La relación con el profesional y el
        historial permanecen vinculados a la cuenta.
      </p>
    </section>
  );
}

export function Plans(): ReactElement {
  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28"
      id="planes"
      aria-labelledby="plans-title"
    >
      <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-indigo-50/50 via-white to-slate-50 border border-indigo-100/80 shadow-xs">
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 uppercase mb-3">
            ENCUENTRA TU ESPACIO
          </span>
          <h2
            id="plans-title"
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
          >
            Un plan para tu forma de trabajar.
          </h2>
          <p className="text-sm sm:text-base text-slate-500 mt-2">
            Elige según tu cartera. Empieza creando tu cuenta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Planes disponibles">
          {registrationPlans.map((plan) => {
            const isPopular = plan.id === 'pro';
            return (
              <article
                className={`p-8 rounded-2xl bg-white flex flex-col justify-between space-y-6 transition-all ${
                  isPopular
                    ? 'border-2 border-indigo-600 shadow-lg relative -translate-y-1'
                    : 'border border-slate-200/90 shadow-xs'
                }`}
                key={plan.id}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900">
                      {plan.name}
                    </h3>
                    {isPopular && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200">
                        Más popular
                      </span>
                    )}
                  </div>

                  <p className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                      ${plan.price}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      MXN / mes
                    </span>
                  </p>

                  <p className="text-sm font-medium text-slate-600">
                    {plan.capacity}
                  </p>
                </div>

                <Link
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold text-center transition-all cursor-pointer ${
                    isPopular
                      ? 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs shadow-indigo-600/30'
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  }`}
                  to={`/registro?plan=${plan.id}`}
                >
                  Elegir plan <span aria-hidden="true">→</span>
                </Link>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Crear tu cuenta no realiza un cobro ni activa una suscripción.
        </p>
      </div>
    </section>
  );
}

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


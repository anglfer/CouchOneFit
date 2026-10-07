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
      'Todavía no. Esta primera versión presenta el alcance previsto y una demostración conceptual. El acceso, las funciones privadas y la contratación están en desarrollo. Los precios, los límites de cada plan y las condiciones comerciales todavía no están definidos.',
  },
];

export function ProductFeatures(): ReactElement {
  return (
    <section
      className="marketing-section marketing-container"
      id="producto"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <h2 id="features-title">
          Menos información dispersa.
          <br />
          <span>Más contexto para acompañar.</span>
        </h2>
        <p>
          Estamos reuniendo lo que necesitas para planificar y dar seguimiento,
          sin perder de vista a la persona detrás de cada plan.
        </p>
      </div>
      <div className="feature-grid">
        <article className="feature-record">
          <div className="feature-copy">
            <h3>
              Una persona.
              <br />
              Toda su historia.
            </h3>
            <p>
              Datos personales, objetivos y evaluaciones físicas en un
              expediente. Peso, medidas y evolución, con su historial como
              referencia.
            </p>
            <span className="feature-reference">Expediente y evaluaciones</span>
          </div>
          <div
            className="record-visual"
            aria-label="Ejemplo conceptual de un expediente"
          >
            <div className="record-person">
              <span className="record-monogram" aria-hidden="true">
                AT
              </span>
              <strong>Ana Torres</strong>
              <span>Expediente de ejemplo</span>
            </div>
            <dl>
              <div>
                <dt>Su objetivo</dt>
                <dd>Crear constancia</dd>
              </div>
              <div>
                <dt>Su punto de partida</dt>
                <dd>Evaluación inicial</dd>
              </div>
              <div>
                <dt>Su recorrido</dt>
                <dd>Evaluaciones con fecha</dd>
              </div>
            </dl>
            <div className="record-history" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>El progreso tiene una historia.</p>
          </div>
        </article>
        <article className="feature-training">
          <span className="feature-index" aria-hidden="true">
            ↗
          </span>
          <h3>
            Entrenamiento
            <br />
            con intención.
          </h3>
          <p>
            Rutinas por día, ejercicios, series, repeticiones e intensidad. Una
            versión activa para el cliente y las anteriores en su historial.
          </p>
          <a href="#vista-previa" className="marketing-text-link">
            Explorar el producto <span aria-hidden="true">→</span>
          </a>
          <div className="training-sequence" aria-hidden="true">
            <span>Planifica</span>
            <i />
            <span>Asigna</span>
            <i />
            <span>Acompaña</span>
          </div>
        </article>
        <article className="feature-nutrition">
          <span className="feature-index" aria-hidden="true">
            ≋
          </span>
          <h3>
            Tu criterio, en
            <br />
            cada comida.
          </h3>
          <p>
            Planes con alimentos, cantidades e instrucciones. Objetivos de
            calorías y macronutrientes cuando los necesites, siempre bajo tu
            revisión.
          </p>
          <a href="#vista-previa" className="marketing-text-link">
            Explorar el producto <span aria-hidden="true">→</span>
          </a>
          <div className="nutrition-labels" aria-hidden="true">
            <span>Alimentos</span>
            <span>Cantidades</span>
            <span>Indicaciones</span>
          </div>
        </article>
      </div>
    </section>
  );
}

export function ConnectedExperience(): ReactElement {
  return (
    <section
      className="connected-section marketing-section"
      aria-labelledby="connected-title"
    >
      <div className="marketing-container connected-grid">
        <div className="connected-copy">
          <h2 id="connected-title">
            Tú ves el contexto.
            <br />
            <span>Tu cliente, el siguiente paso.</span>
          </h2>
          <p>
            Un plan no cuenta toda la historia. El sueño, la energía, el estrés
            y el cumplimiento diario ayudan a entender cómo va cada persona.
          </p>
          <a href="#como-funciona" className="marketing-text-link">
            Conoce la conexión <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="experience-pair">
          <article>
            <span className="experience-label">PARA TI</span>
            <h3>Un espacio para decidir.</h3>
            <p>Web/PWA profesional</p>
            <ul>
              <li>Clientes activos y capacidad de tu plan</li>
              <li>Check-ins recientes y pendientes</li>
              <li>Progreso e historial de seguimiento</li>
            </ul>
          </article>
          <div className="experience-connection">
            <span aria-hidden="true">↕</span>Un mismo expediente
          </div>
          <article>
            <span className="experience-label">PARA TU CLIENTE</span>
            <h3>Su día, más claro.</h3>
            <p>Aplicación móvil</p>
            <ul>
              <li>Entrenamiento y alimentación del día</li>
              <li>Registro de cumplimiento y check-in</li>
              <li>Consulta de su evolución habilitada</li>
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
      className="marketing-container marketing-section workflow-section"
      id="como-funciona"
      aria-labelledby="workflow-title"
    >
      <div className="section-heading">
        <h2 id="workflow-title">
          Una relación profesional.
          <br />
          <span>Un recorrido compartido.</span>
        </h2>
        <p>
          Así está pensado el flujo, desde el primer expediente hasta el
          seguimiento del día a día.
        </p>
      </div>
      <ol className="workflow-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="workflow-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="workflow-note">
        El código se usa una sola vez. La relación con el profesional y el
        historial permanecen vinculados a la cuenta.
      </p>
    </section>
  );
}

export function Plans({
  onOpenAccess,
}: {
  onOpenAccess: () => void;
}): ReactElement {
  return (
    <section
      className="marketing-container plans-section"
      id="planes"
      aria-labelledby="plans-title"
    >
      <div className="plans-panel">
        <div className="plans-copy">
          <span className="marketing-label">UN ESPACIO PARA TU PRÁCTICA</span>
          <h2 id="plans-title">
            Tu acompañamiento.
            <br />A tu escala.
          </h2>
          <p>
            El modelo de suscripción se basará en la capacidad de clientes
            activos de cada profesional. Tú te enfocas en las personas; tu plan
            define el espacio para atenderlas.
          </p>
          <button
            type="button"
            className="marketing-button"
            onClick={onOpenAccess}
          >
            Consultar disponibilidad <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="plans-details">
          <span className="plans-status">Modelo SaaS en desarrollo</span>
          <h3>Crecer, con claridad.</h3>
          <dl>
            <div>
              <dt>Capacidad</dt>
              <dd>Según los clientes activos de tu plan</dd>
            </div>
            <div>
              <dt>Experiencias conectadas</dt>
              <dd>Web profesional y app del cliente</dd>
            </div>
            <div>
              <dt>Disponibilidad comercial</dt>
              <dd>Precios y límites por definir</dd>
            </div>
          </dl>
          <p>
            Aún no hay planes disponibles para contratar. No se realizan cobros
            desde esta página.
          </p>
        </div>
      </div>
    </section>
  );
}

export function FrequentlyAskedQuestions(): ReactElement {
  return (
    <section
      className="marketing-container marketing-section faq-section"
      id="preguntas"
      aria-labelledby="faq-title"
    >
      <div>
        <h2 id="faq-title">
          Antes de
          <br />
          <span>dar el siguiente paso.</span>
        </h2>
        <p>Lo esencial sobre CouchOne Fit.</p>
      </div>
      <div className="faq-list">
        {questions.map((item) => (
          <details key={item.question}>
            <summary>
              {item.question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

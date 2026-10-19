import type { ReactElement } from 'react';

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

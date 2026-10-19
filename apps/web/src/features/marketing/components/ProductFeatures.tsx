import type { ReactElement } from 'react';

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
                <dd className="text-slate-800 font-semibold">
                  Crear constancia
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-400 font-medium">
                  Su punto de partida
                </dt>
                <dd className="text-slate-800 font-semibold">
                  Evaluación inicial
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <dt className="text-slate-400 font-medium">Su recorrido</dt>
                <dd className="text-slate-800 font-semibold">
                  Evaluaciones con fecha
                </dd>
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
                Rutinas por día, ejercicios, series, repeticiones e intensidad.
                Una versión activa para el cliente y las anteriores en su
                historial.
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

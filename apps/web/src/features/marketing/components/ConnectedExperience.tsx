import type { ReactElement } from 'react';

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
                <span className="text-indigo-400">✓</span> Clientes activos y
                capacidad
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span> Check-ins recientes y
                pendientes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-400">✓</span> Progreso e historial
                continuo
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
                <span className="text-purple-400">✓</span> Entrenamiento y
                alimentación del día
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">✓</span> Registro de check-in
                en segundos
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">✓</span> Consulta de evolución
                habilitada
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

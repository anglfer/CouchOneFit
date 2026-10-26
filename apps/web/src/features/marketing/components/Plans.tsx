import type { ReactElement } from 'react';
import { Link } from '../../../components/Link';
import { usePlanCatalog } from '../../../hooks/usePlanCatalog';
import { formatPlanPrice, planCapacity } from '../../../services/planCatalog';

export function Plans(): ReactElement {
  const { plans, loading, error, reload } = usePlanCatalog();
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

        {loading && <p role="status">Cargando planes…</p>}
        {error && (
          <p role="alert">
            {error} <button onClick={reload}>Reintentar</button>
          </p>
        )}
        {!loading && !error && !plans.length && (
          <p>No hay planes disponibles en este momento.</p>
        )}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          aria-label="Planes disponibles"
        >
          {plans.map((plan) => {
            return (
              <article
                className="p-8 rounded-2xl bg-white flex flex-col justify-between space-y-6 transition-all border border-slate-200/90 shadow-xs"
                key={plan.id}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900">
                      {plan.name}
                    </h3>
                  </div>

                  <p className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-4xl font-black text-slate-900 tracking-tight">
                      {formatPlanPrice(plan.priceMxn)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      MXN / mes
                    </span>
                  </p>

                  <p className="text-sm font-medium text-slate-600">
                    {planCapacity(plan)}
                  </p>
                </div>

                <Link
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-center transition-all cursor-pointer text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs"
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

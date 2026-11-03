import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { usePlanCatalog } from '../../../hooks/usePlanCatalog';
import { formatPlanPrice, planCapacity } from '../../../services/planCatalog';
import { SectionHeading } from './SectionHeading';

export function Plans(): ReactElement {
  const { plans, loading, error, reload } = usePlanCatalog();
  return (
    <section
      className="border-y border-slate-200 bg-slate-50 py-24"
      id="planes"
      aria-labelledby="plans-title"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          id="plans-title"
          eyebrow="Planes"
          title="Un plan para tu forma de trabajar"
          align="center"
        >
          Elige según el tamaño de tu cartera. Empieza creando tu cuenta.
        </SectionHeading>

        {loading && (
          <div
            className="grid gap-6 md:grid-cols-3"
            role="status"
            aria-busy="true"
          >
            <span className="sr-only">Cargando planes…</span>
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-60 animate-pulse rounded-2xl bg-slate-200/70"
              />
            ))}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-800"
          >
            {error}{' '}
            <button className="font-semibold underline" onClick={reload}>
              Reintentar
            </button>
          </p>
        )}
        {!loading && !error && !plans.length && (
          <p className="text-center text-slate-600">
            No hay planes disponibles en este momento.
          </p>
        )}

        <div
          className="grid gap-6 md:grid-cols-3"
          aria-label="Planes disponibles"
        >
          {plans.map((plan) => (
            <article
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
              key={plan.id}
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {plan.name}
              </h3>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-4xl font-bold tracking-tight text-slate-900 xl:text-5xl">
                  {formatPlanPrice(plan.priceMxn)}
                </span>
                <span className="whitespace-nowrap text-sm font-medium text-slate-500">
                  MXN / mes
                </span>
              </p>
              <p className="mt-5 flex items-center gap-2.5 text-base text-slate-700">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Icon name="check" size={12} strokeWidth={2.5} />
                </span>
                {planCapacity(plan)}
              </p>
              <Link
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700"
                to={`/registro?plan=${plan.id}`}
              >
                Elegir plan
                <Icon name="arrow-right" size={18} />
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Crear tu cuenta no realiza un cobro ni activa una suscripción.
        </p>
      </div>
    </section>
  );
}

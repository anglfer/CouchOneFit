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
      className="border-t-[3px] border-(--sg-ink) py-24 lg:py-32"
      id="planes"
      aria-labelledby="plans-title"
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-8">
        <SectionHeading
          id="plans-title"
          title="Paga por el tamaño de tu cartera."
        >
          Todos los planes incluyen el panel, la app para tus clientes y todos
          los módulos. Cambia cuántos clientes activos acompañas.
        </SectionHeading>

        {loading && (
          <div
            className="mt-14 grid border-[3px] border-(--sg-ink) md:grid-cols-3"
            role="status"
            aria-busy="true"
          >
            <span className="sr-only">Cargando planes…</span>
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-64 animate-pulse bg-[#efefef] motion-reduce:animate-none [&:nth-child(n+3)]:border-t-[3px] md:[&:nth-child(n+3)]:border-l-[3px] md:[&:nth-child(n+3)]:border-t-0"
              />
            ))}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-14 max-w-xl border-[3px] border-(--sg-ink) p-5 text-base"
          >
            {error}{' '}
            <button
              type="button"
              className="font-bold text-(--sg-cobalt) underline underline-offset-4"
              onClick={reload}
            >
              Reintentar
            </button>
          </p>
        )}
        {!loading && !error && !plans.length && (
          <p className="mt-14 text-base text-(--sg-ink-2)">
            No hay planes disponibles en este momento. Puedes crear tu cuenta y
            elegir uno después.
          </p>
        )}

        {plans.length > 0 && (
          <ul
            className="m-0 mt-14 grid list-none border-[3px] border-(--sg-ink) p-0 md:grid-cols-3"
            aria-label="Planes disponibles"
          >
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="sg-plan flex flex-col border-(--sg-ink) p-6 sm:p-8 [&:nth-child(n+2)]:border-t-[3px] md:[&:nth-child(n+2)]:border-l-[3px] md:[&:nth-child(n+2)]:border-t-0"
              >
                <h3 className="sg-display text-xl font-bold">{plan.name}</h3>
                <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
                  <span className="sg-display text-[2.6rem] font-bold leading-none">
                    {formatPlanPrice(plan.priceMxn)}
                  </span>
                  <span className="sg-plan-muted text-sm font-semibold text-(--sg-ink-2)">
                    MXN al mes
                  </span>
                </p>
                <p className="sg-plan-muted mt-4 text-base text-(--sg-ink-2)">
                  {planCapacity(plan)}
                </p>
                <Link
                  className="sg-btn mt-10 w-full"
                  data-variant="line"
                  to={`/registro?plan=${plan.id}`}
                >
                  Elegir {plan.name} <Icon name="arrow-right" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-sm text-(--sg-ink-2)">
          Crear tu cuenta no realiza un cobro ni activa una suscripción.
        </p>
      </div>
    </section>
  );
}

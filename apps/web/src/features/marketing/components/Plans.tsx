import { useId, useState, type CSSProperties, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { usePlanCatalog } from '../../../hooks/usePlanCatalog';
import {
  formatPlanPrice,
  planCapacity,
  type CatalogPlan,
} from '../../../services/planCatalog';
import {
  formatCostPerClient,
  recommendPlanForClients,
} from '../utils/planRecommendation';

const included = [
  'Panel web instalable como app, con lectura sin conexión',
  'App móvil para tus clientes',
  'Expedientes, evaluaciones, rutinas y alimentación',
  'Check-ins diarios y seguimiento de adherencia',
];

const quickPortfolios = [
  { count: 8, label: '8 clientes' },
  { count: 20, label: '20 clientes' },
  { count: 45, label: '45 clientes' },
];

const MIN_CLIENTS = 1;
const MAX_CLIENTS = 60;

/** Barra de capacidad relativa al plan limitado más grande o a la cartera estimada. */
function CapacityBar({
  plan,
  largest,
  occupancyPercent,
  isRecommended,
}: {
  plan: CatalogPlan;
  largest: number;
  occupancyPercent: number;
  isRecommended: boolean;
}): ReactElement {
  const share = isRecommended
    ? Math.max(8, occupancyPercent)
    : plan.isUnlimited
      ? 100
      : Math.max(8, Math.round(((plan.maxClients ?? 0) / largest) * 72));
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-border">
        <div
          className="h-full rounded-full bg-brand-primary transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

export function Plans(): ReactElement {
  const { plans, loading, error, reload } = usePlanCatalog();
  const [clientCount, setClientCount] = useState(18);
  const sliderId = useId();

  const largest = Math.max(
    1,
    ...plans.filter((plan) => !plan.isUnlimited).map((p) => p.maxClients ?? 0)
  );

  const recommendation = recommendPlanForClients(plans, clientCount);
  const recommendedId = recommendation.recommendedPlan?.id ?? null;
  const costPerClientLabel = recommendation.recommendedPlan
    ? formatCostPerClient(recommendation.recommendedPlan.priceMxn, clientCount)
    : null;
  const rangeFill = `${Math.round(
    ((clientCount - MIN_CLIENTS) / (MAX_CLIENTS - MIN_CLIENTS)) * 100
  )}%`;

  return (
    <section
      id="planes"
      aria-labelledby="plans-title"
      className="mx-auto w-full max-w-[1240px] scroll-mt-16 px-4 py-24 sm:px-8 sm:py-32"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12">
        <h2
          id="plans-title"
          className="font-display text-[clamp(2rem,1.2rem+2.4vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-brand-ink lg:col-span-7"
        >
          Elige según el tamaño de tu cartera.
        </h2>
        <p className="max-w-[48ch] text-lg leading-relaxed text-brand-muted lg:col-span-5">
          Todos los planes incluyen el producto completo; cambia cuántos
          clientes activos acompañas. Crear tu cuenta no realiza un cobro ni
          activa una suscripción.
        </p>
      </div>

      {loading && (
        <div
          className="mt-14 grid gap-5 md:grid-cols-3"
          role="status"
          aria-busy="true"
        >
          <span className="sr-only">Cargando planes…</span>
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-72 rounded-2xl bg-brand-surface motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-14 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            onClick={reload}
          >
            Reintentar
          </button>
        </p>
      )}
      {!loading && !error && !plans.length && (
        <p className="mt-14 text-brand-muted">
          No hay planes disponibles en este momento.
        </p>
      )}

      {plans.length > 0 && (
        <>
          <div className="mt-12 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label
                    htmlFor={sliderId}
                    className="text-base font-semibold text-brand-ink"
                  >
                    ¿Cuántos clientes activos atiendes hoy?
                  </label>
                  <span className="font-display text-2xl font-semibold tabular-nums text-brand-primary">
                    {clientCount === MAX_CLIENTS
                      ? `${MAX_CLIENTS}+ clientes`
                      : `${clientCount} ${clientCount === 1 ? 'cliente' : 'clientes'}`}
                  </span>
                </div>
                <input
                  id={sliderId}
                  type="range"
                  min={MIN_CLIENTS}
                  max={MAX_CLIENTS}
                  value={clientCount}
                  onChange={(event) =>
                    setClientCount(Number(event.target.value))
                  }
                  className="mk-range mt-2"
                  style={{ '--range-fill': rangeFill } as CSSProperties}
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {quickPortfolios.map((preset) => (
                      <button
                        key={preset.count}
                        type="button"
                        aria-pressed={clientCount === preset.count}
                        onClick={() => setClientCount(preset.count)}
                        className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                          clientCount === preset.count
                            ? 'border-brand-primary bg-brand-primary text-white'
                            : 'border-brand-border-strong bg-white text-brand-ink hover:border-brand-primary hover:text-brand-primary'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-[#5b6388]">
                    Los expedientes inactivos no consumen lugares.
                  </span>
                </div>
              </div>

              {recommendation.recommendedPlan && (
                <div
                  aria-live="polite"
                  className="rounded-xl border border-brand-border-strong bg-white p-4 sm:p-5"
                >
                  <p className="text-sm font-semibold text-brand-primary">
                    Plan sugerido: {recommendation.recommendedPlan.name}
                  </p>
                  <p className="mt-1 text-base text-brand-ink">
                    {recommendation.remainingSlots === null
                      ? 'Sin límite de clientes activos para crecer tu cartera.'
                      : recommendation.remainingSlots === 0
                        ? 'Cubre exactamente tu cartera actual.'
                        : `Te deja ${recommendation.remainingSlots} ${
                            recommendation.remainingSlots === 1
                              ? 'lugar libre'
                              : 'lugares libres'
                          } para nuevos ingresos.`}
                  </p>
                  {costPerClientLabel && (
                    <p className="mt-2 text-sm text-[#5b6388]">
                      Aprox.{' '}
                      <strong className="font-semibold tabular-nums text-brand-ink">
                        {costPerClientLabel} MXN
                      </strong>{' '}
                      al mes por cliente activo ({clientCount}{' '}
                      {clientCount === 1 ? 'cliente' : 'clientes'}).
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <ul
            className="m-0 mt-8 grid list-none gap-5 p-0 md:grid-cols-3"
            aria-label="Planes disponibles"
          >
            {plans.map((plan) => {
              const isRecommended = plan.id === recommendedId;
              return (
                <li
                  key={plan.id}
                  className={`flex flex-col rounded-2xl p-7 transition-colors sm:p-8 ${
                    isRecommended
                      ? 'border-2 border-brand-primary bg-[#f8f9ff]'
                      : 'border border-brand-border bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-brand-ink">
                      {plan.name}
                    </h3>
                    {isRecommended && (
                      <span className="rounded-full bg-[#eae8ff] px-3 py-1 text-xs font-semibold text-brand-primary">
                        Sugerido para tu cartera
                      </span>
                    )}
                  </div>
                  <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-display text-5xl font-semibold tabular-nums tracking-[-0.03em] text-brand-ink">
                      {formatPlanPrice(plan.priceMxn)}
                    </span>
                    <span className="text-sm font-medium text-[#5b6388]">
                      MXN al mes
                    </span>
                  </p>
                  <CapacityBar
                    plan={plan}
                    largest={largest}
                    occupancyPercent={recommendation.occupancyPercent}
                    isRecommended={isRecommended}
                  />
                  <p className="mt-3 text-base font-medium text-brand-ink">
                    {planCapacity(plan)}
                  </p>
                  <p className="mt-1 min-h-5 text-sm text-[#5b6388]">
                    {isRecommended && !plan.isUnlimited && plan.maxClients
                      ? `${Math.min(clientCount, plan.maxClients)} de ${plan.maxClients} lugares estimados (${recommendation.occupancyPercent} %)`
                      : isRecommended && plan.isUnlimited
                        ? `Cartera actual: ${clientCount} clientes activos sin tope`
                        : 'Incluye panel PWA y app móvil'}
                  </p>
                  <Link
                    to={`/registro?plan=${plan.id}`}
                    className="mk-btn mt-7 w-full"
                    data-variant={isRecommended ? 'primary' : 'secondary'}
                    aria-label={`Elegir plan ${plan.name}`}
                  >
                    Elegir plan
                    <Icon name="arrow-right" size={18} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-10 border-t border-brand-border pt-8">
        <h3 className="text-base font-semibold text-brand-ink">
          Incluido en todos los planes
        </h3>
        <ul className="m-0 mt-4 grid list-none gap-x-8 gap-y-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {included.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-[15px] leading-snug text-brand-muted"
            >
              <Icon
                name="check"
                size={18}
                strokeWidth={2.25}
                className="mt-px shrink-0 text-brand-primary"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

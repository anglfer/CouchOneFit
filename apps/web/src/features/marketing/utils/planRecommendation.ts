import type { CatalogPlan } from '../../../services/planCatalog';

export interface PlanRecommendation {
  recommendedPlan: CatalogPlan | null;
  remainingSlots: number | null;
  costPerClientMxn: number | null;
  occupancyPercent: number;
}

/** Ordena por cupo ascendente dejando planes ilimitados al final sin mutar el arreglo. */
function sortPlansByCapacity(plans: CatalogPlan[]): CatalogPlan[] {
  return [...plans].sort((a, b) => {
    if (a.isUnlimited && !b.isUnlimited) return 1;
    if (!a.isUnlimited && b.isUnlimited) return -1;
    return (a.maxClients ?? Infinity) - (b.maxClients ?? Infinity);
  });
}

/** Calcula el plan recomendado y métricas derivadas para un tamaño de cartera. */
export function recommendPlanForClients(
  plans: CatalogPlan[],
  clientCount: number
): PlanRecommendation {
  if (plans.length === 0) {
    return {
      recommendedPlan: null,
      remainingSlots: null,
      costPerClientMxn: null,
      occupancyPercent: 0,
    };
  }

  const safeCount = Math.max(1, Math.round(clientCount));
  const ordered = sortPlansByCapacity(plans);
  const recommendedPlan =
    ordered.find(
      (plan) =>
        plan.isUnlimited ||
        (plan.maxClients !== null && plan.maxClients >= safeCount)
    ) ?? ordered[ordered.length - 1];

  const priceNumber = Number(recommendedPlan.priceMxn);
  const costPerClientMxn = Number.isFinite(priceNumber)
    ? Math.round(priceNumber / safeCount)
    : null;

  if (recommendedPlan.isUnlimited || recommendedPlan.maxClients === null) {
    return {
      recommendedPlan,
      remainingSlots: null,
      costPerClientMxn,
      occupancyPercent: 100,
    };
  }

  const max = Math.max(1, recommendedPlan.maxClients);
  const remainingSlots = Math.max(0, max - safeCount);
  const occupancyPercent = Math.min(100, Math.round((safeCount / max) * 100));

  return {
    recommendedPlan,
    remainingSlots,
    costPerClientMxn,
    occupancyPercent,
  };
}

/** Formatea el costo aproximado por cliente activo en pesos mexicanos enteros. */
export function formatCostPerClient(
  priceMxn: number | string,
  clientCount: number
): string | null {
  const numericPrice = Number(priceMxn);
  const safeCount = Math.max(1, Math.round(clientCount));
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) return null;

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Math.round(numericPrice / safeCount));
}

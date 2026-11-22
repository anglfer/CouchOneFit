import { apiClient } from './api';
export interface CatalogPlan {
  id: string;
  name: string;
  maxClients: number | null;
  isUnlimited: boolean;
  priceMxn: number | string;
}
export const readPlanCatalog = () =>
  apiClient<{ plans: CatalogPlan[] }>('/api/plans');
// Precios enteros sin centavos ($299); con centavos si los hay ($299.50).
export const formatPlanPrice = (price: number | string) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: Number.isInteger(Number(price)) ? 0 : 2,
  }).format(Number(price));
export const planCapacity = (plan: CatalogPlan) =>
  plan.isUnlimited
    ? 'Clientes ilimitados'
    : `Hasta ${plan.maxClients} clientes activos`;

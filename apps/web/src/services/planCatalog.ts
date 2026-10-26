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
export const formatPlanPrice = (price: number | string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    Number(price)
  );
export const planCapacity = (plan: CatalogPlan) =>
  plan.isUnlimited
    ? 'Clientes ilimitados'
    : `Hasta ${plan.maxClients} clientes activos`;

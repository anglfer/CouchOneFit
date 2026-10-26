export interface SubscriptionInfo {
  status: 'active' | 'suspended' | 'expired' | 'none';
  planId: string | null;
  planName: string | null;
  limit: number | null;
  isUnlimited: boolean;
  used: number;
  remaining: number | null;
  excess: number;
  expiresAt: string | null;
}
export interface CheckoutPlan {
  id: string;
  name: string;
  maxClients: number | null;
  isUnlimited: boolean;
  priceMxn: string | number;
}
export interface SimulatedPayment {
  id: string;
  planId: string;
  planName: string;
  limit: number | null;
  isUnlimited: boolean;
  amountCents: number;
  currency: 'MXN';
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  failureCode: string | null;
  instrument: string | null;
  createdAt: string;
  quoteExpiresAt: string;
  processingAfter: string | null;
  completedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  simulated: true;
}

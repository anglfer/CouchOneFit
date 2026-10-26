export interface PlanSaaS {
  id: string;
  name: string;
  maxClients: number | null;
  isUnlimited: boolean;
  priceMxn: number | string;
  isActive: boolean;
}
export interface ProfessionalRecord {
  id: string;
  fullName: string;
  email: string;
  accountStatus: 'active' | 'inactive';
  subscriptionStatus: 'active' | 'suspended' | 'expired' | 'none';
  planId: string | null;
  planName: string | null;
  clientsUsed: number;
  inactiveClients: number;
  isUnlimited: boolean;
  limit: number | null;
  expiresAt: string | null;
}

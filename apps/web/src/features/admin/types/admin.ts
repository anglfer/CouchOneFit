export interface PlanSaaS {
  id: string;
  name: string;
  maxClients: number | null; 
  priceMxn: number | string; 
  isActive: boolean;
}

export interface ProfessionalRecord {
  id: string;
  fullName: string;
  email: string;
  subscriptionStatus: 'active' | 'suspended' | 'none';
  planId: string | null;
  planName: string | null;
  clientsUsed: number;
  limit: number | null;
}
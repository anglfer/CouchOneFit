export interface ClientRecord {
  id: string;
  userId: string | null;
  fullName: string;
  goal: string | null;
  status: 'active' | 'inactive';
  invitationExpiresAt: string | null;
}

export interface PortfolioResponse {
  clients: ClientRecord[];
  hasClients: boolean;
  pageInfo: { pageSize: number; hasMore: boolean; nextCursor: string | null };
}

export interface ClientBaseRecord {
  version: number;
  id: string;
  fullName: string;
  goal: string | null;
  status: 'active' | 'inactive';
  birthDate: string | null;
  heightCm: number | null;
  baseWeightKg: number | null;
  baseBodyFatPercentage: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

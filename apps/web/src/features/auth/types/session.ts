export interface Account {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'professional' | 'admin';
  status: 'active';
  subscription: null;
}
export interface SessionResponse {
  account: Account;
}

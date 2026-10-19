export interface Registration {
  fullName: string;
  username: string;
  email: string;
  emailConfirmation: string;
  password: string;
  passwordConfirmation: string;
  phone: string;
  planInterest: 'basic' | 'pro' | 'elite' | null;
  noticeVersion: string;
  acceptsNotice: boolean;
}

export interface ProfessionalIdentity {
  id: string
  username: string
  email: string
  fullName: string
  role: 'professional' | 'admin'
}
export interface SessionIdentity extends ProfessionalIdentity {
  sessionId: string
  expiresAt: Date
}

export interface LoginAccount {
  id: string
  passwordHash: string
  role: 'professional' | 'client' | 'admin'
  status: 'active' | 'inactive'
}

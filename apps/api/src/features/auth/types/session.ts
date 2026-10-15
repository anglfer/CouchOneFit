export interface ProfessionalIdentity {
  id: string
  username: string
  email: string
  fullName: string
}
export interface SessionIdentity extends ProfessionalIdentity {
  sessionId: string
  expiresAt: Date
}

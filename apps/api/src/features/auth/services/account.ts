import type { ProfessionalIdentity } from '../types/session.js'

export function publicAccount(identity: ProfessionalIdentity) {
  if (identity.role === 'client') {
    return {
      id: identity.id,
      clientId: identity.clientId ?? null,
      username: identity.username,
      email: identity.email,
      fullName: identity.fullName,
      role: identity.role,
      status: 'active',
      clientStatus: identity.clientStatus ?? 'active',
    }
  }
  return {
    id: identity.id,
    username: identity.username,
    email: identity.email,
    fullName: identity.fullName,
    role: identity.role,
    status: 'active',
    subscription: null,
  }
}

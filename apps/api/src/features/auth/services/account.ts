import type { ProfessionalIdentity } from '../types/session.js'

export function publicAccount(identity: ProfessionalIdentity) {
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

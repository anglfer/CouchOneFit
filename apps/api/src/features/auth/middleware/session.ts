import type { Request, Response, NextFunction } from 'express'
import type { Pool } from 'pg'
import { cookies } from './session-http.js'
import { authenticate } from '../services/session.js'
import type { SessionIdentity } from '../types/session.js'
import { AuthError } from '../types/errors.js'

declare global {
  namespace Express {
    interface Request {
      professional?: SessionIdentity
      identity?: SessionIdentity
    }
  }
}
export function requireSession(pool: Pool, role?: SessionIdentity['role']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const identity = await authenticate(pool, cookies(req).cof_access)
      if (role && identity.role !== role)
        throw new AuthError(
          403,
          'ROLE_FORBIDDEN',
          'Tu cuenta no tiene acceso a esta área.',
        )
      req.identity = identity
      if (identity.role === 'professional') req.professional = identity
      next()
    } catch (error) {
      next(error)
    }
  }
}
export const requireProfessional = (pool: Pool) =>
  requireSession(pool, 'professional')
export const requireAdmin = (pool: Pool) =>
  requireSession(pool, 'admin')

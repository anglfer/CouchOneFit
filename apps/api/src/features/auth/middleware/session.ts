import type { NextFunction, Request, Response } from 'express'
import type { Pool } from 'pg'
import { authenticate } from '../services/session.js'
import { AuthError } from '../types/errors.js'
import type { SessionIdentity } from '../types/session.js'
import { bearerToken, cookies } from './session-http.js'

declare global {
  namespace Express {
    interface Request {
      professional?: SessionIdentity
      client?: SessionIdentity
      identity?: SessionIdentity
    }
  }
}
export function requireSession(
  pool: Pool,
  role?: SessionIdentity['role'],
  now?: () => Date,
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const bearer = bearerToken(req)
      const currentTime = now?.()
      const identity =
        bearer !== undefined
          ? await authenticate(pool, bearer, 'any', currentTime)
          : await authenticate(pool, cookies(req).cof_access, 'web', currentTime)
      if (role && identity.role !== role)
        throw new AuthError(
          403,
          'ROLE_FORBIDDEN',
          'Tu cuenta no tiene acceso a esta área.',
        )
      req.identity = identity
      if (identity.role === 'professional') req.professional = identity
      if (identity.role === 'client') req.client = identity
      next()
    } catch (error) {
      next(error)
    }
  }
}
export const requireProfessional = (pool: Pool, now?: () => Date) =>
  requireSession(pool, 'professional', now)
export const requireAdmin = (pool: Pool, now?: () => Date) =>
  requireSession(pool, 'admin', now)
export const requireClient = (pool: Pool, now?: () => Date) =>
  requireSession(pool, 'client', now)

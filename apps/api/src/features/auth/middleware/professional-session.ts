import type { Request, Response, NextFunction } from 'express'
import type { Pool } from 'pg'
import { cookies } from './session-http.js'
import { authenticate } from '../services/session.js'
import type { SessionIdentity } from '../types/session.js'

declare global {
  namespace Express {
    interface Request {
      professional?: SessionIdentity
    }
  }
}
export function requireProfessional(pool: Pool) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.professional = await authenticate(pool, cookies(req).cof_access)
      next()
    } catch (error) {
      next(error)
    }
  }
}

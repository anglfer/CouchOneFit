import type { Request, Response, NextFunction } from 'express'
import type { Pool } from 'pg'
import { registerProfessional } from '../services/registration.js'

export function registrationController(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json(await registerProfessional(pool, req.body))
    } catch (error) {
      next(error)
    }
  }
}

import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { listProfessionals } from '../services/professionals.js'
export function adminProfessionalsController(
  pool: Pool,
  now?: () => Date
): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json(await listProfessionals(pool, req.query, now?.()))
    } catch (error) {
      next(error)
    }
  }
}

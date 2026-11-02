import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { readProfessionalRecord } from '../services/record.js'

export function professionalRecordController(pool: Pool, now?: () => Date): RequestHandler {
  return async (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    try {
      res.json(await readProfessionalRecord(pool, req.identity!, req.params.clientId, req.query, now?.()))
    } catch (error) {
      next(error)
    }
  }
}

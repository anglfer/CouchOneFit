import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { readProfessionalProfile } from '../services/profile.js'

export function profileController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const profile = await readProfessionalProfile(pool, req.professional!)
      res.json({ profile })
    } catch (error) {
      next(error)
    }
  }
}

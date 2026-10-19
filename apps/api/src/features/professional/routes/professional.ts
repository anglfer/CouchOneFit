import { Router } from 'express'
import type { Pool } from 'pg'
import { requireProfessional } from '../../auth/middleware/session.js'
import { profileController } from '../controllers/profile.js'

export function professionalRoutes(pool: Pool): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  }, requireProfessional(pool))
  router.get('/profile', profileController(pool))
  return router
}

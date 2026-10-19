import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAdmin } from '../../auth/middleware/session.js'
import { sessionController } from '../../auth/controllers/session.js'

export function adminRoutes(pool: Pool): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  }, requireAdmin(pool))
  router.get('/session', sessionController)
  return router
}

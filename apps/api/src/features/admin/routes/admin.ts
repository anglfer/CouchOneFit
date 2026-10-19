import { Router } from 'express'
import type { Pool } from 'pg'
import { sessionController } from '../../auth/controllers/session.js'
import { requireAdmin } from '../../auth/middleware/session.js'

export function adminRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  }, requireAdmin(pool, now))
  router.get('/session', sessionController)
  return router
}

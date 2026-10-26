import { Router } from 'express'
import type { Pool } from 'pg'
import { requireProfessional } from '../../auth/middleware/session.js'
import { requireCsrf } from '../../auth/middleware/session-http.js'
import { clientCapacityControllers } from '../controllers/clients.js'
export function capacityRoutes(pool: Pool, now?: () => Date) {
  const router = Router()
  const controller = clientCapacityControllers(pool, now)
  router.use(
    (_req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    },
    requireProfessional(pool, now),
    requireCsrf
  )
  router.post('/', controller.create)
  router.patch('/:clientId/status', controller.status)
  return router
}

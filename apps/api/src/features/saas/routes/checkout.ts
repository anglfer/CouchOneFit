import { Router } from 'express'
import type { Pool } from 'pg'
import { requireProfessional } from '../../auth/middleware/session.js'
import { requireCsrf } from '../../auth/middleware/session-http.js'
import { checkoutControllers } from '../controllers/checkout.js'
export function checkoutRoutes(pool: Pool, now?: () => Date) {
  const router = Router(),
    controller = checkoutControllers(pool)
  router.use(
    (_req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    },
    requireProfessional(pool, now)
  )
  router.get('/plans', controller.plans)
  router.get('/payments', controller.history)
  router.post('/payments', requireCsrf, controller.quote)
  router.get('/payments/:id', controller.read)
  router.post('/payments/:id/confirm', requireCsrf, controller.confirm)
  router.post('/payments/:id/cancel', requireCsrf, controller.cancel)
  return router
}

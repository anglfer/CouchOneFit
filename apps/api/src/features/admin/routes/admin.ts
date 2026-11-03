import { AuthError } from '../../auth/types/errors.js'
import { Router } from 'express'
import type { Pool } from 'pg'
import { sessionController } from '../../auth/controllers/session.js'
import { requireAdmin } from '../../auth/middleware/session.js'
import { requireCsrf } from '../../auth/middleware/session-http.js'
import { plansController } from '../controllers/plans.js'
import { supportControllers } from '../controllers/support.js'
import { adminProfessionalsController } from '../controllers/professionals.js'
export function adminRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router()
  router.use(
    (_req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    },
    requireAdmin(pool, now)
  )
  router.get('/session', sessionController)
  const plans = plansController(pool)
  router.get('/plans', plans.list)
  router.post('/plans', requireCsrf, plans.create)
  router.put('/plans/:id', requireCsrf, plans.update)
  router.get('/professionals', adminProfessionalsController(pool, now))
  const support = supportControllers(pool)
  router.get('/support/clients', support.clients)
  router.post('/support/clients/:clientId/view', requireCsrf, support.view)
  router.get('/support/log', support.log)
  router.all('/professionals/:id/subscription', (_req, _res, next) =>
    next(
      new AuthError(
        403,
        'SUBSCRIPTION_READ_ONLY',
        'El administrador solo puede consultar las suscripciones.'
      )
    )
  )
  return router
}

import { Router } from 'express'
import type { Pool } from 'pg'
import { requireProfessional } from '../../auth/middleware/session.js'
import { requireCsrf } from '../../auth/middleware/session-http.js'
import { clientCapacityControllers } from '../controllers/clients.js'
import { clientEditController } from '../../professional/controllers/client-edit.js'
import { idempotent } from '../../idempotency/middleware/idempotency.js'
export function capacityRoutes(pool: Pool, now?: () => Date) {
  const router = Router()
  const controller = clientCapacityControllers(pool, now)
  // DEC-018: crear, editar y cambiar de estado admiten `Idempotency-Key` (escrituras sin conexión).
  const once = idempotent(pool)
  router.use(
    (_req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    },
    requireProfessional(pool, now),
    requireCsrf
  )
  router.post('/', once, controller.create)
  router.patch('/:clientId', once, clientEditController(pool, now))
  router.patch('/:clientId/status', once, controller.status)
  router.patch('/:clientId/account', controller.account)
  return router
}

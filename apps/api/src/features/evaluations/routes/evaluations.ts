import { Router } from 'express'
import type { Pool } from 'pg'
import { requireProfessional } from '../../auth/middleware/session.js'
import { requireCsrf } from '../../auth/middleware/session-http.js'
import { idempotent } from '../../idempotency/middleware/idempotency.js'
import { evaluationControllers } from '../controllers/evaluation.js'

export function evaluationRoutes(
  pool: Pool,
  now: () => Date = () => new Date(),
) {
  const router = Router()
  const controller = evaluationControllers(pool, now)
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.get(
    '/:clientId/evaluation-history',
    requireProfessional(pool, now),
    controller.history,
  )
  router.get(
    '/:clientId/evaluations',
    requireProfessional(pool, now),
    controller.list,
  )
  router.post(
    '/:clientId/evaluations',
    requireProfessional(pool, now),
    requireCsrf,
    idempotent(pool),
    controller.create,
  )
  return router
}

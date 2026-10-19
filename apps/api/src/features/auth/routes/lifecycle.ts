import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { lifecycleControllers } from '../controllers/lifecycle.js'
import {
  requireClient,
  requireProfessional,
  requireSession,
} from '../middleware/session.js'
import { requireCsrf } from '../middleware/session-http.js'

export function lifecycleRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  // shortcut: rate limit por instancia; compartir el almacén antes de escalar la API.
  const limiter = () =>
    rateLimit({
      windowMs: 15 * 60000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.',
        },
      },
    })
  const controller = lifecycleControllers(pool, now)
  router.patch(
    '/me/credentials',
    limiter(),
    requireClient(pool, now),
    controller.credentials
  )
  router.post(
    '/clients/:clientId/invitations',
    limiter(),
    requireCsrf,
    requireProfessional(pool, now),
    controller.invitation
  )
  router.delete(
    '/clients/:clientId/invitations',
    requireCsrf,
    requireProfessional(pool, now),
    controller.revoke
  )
  router.post('/auth/activation/prevalidate', limiter(), controller.prevalidate)
  router.post('/auth/activation', limiter(), controller.activation)
  router.post(
    '/accounts/:userId/recovery',
    limiter(),
    requireCsrf,
    requireSession(pool, undefined, now),
    controller.issueReset
  )
  router.post('/auth/recovery/reset', limiter(), controller.reset)
  router.get('/clients', requireProfessional(pool, now), controller.clients)
  router.get(
    '/accounts/recovery-targets',
    requireSession(pool, undefined, now),
    controller.recoveryTargets
  )
  return router
}

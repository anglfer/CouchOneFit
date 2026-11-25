import { Router, json } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { requireSession } from '../../auth/middleware/session.js'
import { bearerToken, requireCsrf } from '../../auth/middleware/session-http.js'
import { observabilityPublicControllers } from '../controllers/observability.js'
import { requireIngestToken } from '../middleware/ingest-auth.js'

export function publicObservabilityRoutes(
  pool: Pool,
  now?: () => Date,
): Router {
  const router = Router()
  const c = observabilityPublicControllers(pool)

  const clientLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Límite de telemetría alcanzado.',
      },
    },
  })

  router.post(
    '/ingest',
    requireIngestToken,
    json({ limit: '512kb' }),
    c.ingest,
  )
  router.get('/monitor-config', requireIngestToken, c.monitorConfig)
  router.post(
    '/client-events',
    (_req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    },
    clientLimiter,
    requireSession(pool, undefined, now),
    (req, res, next) =>
      bearerToken(req) !== undefined ? next() : requireCsrf(req, res, next),
    json({ limit: '4kb' }),
    c.clientEvents,
  )

  return router
}

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import {
  clientLoginController,
  clientLogoutController,
  clientRefreshController,
  loginController,
  logoutController,
  refreshController,
  sessionController,
} from '../controllers/session.js'
import { requireSession } from '../middleware/session.js'
import { csrfToken, requireCsrf } from '../middleware/session-http.js'

export function sessionRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  // shortcut: memoria por instancia; usar almacén compartido antes de escalar la API.
  const limiter = (limit: number) =>
    rateLimit({
      windowMs: 15 * 60000,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.',
        },
      },
    })
  router.get('/csrf', limiter(100), csrfToken)
  router.post('/login', limiter(20), requireCsrf, loginController(pool, now))
  router.post('/client/login', limiter(20), clientLoginController(pool, now))
  router.get('/session', requireSession(pool, undefined, now), sessionController)
  router.post(
    '/refresh',
    limiter(100),
    requireCsrf,
    refreshController(pool, now),
  )
  router.post(
    '/client/refresh',
    limiter(100),
    clientRefreshController(pool, now),
  )
  router.post('/logout', requireCsrf, logoutController(pool, now))
  router.post('/client/logout', clientLogoutController(pool, now))
  return router
}

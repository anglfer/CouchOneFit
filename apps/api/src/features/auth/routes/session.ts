import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { csrfToken, requireCsrf } from '../middleware/session-http.js'
import { requireSession } from '../middleware/session.js'
import {
  loginController,
  refreshController,
  logoutController,
  sessionController,
} from '../controllers/session.js'

export function sessionRoutes(pool: Pool): Router {
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
  router.post('/login', limiter(20), requireCsrf, loginController(pool))
  router.get('/session', requireSession(pool), sessionController)
  router.post('/refresh', limiter(100), requireCsrf, refreshController(pool))
  router.post('/logout', requireCsrf, logoutController(pool))
  return router
}

import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { registrationController } from '../controllers/registration.js'
import { config } from '../../../config/index.js'

export function registrationRoutes(pool: Pool): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  // shortcut: memoria por instancia; usar almacén compartido antes de escalar la API.
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.',
      },
    },
  })
  router.post(
    '/professionals',
    limit,
    (req, res, next) => {
      if (
        req.headers.origin &&
        !config.allowedOrigins.includes(req.headers.origin)
      ) {
        res.status(403).json({
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Solicitud no permitida.',
          },
        })
        return
      }
      next()
    },
    registrationController(pool),
  )
  return router
}

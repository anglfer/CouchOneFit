import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import type { Pool } from 'pg'
import { config } from './config/index.js'
import { pool } from './config/database.js'
import { registrationRoutes } from './features/auth/routes/registration.js'
import { AuthError } from './features/auth/types/errors.js'
import { sessionRoutes } from './features/auth/routes/session.js'
import { professionalRoutes } from './features/professional/routes/professional.js'
import { adminRoutes } from './features/admin/routes/admin.js'
import { clientRoutes } from './features/client/routes/client.js'

export function createApp(database: Pool): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    })
  })
  app.use('/api/auth', registrationRoutes(database))
  app.use('/api/auth', sessionRoutes(database))
  app.use('/api/admin', adminRoutes(database))
  app.use('/api/professional', professionalRoutes(database))
  app.use('/api/client', clientRoutes(database))
  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Recurso no disponible.' } })
  })
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      res.set('Cache-Control', 'no-store')
      if (error instanceof AuthError) {
        res
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } })
        return
      }
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? error.status
          : 500
      res.status(status === 400 || status === 413 ? status : 503).json({
        error: {
          code:
            status === 400
              ? 'INVALID_JSON'
              : status === 413
                ? 'PAYLOAD_TOO_LARGE'
                : 'SERVICE_UNAVAILABLE',
          message:
            status === 400
              ? 'El formulario no tiene un formato válido.'
              : status === 413
                ? 'El formulario excede el tamaño permitido.'
                : 'No pudimos completar la solicitud.',
        },
      })
    },
  )
  return app
}
export const app = createApp(pool)
export default app

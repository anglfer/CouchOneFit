import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import {
  cookies,
  csrfToken,
  requireCsrf,
  setSessionCookies,
  clearSessionCookies,
} from '../middleware/session-http.js'
import { requireSession } from '../middleware/professional-session.js'
import {
  loginAccount,
  refreshAccount,
  logoutAccount,
  invalidSession,
} from '../services/session.js'
import { publicAccount } from '../repositories/session.js'

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
  router.post('/login', limiter(20), requireCsrf, (async (req, res, next) => {
    try {
      const session = await loginAccount(pool, req.body)
      setSessionCookies(res, session)
      res.json({ account: session.account })
    } catch (error) {
      next(error)
    }
  }) as RequestHandler)
  router.get('/session', requireSession(pool), (req, res) => {
    res.json({ account: publicAccount(req.identity!) })
  })
  router.post('/refresh', limiter(100), requireCsrf, (async (
    req,
    res,
    next,
  ) => {
    try {
      const session = await refreshAccount(pool, cookies(req).cof_refresh)
      if (!session) {
        clearSessionCookies(res)
        throw invalidSession()
      }
      setSessionCookies(res, session)
      res.json({ account: session.account })
    } catch (error) {
      next(error)
    }
  }) as RequestHandler)
  router.post('/logout', requireCsrf, (async (req, res, next) => {
    try {
      const jar = cookies(req)
      await logoutAccount(pool, jar.cof_refresh, jar.cof_access)
      clearSessionCookies(res)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }) as RequestHandler)
  return router
}

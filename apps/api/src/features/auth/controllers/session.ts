import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import {
  cookies,
  bearerToken,
  setSessionCookies,
  clearSessionCookies,
} from '../middleware/session-http.js'
import {
  loginAccount,
  refreshAccount,
  logoutAccount,
} from '../services/session.js'
import {
  validateRefreshPayload,
  validateLogoutPayload,
} from '../validators/login.js'
import { invalidSession } from '../types/errors.js'
import { publicAccount } from '../services/account.js'

export function loginController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await loginAccount(pool, req.body, 'web')
      setSessionCookies(res, session)
      res.json({ account: session.account })
    } catch (error) {
      next(error)
    }
  }
}

export function clientLoginController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await loginAccount(pool, req.body, 'client')
      res.json({
        account: session.account,
        session: {
          accessToken: session.access,
          refreshToken: session.refresh,
          expiresAt: session.expiresAt.toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export function refreshController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await refreshAccount(pool, cookies(req).cof_refresh, 'web')
      if (!session) {
        clearSessionCookies(res)
        throw invalidSession()
      }
      setSessionCookies(res, session)
      res.json({ account: session.account })
    } catch (error) {
      next(error)
    }
  }
}

export function clientRefreshController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const refreshToken = validateRefreshPayload(req.body)
      const session = await refreshAccount(pool, refreshToken, 'client')
      if (!session) throw invalidSession()
      res.json({
        account: session.account,
        session: {
          accessToken: session.access,
          refreshToken: session.refresh,
          expiresAt: session.expiresAt.toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export function logoutController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const jar = cookies(req)
      await logoutAccount(pool, jar.cof_refresh, jar.cof_access)
      clearSessionCookies(res)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
}

export function clientLogoutController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const refreshToken = validateLogoutPayload(req.body)
      await logoutAccount(pool, refreshToken, bearerToken(req))
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
}

export const sessionController: RequestHandler = (req, res) => {
  res.json({ account: publicAccount(req.identity!) })
}

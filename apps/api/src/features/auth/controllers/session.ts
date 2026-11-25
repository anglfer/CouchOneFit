import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import {
  bearerToken,
  clearSessionCookies,
  cookies,
  setSessionCookies,
} from '../middleware/session-http.js'
import { publicAccount } from '../services/account.js'
import {
  loginAccount,
  logoutAccount,
  refreshAccount,
} from '../services/session.js'
import { AuthError, invalidSession } from '../types/errors.js'
import { logger } from '../../../shared/utils/logger.js'
import {
  validateLogoutPayload,
  validateRefreshPayload,
} from '../validators/login.js'

function logAuth(
  event: string,
  res: { locals: { requestId?: unknown } },
  audience: 'web' | 'client',
  account?: { id: string; role: string },
) {
  logger.info(event, {
    requestId: res.locals.requestId,
    audience,
    ...(account ? { accountId: account.id, role: account.role } : {}),
  })
}

export function loginController(
  pool: Pool,
  now?: () => Date,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await loginAccount(pool, req.body, 'web', now?.())
      setSessionCookies(res, session)
      logAuth('auth.login_succeeded', res, 'web', session.account)
      res.json({ account: session.account })
    } catch (error) {
      next(error)
    }
  }
}

export function clientLoginController(
  pool: Pool,
  now?: () => Date,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await loginAccount(pool, req.body, 'client', now?.())
      logAuth('auth.login_succeeded', res, 'client', session.account)
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

export function refreshController(
  pool: Pool,
  now?: () => Date,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await refreshAccount(
        pool,
        cookies(req).cof_refresh,
        'web',
        now?.(),
      )
      if (!session) {
        clearSessionCookies(res)
        throw invalidSession()
      }
      setSessionCookies(res, session)
      logAuth('auth.refresh_succeeded', res, 'web', session.account)
      res.json({ account: session.account })
    } catch (error) {
      if (error instanceof AuthError && error.status === 401) {
        clearSessionCookies(res)
      }
      next(error)
    }
  }
}

export function clientRefreshController(
  pool: Pool,
  now?: () => Date,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const refreshToken = validateRefreshPayload(req.body)
      const session = await refreshAccount(pool, refreshToken, 'client', now?.())
      if (!session) throw invalidSession()
      logAuth('auth.refresh_succeeded', res, 'client', session.account)
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

export function logoutController(
  pool: Pool,
  now?: () => Date,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const jar = cookies(req)
      await logoutAccount(pool, jar.cof_refresh, jar.cof_access, now?.())
      clearSessionCookies(res)
      logAuth('auth.logout', res, 'web')
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
}

export function clientLogoutController(
  pool: Pool,
  now?: () => Date,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const refreshToken = validateLogoutPayload(req.body)
      await logoutAccount(pool, refreshToken, bearerToken(req), now?.())
      logAuth('auth.logout', res, 'client')
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  }
}

export const sessionController: RequestHandler = (req, res) => {
  res.json({ account: publicAccount(req.identity!) })
}

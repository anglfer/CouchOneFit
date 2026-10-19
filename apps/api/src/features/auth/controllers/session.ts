import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import {
  cookies,
  setSessionCookies,
  clearSessionCookies,
} from '../middleware/session-http.js'
import {
  loginAccount,
  refreshAccount,
  logoutAccount,
} from '../services/session.js'
import { invalidSession } from '../types/errors.js'
import { publicAccount } from '../services/account.js'

export function loginController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await loginAccount(pool, req.body)
      setSessionCookies(res, session)
      res.json({ account: session.account })
    } catch (error) {
      next(error)
    }
  }
}

export function refreshController(pool: Pool): RequestHandler {
  return async (req, res, next) => {
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

export const sessionController: RequestHandler = (req, res) => {
  res.json({ account: publicAccount(req.identity!) })
}

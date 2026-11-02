import { listPortfolio, readPortfolioRecord } from '../../professional/services/portfolio.js'
import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import {
  activateAccount,
  changeCredentials,
  issueInvitation,
  issueReset,
  prevalidateInvitation,
  resetPassword,
  revokeInvitation,
  listRecoveryTargets,
} from '../services/lifecycle.js'
import { uuid } from '../validators/lifecycle.js'
import { clearSessionCookies } from '../middleware/session-http.js'

export function lifecycleControllers(pool: Pool, now?: () => Date) {
  const handle =
    (operation: RequestHandler): RequestHandler =>
    async (req, res, next) => {
      try {
        await operation(req, res, next)
      } catch (error) {
        next(error)
      }
    }
  return {
    clients: handle(async (req, res) => {
      res.json(await listPortfolio(pool, req.identity!, req.query, now?.()))
    }),
    client: handle(async (req, res) => {
      res.json(await readPortfolioRecord(pool, req.identity!, req.params.clientId, now?.()))
    }),
    recoveryTargets: handle(async (req, res) => {
      res.json({ accounts: await listRecoveryTargets(pool, req.identity!) })
    }),
    credentials: handle(async (req, res) => {
      await changeCredentials(pool, req.identity!, req.body, now?.())
      res.status(204).end()
    }),
    invitation: handle(async (req, res) => {
      res
        .status(201)
        .json(
          await issueInvitation(
            pool,
            req.identity!,
            uuid(req.params.clientId),
            now?.()
          )
        )
    }),
    revoke: handle(async (req, res) => {
      await revokeInvitation(
        pool,
        req.identity!,
        uuid(req.params.clientId),
        now?.()
      )
      res.status(204).end()
    }),
    prevalidate: handle(async (req, res) => {
      res.json(await prevalidateInvitation(pool, req.body, now?.()))
    }),
    activation: handle(async (req, res) => {
      const result = await activateAccount(pool, req.body, now?.())
      const session = result.session
      res.status(201).json(
        session
          ? {
              activated: true,
              account: session.account,
              session: {
                accessToken: session.access,
                refreshToken: session.refresh,
                expiresAt: session.expiresAt.toISOString(),
              },
            }
          : {
              activated: true,
              requiresLogin: true,
              message:
                'Tu cuenta está activada. Inicia sesión con tus credenciales.',
            }
      )
    }),
    issueReset: handle(async (req, res) => {
      res
        .status(201)
        .json(
          await issueReset(
            pool,
            req.identity!,
            uuid(req.params.userId),
            req.body,
            now?.()
          )
        )
    }),
    reset: handle(async (req, res) => {
      await resetPassword(pool, req.body, now?.())
      clearSessionCookies(res)
      res.status(204).end()
    }),
  }
}

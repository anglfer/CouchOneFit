import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { createClient, setClientStatus } from '../services/clients.js'
export function clientCapacityControllers(pool: Pool, now?: () => Date) {
  return {
    create: (async (req, res, next) => {
      try {
        res
          .status(201)
          .json({
            client: await createClient(pool, req.identity!, req.body, now?.()),
          })
      } catch (error) {
        next(error)
      }
    }) as RequestHandler,
    status: (async (req, res, next) => {
      try {
        res.json({
          client: await setClientStatus(
            pool,
            req.identity!,
            req.params.clientId,
            req.body,
            now?.()
          ),
        })
      } catch (error) {
        next(error)
      }
    }) as RequestHandler,
  }
}

import type { Request, RequestHandler, Response } from 'express'
import type { Pool } from 'pg'
import {
  listSupportClients,
  readSupportLog,
  viewSupportClient,
} from '../services/support.js'
export function supportControllers(pool: Pool) {
  const wrap =
    (run: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    async (req, res, next) => {
      try {
        await run(req, res)
      } catch (error) {
        next(error)
      }
    }
  return {
    clients: wrap(async (req, res) => {
      res.json(await listSupportClients(pool, req.identity!, req.query))
    }),
    view: wrap(async (req, res) => {
      res.json({
        record: await viewSupportClient(
          pool,
          req.identity!,
          req.params.clientId,
          req.body
        ),
      })
    }),
    log: wrap(async (req, res) => {
      res.json(await readSupportLog(pool, req.identity!, req.query))
    }),
  }
}

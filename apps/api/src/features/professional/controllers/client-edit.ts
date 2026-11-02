import type { Pool } from 'pg'
import type { RequestHandler } from 'express'
import { editClientRecord } from '../services/client-edit.js'

export function clientEditController(
  pool: Pool,
  now?: () => Date
): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json(
        await editClientRecord(
          pool,
          req.identity!,
          req.params.clientId,
          req.body,
          now?.()
        )
      )
    } catch (error) {
      next(error)
    }
  }
}

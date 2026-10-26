import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { readProfessionalSubscription } from '../services/subscription.js'
export function subscriptionController(
  pool: Pool,
  now?: () => Date
): RequestHandler {
  return async (req, res, next) => {
    try {
      res.json({
        subscription: await readProfessionalSubscription(
          pool,
          req.professional!,
          now?.()
        ),
      })
    } catch (error) {
      next(error)
    }
  }
}

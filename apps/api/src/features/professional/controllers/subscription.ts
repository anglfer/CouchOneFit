import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import {
  downgradeSubscription,
  readProfessionalSubscription,
  updateSubscriptionPreferences,
} from '../services/subscription.js'
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
// DEC-017: cancel/renewal method (PATCH) and downgrade (POST); both answer with the new state.
export function subscriptionChangeController(
  pool: Pool,
  kind: 'preferences' | 'downgrade',
  now?: () => Date
): RequestHandler {
  return async (req, res, next) => {
    try {
      const date = now?.()
      if (kind === 'preferences')
        await updateSubscriptionPreferences(pool, req.professional!, req.body, date)
      else await downgradeSubscription(pool, req.professional!, req.body, date)
      res.json({
        subscription: await readProfessionalSubscription(
          pool,
          req.professional!,
          date
        ),
      })
    } catch (error) {
      next(error)
    }
  }
}

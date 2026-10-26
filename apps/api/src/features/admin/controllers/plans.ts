import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { findPlans } from '../repositories/plans.js'
import { writePlan } from '../services/plans.js'
export function plansController(pool: Pool) {
  return {
    list: (async (_req, res, next) => {
      try {
        res.json({ plans: await findPlans(pool) })
      } catch (error) {
        next(error)
      }
    }) as RequestHandler,
    create: (async (req, res, next) => {
      try {
        res
          .status(201)
          .json({ plan: await writePlan(pool, req.identity!, req.body) })
      } catch (error) {
        next(error)
      }
    }) as RequestHandler,
    update: (async (req, res, next) => {
      try {
        res.json({
          plan: await writePlan(pool, req.identity!, req.body, req.params.id),
        })
      } catch (error) {
        next(error)
      }
    }) as RequestHandler,
  }
}

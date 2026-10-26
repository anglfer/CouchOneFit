import { Router } from 'express'
import type { Pool } from 'pg'
import { checkoutControllers } from '../controllers/checkout.js'
export function publicPlanRoutes(pool: Pool) {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/', checkoutControllers(pool).plans)
  return router
}

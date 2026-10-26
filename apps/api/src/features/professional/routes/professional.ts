import { Router } from 'express'
import type { Pool } from 'pg'
import { requireProfessional } from '../../auth/middleware/session.js'
import { profileController } from '../controllers/profile.js'
import { subscriptionController } from '../controllers/subscription.js';

export function professionalRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  }, requireProfessional(pool, now))
  router.get('/profile', profileController(pool))
  router.get('/subscription', subscriptionController(pool, now));
  return router
}

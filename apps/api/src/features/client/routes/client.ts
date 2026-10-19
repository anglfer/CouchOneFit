import { Router } from 'express';
import type { Pool } from 'pg';
import { requireClient } from '../../auth/middleware/session.js';
import { clientProfileController } from '../controllers/profile.js';

export function clientRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, requireClient(pool, now));
  router.get('/profile', clientProfileController(pool));
  return router;
}

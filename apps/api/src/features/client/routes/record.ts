import { Router } from 'express';
import type { Pool } from 'pg';
import { requireClient } from '../../auth/middleware/session.js';
import { clientRecordController } from '../controllers/profile.js';

export function clientRecordRoutes(pool: Pool, now?: () => Date): Router {
  const router = Router();
  // Route-specific guard: unrelated /api/me checkout routes retain their role.
  router.get('/record', requireClient(pool, now), clientRecordController(pool));
  return router;
}

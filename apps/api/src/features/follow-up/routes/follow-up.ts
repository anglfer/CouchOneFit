import { Router, json } from 'express';
import type { Pool } from 'pg';
import { requireClient, requireProfessional } from '../../auth/middleware/session.js';
import { bearerToken, requireCsrf } from '../../auth/middleware/session-http.js';
import { followUpControllers } from '../controllers/follow-up.js';

export function followUpRoutes(pool: Pool, now?: () => Date) {
  const router = Router();
  const controller = followUpControllers(pool, now ?? (() => new Date()));
  const pro = requireProfessional(pool, now);
  const client = requireClient(pool, now);
  const payload = json({ limit: '16kb' });
  router.get('/me/check-ins/context', client, controller.context);
  router.get('/me/check-ins', client, controller.history);
  // Mobile sends a Bearer token; a browser session still needs CSRF.
  router.post('/me/check-ins', client, (req, res, next) => (bearerToken(req) !== undefined ? next() : requireCsrf(req, res, next)), payload, controller.save);
  router.get('/me/progress', client, controller.progress);
  router.get('/me/progress/measurements', client, controller.measurements);
  router.get('/me/progress/adherence', client, controller.adherence);
  router.get('/follow-up/summary', pro, controller.summary);
  router.get('/clients/:clientId/follow-up', pro, controller.followUp);
  router.patch('/clients/:clientId/visibility', pro, requireCsrf, payload, controller.visibility);
  return router;
}

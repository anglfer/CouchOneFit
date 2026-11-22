import { Router, json } from 'express';
import type { Pool } from 'pg';
import { requireClient, requireProfessional } from '../../auth/middleware/session.js';
import { requireCsrf } from '../../auth/middleware/session-http.js';
import { idempotent } from '../../idempotency/middleware/idempotency.js';
import { foodControllers } from '../controllers/foods.js';
import { nutritionControllers } from '../controllers/nutrition.js';

export function nutritionRoutes(pool: Pool, now?: () => Date) {
  const router = Router();
  const controller = nutritionControllers(pool, now ?? (() => new Date()));
  const foods = foodControllers(pool);
  const pro = requireProfessional(pool, now);
  const client = requireClient(pool, now);
  const payload = json({ limit: '1mb' });
  const idem = idempotent(pool);

  // Profesional: gestión de versiones, borradores, sugerencia inicial (HU-025) y activación (HU-024, HU-026)
  router.get('/clients/:clientId/nutrition-plans', pro, controller.versions);
  router.post(
    '/clients/:clientId/nutrition-plans/suggestion',
    pro,
    requireCsrf,
    payload,
    controller.suggest,
  );
  router.post('/clients/:clientId/nutrition-plans', pro, requireCsrf, payload, idem, controller.write);
  router.post('/clients/:clientId/nutrition-plans/:planId/versions', pro, requireCsrf, payload, idem, controller.write);
  router.patch(
    '/clients/:clientId/nutrition-plans/:planId/versions/:versionId',
    pro,
    requireCsrf,
    payload,
    idem,
    controller.write,
  );
  router.post(
    '/clients/:clientId/nutrition-plans/:planId/versions/:versionId/activate',
    pro,
    requireCsrf,
    payload,
    idem,
    controller.activate,
  );

  // Profesional: biblioteca propia de alimentos y recetas (EP-05)
  router.get('/nutrition/foods', pro, foods.list);
  router.post('/nutrition/foods', pro, requireCsrf, payload, idem, foods.create);
  router.patch('/nutrition/foods/:foodId', pro, requireCsrf, payload, idem, foods.update);
  router.post('/nutrition/foods/:foodId/archive', pro, requireCsrf, payload, idem, foods.archive);

  // Cliente móvil: consulta del plan nutricional activo (HU-027)
  router.get('/me/nutrition-plan', client, controller.plan);

  return router;
}

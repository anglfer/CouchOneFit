import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import * as nutritionService from '../services/nutrition.js';
import { uuid } from '../validators/nutrition.js';

export function nutritionControllers(pool: Pool, clock: () => Date) {
  const wrap = (
    action: (req: Parameters<RequestHandler>[0]) => Promise<unknown>,
    statusCode = 200,
  ): RequestHandler => async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.status(statusCode).json(await action(req));
    } catch (error) {
      next(error);
    }
  };

  return {
    versions: wrap((req) =>
      nutritionService.getVersions(pool, req.identity!, uuid(req.params.clientId)),
    ),

    write: wrap(
      (req) => {
        if (req.method === 'PATCH') {
          return nutritionService.updateDraft(
            pool,
            req.identity!,
            req.params.clientId,
            req.params.planId,
            req.params.versionId,
            req.body,
          );
        }
        return nutritionService.saveDraft(
          pool,
          req.identity!,
          req.params.clientId,
          req.params.planId,
          req.body,
        );
      },
      201,
    ),

    activate: wrap((req) =>
      nutritionService.activateVersion(
        pool,
        req.identity!,
        req.params.clientId,
        req.params.planId,
        req.params.versionId,
        req.body,
        clock(),
      ),
    ),

    plan: wrap((req) => nutritionService.getActivePlanForClient(pool, req.identity!)),
  };
}
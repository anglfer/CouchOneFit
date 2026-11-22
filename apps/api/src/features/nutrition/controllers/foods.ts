import type { Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import * as foodService from '../services/foods.js';

export function foodControllers(pool: Pool) {
  const wrap =
    (action: (req: Request) => Promise<unknown>, statusCode = 200): RequestHandler =>
    async (req, res, next) => {
      try {
        res.set('Cache-Control', 'no-store');
        res.status(statusCode).json(await action(req));
      } catch (error) {
        next(error);
      }
    };

  return {
    list: wrap((req) => foodService.listFoods(pool, req.identity!)),
    create: wrap((req) => foodService.createFood(pool, req.identity!, req.body), 201),
    update: wrap((req) => foodService.updateFood(pool, req.identity!, req.params.foodId, req.body)),
    archive: wrap((req) => foodService.archiveFood(pool, req.identity!, req.params.foodId, req.body)),
  };
}

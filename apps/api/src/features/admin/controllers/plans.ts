import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { AuthError } from '../../auth/types/errors.js';
import { findPlans, insertPlan, updatePlan } from '../repositories/plans.js';
import { validatePlanInput } from '../validators/plans.js';


export function plansController(pool: Pool) {
  const handleDbError = (error: unknown, next: any) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      next(new AuthError(409, 'DUPLICATE_PLAN', 'Ya existe un plan con ese nombre.'));
    } else {
      next(error);
    }
  };

  return {
    list: (async (_req, res, next) => {
      try {
        res.json({ plans: await findPlans(pool) });
      } catch (error) {
        next(error);
      }
    }) as RequestHandler,

    create: (async (req, res, next) => {
      try {
        const data = validatePlanInput(req.body);
        const plan = await insertPlan(pool, data);
        res.status(201).json({ plan });
      } catch (error) {
        handleDbError(error, next);
      }
    }) as RequestHandler,

    update: (async (req, res, next) => {
      try {
        const data = validatePlanInput(req.body, true);
        const plan = await updatePlan(pool, req.params.id as string, {
  ...data,
  isActive: (data as any).isActive ?? true,
});
        if (!plan) throw new AuthError(404, 'NOT_FOUND', 'El plan no existe.');
        res.json({ plan });
      } catch (error) {
        handleDbError(error, next);
      }
    }) as RequestHandler
  };
}
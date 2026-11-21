import type { Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import * as service from '../services/follow-up.js';
import { uuid } from '../validators/follow-up.js';

export function followUpControllers(pool: Pool, clock: () => Date) {
  const wrap =
    (action: (req: Request) => Promise<unknown>): RequestHandler =>
    async (req, res, next) => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(await action(req));
      } catch (error) {
        next(error);
      }
    };
  return {
    context: wrap((req) => service.getCheckInContext(pool, req.identity!, req.query, clock())),
    save: wrap((req) => service.saveCheckIn(pool, req.identity!, req.get('Idempotency-Key'), req.body, clock())),
    history: wrap((req) => service.getOwnCheckIns(pool, req.identity!, req.query)),
    progress: wrap((req) => service.getOwnProgress(pool, req.identity!, req.query, clock())),
    measurements: wrap((req) => service.getOwnMeasurements(pool, req.identity!)),
    adherence: wrap((req) => service.getOwnAdherence(pool, req.identity!, req.query, clock())),
    followUp: wrap((req) => service.getFollowUp(pool, req.identity!, uuid(req.params.clientId), req.query, clock())),
    summary: wrap((req) => service.getPortfolioSummary(pool, req.identity!, clock())),
    visibility: wrap((req) => service.changeVisibility(pool, req.identity!, uuid(req.params.clientId), req.get('Idempotency-Key'), req.body, clock())),
  };
}

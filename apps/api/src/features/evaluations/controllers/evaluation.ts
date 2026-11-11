import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import * as service from '../services/evaluation.js'

export function evaluationControllers(pool: Pool, now: () => Date) {
  const handle = (operation: (req: Parameters<RequestHandler>[0]) => Promise<unknown>, status = 200): RequestHandler =>
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store')
      try {
        res.status(status).json(await operation(req))
      } catch (error) {
        next(error)
      }
    }
  return {
    list: handle(async (req) => ({ evaluations: await service.getEvaluations(pool, req.identity!, req.params.clientId, req.query.offset ?? 0) })),
    create: handle(async (req) => ({ evaluation: await service.createEvaluation(pool, req.identity!, req.params.clientId, req.body, now()) }), 201),
  }
}

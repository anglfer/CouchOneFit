import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';
import type { Pool } from 'pg';
import { pool } from './config/database.js';
import { config } from './config/index.js';
import { publicPlanRoutes } from './features/saas/routes/plans.js';
import { checkoutRoutes } from './features/saas/routes/checkout.js';
import { capacityRoutes } from './features/saas/routes/clients.js';
import { adminRoutes } from './features/admin/routes/admin.js';
import { registrationRoutes } from './features/auth/routes/registration.js';
import { sessionRoutes } from './features/auth/routes/session.js';
import { lifecycleRoutes } from './features/auth/routes/lifecycle.js';
import { AuthError } from './features/auth/types/errors.js';
import { clientRoutes } from './features/client/routes/client.js';
import { clientRecordRoutes } from './features/client/routes/record.js';
import { professionalRoutes } from './features/professional/routes/professional.js';
import { trainingRoutes } from './features/training/routes/training.js';
import { evaluationRoutes } from './features/evaluations/routes/evaluations.js';
import { nutritionRoutes } from './features/nutrition/routes/nutrition.js';
import { followUpRoutes } from './features/follow-up/routes/follow-up.js';
import { errorFields, isDatabaseUnavailable } from './shared/errors/database.js';
import { normalizePath, requestLogger } from './shared/middleware/request-logger.js';
import { logger } from './shared/utils/logger.js';

function requestFields(req: Request, res: Response) {
  return {
    requestId: res.locals.requestId,
    method: req.method,
    path: normalizePath(req.originalUrl || req.url),
  };
}

function logDatabaseOrHttpError(
  req: Request,
  res: Response,
  error: unknown,
  status: number
): void {
  logger.error(
    isDatabaseUnavailable(error) ? 'db.connection_error' : 'http.error',
    { ...requestFields(req, res), status, ...errorFields(error) }
  );
}

export interface AppOptions {
  now?: () => Date;
}

export function createApp(database: Pool, options?: AppOptions): Express {
  const app = express();
  const now = options?.now;
  app.disable('x-powered-by');
  app.use(requestLogger());
  app.use('/api', trainingRoutes(database, now));
  app.use('/api', nutritionRoutes(database, now));
  app.use('/api', followUpRoutes(database, now));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/clients', evaluationRoutes(database, now));
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      environment: config.nodeEnv,
      timestamp: (now?.() ?? new Date()).toISOString(),
    });
  });
  app.get('/api/health/ready', async (req, res) => {
    const timestamp = (now?.() ?? new Date()).toISOString();
    try {
      await database.query('SELECT 1');
      res.json({ status: 'ok', database: 'ok', timestamp });
    } catch (error) {
      logDatabaseOrHttpError(req, res, error, 503);
      res
        .status(503)
        .json({ status: 'unavailable', database: 'unavailable', timestamp });
    }
  });
  app.use('/api/plans', publicPlanRoutes(database));
  app.use('/api/auth', registrationRoutes(database));
  app.use('/api/auth', sessionRoutes(database, now));
  app.use('/api', lifecycleRoutes(database, now));
  app.use('/api/me', clientRecordRoutes(database, now));
  app.use('/api/me', checkoutRoutes(database, now));
  app.use('/api/clients', capacityRoutes(database, now));
  app.use('/api/admin', adminRoutes(database, now));
  app.use('/api/professional', professionalRoutes(database, now));
  app.use('/api/client', clientRoutes(database, now));
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Recurso no disponible.' },
    });
  });
  app.use(
    (error: unknown, req: Request, res: Response, _next: NextFunction) => {
      res.set('Cache-Control', 'no-store');
      if (error instanceof AuthError) {
        if (error.status === 401 || error.status === 403) {
          logger.warn('auth.denied', {
            ...requestFields(req, res),
            status: error.status,
            errorCode: error.code,
          });
        }
        res
          .status(error.status)
          .json({
            error: {
              code: error.code,
              message: error.message,
              ...(error.fields ? { fields: error.fields } : {}),
            },
          });
        return;
      }
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? error.status
          : 500;
      // Sin esto un fallo inesperado solo llega al cliente como 503 y no deja rastro.
      if (status === 400 || status === 413) {
        logger.warn('http.body_error', {
          ...requestFields(req, res),
          status,
          errorType: (error as { type?: unknown }).type,
        });
      } else {
        logDatabaseOrHttpError(req, res, error, 503);
      }
      res.status(status === 400 || status === 413 ? status : 503).json({
        error: {
          code:
            status === 400
              ? 'INVALID_JSON'
              : status === 413
                ? 'PAYLOAD_TOO_LARGE'
                : 'SERVICE_UNAVAILABLE',
          message:
            status === 400
              ? 'El formulario no tiene un formato válido.'
              : status === 413
                ? 'El formulario excede el tamaño permitido.'
                : 'No pudimos completar la solicitud.',
        },
      });
    }
  );
  return app;
}
export const app = createApp(pool);
export default app;


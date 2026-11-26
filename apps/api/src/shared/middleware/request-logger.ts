import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { writeLog } from '../utils/logger.js';
import type { LogLevel } from '../utils/logger.js';

const REQUEST_ID =
  /^(?:[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}|mob-[a-f\d]{16})$/i;
const ROUTER_MOUNTS = new Set([
  '',
  '/api',
  '/api/admin',
  '/api/admin/observability',
  '/api/auth',
  '/api/client',
  '/api/clients',
  '/api/me',
  '/api/observability',
  '/api/plans',
  '/api/professional',
]);

function routePath(req: Request, pathname: string): string | undefined {
  const template: unknown = req.route?.path;
  if (typeof template !== 'string') return undefined;
  const routeSegments = template.split('/').filter(Boolean);
  const requestSegments = pathname.split('/').filter(Boolean);
  // Express restores baseUrl while forwarding errors outside of a router.
  const prefixSize = requestSegments.length - routeSegments.length;
  if (prefixSize < 0) return undefined;
  const prefix = requestSegments.slice(0, prefixSize).join('/').toLowerCase();
  const mount = prefix ? `/${prefix}` : '';
  if (!ROUTER_MOUNTS.has(mount)) return undefined;

  const route = routeSegments.map((segment) => segment.startsWith(':') ? ':id' : segment);
  return route.length ? `${mount}/${route.join('/')}` : mount || '/';
}

export function resolveModuleFromPath(path: string): string {
  if (path.startsWith('/api/health')) return 'health';
  if (path.startsWith('/api/observability')) return 'observability';
  if (path.startsWith('/api/admin/observability')) return 'observability';
  if (path.startsWith('/api/admin')) return 'admin';
  if (path.startsWith('/api/auth') || path.startsWith('/api/accounts')) return 'auth';
  if (path.startsWith('/api/plans')) return 'plans';
  if (path.startsWith('/api/training') || path.includes('/training-')) return 'training';
  if (path.startsWith('/api/nutrition') || path.includes('/nutrition-')) return 'nutrition';
  if (path.includes('/evaluations') || path.includes('/evaluation-')) return 'evaluations';
  if (path.startsWith('/api/follow-up') || path.includes('/follow-up') || path.includes('/check-ins') || path.includes('/progress') || path.includes('/visibility')) return 'follow_up';
  if (path.startsWith('/api/clients')) return 'clients';
  if (path.startsWith('/api/professional')) return 'professional';
  if (path.startsWith('/api/client') || path.startsWith('/api/me')) return 'client';
  return 'system';
}

function slowThresholdMs(): number {
  const value = Number(process.env.LOG_SLOW_MS);
  return Number.isFinite(value) && value > 0 ? value : 1000;
}

export function requestLogFields(req: Request, res: Response) {
  const pathname = req.originalUrl.split(/[?#]/, 1)[0];
  const route = routePath(req, pathname);
  const path = route ?? (pathname.toLowerCase().startsWith('/api/') ? '/api/:unmatched' : '/:unmatched');
  return {
    requestId: res.locals.requestId,
    module: resolveModuleFromPath(route ?? pathname.toLowerCase()),
    method: req.method,
    path,
    operation: `${req.method} ${path}`,
    ...(res.locals.synthetic === true ? { synthetic: true } : {}),
  };
}

export function requestLogger(isSynthetic: (req: Request) => boolean): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    const requestId =
      incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = requestId;
    res.locals.synthetic = isSynthetic(req);
    res.setHeader('X-Request-Id', requestId);
    const started = process.hrtime.bigint();
    let logged = false;
    const elapsed = () =>
      Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10;

    res.on('finish', () => {
      if (logged) return;
      logged = true;
      const durationMs = elapsed();
      const status = res.statusCode;
      const slow = durationMs > slowThresholdMs();
      let level: LogLevel =
        status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      if (slow && level === 'info') level = 'warn';
      writeLog(level, 'http.request', {
        ...requestLogFields(req, res),
        status,
        durationMs,
        uptimeS: Math.floor(process.uptime()),
        outcome:
          status >= 500
            ? 'server_error'
            : status >= 400
              ? 'client_error'
              : 'success',
        ...(slow ? { slow: true } : {}),
      });
    });
    res.on('close', () => {
      if (logged || res.writableFinished) return;
      logged = true;
      writeLog('warn', 'http.aborted', {
        ...requestLogFields(req, res),
        durationMs: elapsed(),
        outcome: 'aborted',
      });
    });
    next();
  };
}

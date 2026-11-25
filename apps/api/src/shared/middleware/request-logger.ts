import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { writeLog } from '../utils/logger.js';
import type { LogLevel } from '../utils/logger.js';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;

/** Ruta sin query y sin identificadores, para mantener baja la cardinalidad. */
export function normalizePath(url: string): string {
  const pathname = url.split('?')[0].split('#')[0];
  return pathname
    .split('/')
    .map((segment) => (UUID.test(segment) || NUMERIC.test(segment) ? ':id' : segment))
    .join('/');
}

function slowThresholdMs(): number {
  const value = Number(process.env.LOG_SLOW_MS);
  return Number.isFinite(value) && value > 0 ? value : 1000;
}

export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    const requestId =
      incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const started = process.hrtime.bigint();
    const method = req.method;
    const path = normalizePath(req.originalUrl || req.url);
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
        requestId,
        method,
        path,
        status,
        durationMs,
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
        requestId,
        method,
        path,
        durationMs: elapsed(),
      });
    });
    next();
  };
}

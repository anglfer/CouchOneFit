import { timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { config } from '../../../config/index.js'
import { AuthError } from '../../auth/types/errors.js'

export function hasObservabilityIngestToken(req: Request): boolean {
  const provided = req.get('X-Observability-Token')
  const configured = config.observabilityIngestSecret
  if (!provided || configured.length < 16) return false
  const expected = Buffer.from(configured)
  const received = Buffer.from(provided)
  return expected.length === received.length && timingSafeEqual(received, expected)
}

export function requireIngestToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.set('Cache-Control', 'no-store')
  const configured = config.observabilityIngestSecret
  if (!configured || configured.length < 16) {
    next(
      new AuthError(
        503,
        'OBSERVABILITY_INGEST_DISABLED',
        'La ingesta externa de observabilidad no está habilitada en este entorno.',
      ),
    )
    return
  }

  if (!hasObservabilityIngestToken(req)) {
    next(
      new AuthError(
        401,
        'OBSERVABILITY_TOKEN_INVALID',
        'Credencial de ingesta externa inválida o ausente.',
      ),
    )
    return
  }

  next()
}

import { createHash } from 'node:crypto'
import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import { claimKey, completeKey, releaseKey } from '../repositories/keys.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : 1
          )
        )
      : item
  )

/**
 * DEC-018: repetir una escritura con la misma `Idempotency-Key` devuelve la respuesta
 * original sin volver a escribir. Sin el encabezado no cambia nada (clientes en línea).
 * Va después de la autenticación y del CSRF. Solo se conservan respuestas 2xx: un fallo
 * libera la clave para que el reintento se evalúe de nuevo.
 */
export function idempotent(pool: Pool): RequestHandler {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key')
    if (key === undefined) return next()
    try {
      if (!UUID.test(key))
        throw new AuthError(
          400,
          'INVALID_INPUT',
          'La clave de idempotencia no es válida.'
        )
      const owner = req.identity!.id
      const hash = createHash('sha256')
        .update(`${req.method} ${req.baseUrl}${req.path}\n${canonical(req.body)}`)
        .digest('hex')
      const claim = await claimKey(pool, owner, key.toLowerCase(), hash)
      if (claim.kind === 'mismatch')
        throw new AuthError(
          422,
          'IDEMPOTENCY_KEY_REUSED',
          'Esa clave de idempotencia ya se usó con otra solicitud.'
        )
      if (claim.kind === 'busy') {
        res.set('Retry-After', '2')
        throw new AuthError(
          409,
          'IDEMPOTENCY_IN_PROGRESS',
          'La misma operación sigue en curso. Inténtalo de nuevo en unos segundos.'
        )
      }
      if (claim.kind === 'replay') {
        res.set('Idempotent-Replayed', 'true')
        res.status(claim.status).json(claim.body)
        return
      }

      let settled = false
      const send = res.json.bind(res)
      res.json = (body?: unknown) => {
        if (settled) return send(body)
        settled = true
        const status = res.statusCode
        const finish = () => send(body)
        // Se guarda el resultado ANTES de contestar: un reintento inmediato ya lo ve.
        const saving =
          status >= 200 && status < 300
            ? completeKey(pool, owner, key.toLowerCase(), status, body)
            : releaseKey(pool, owner, key.toLowerCase())
        saving.then(finish, finish)
        return res
      }
      res.on('close', () => {
        if (!settled) {
          settled = true
          void releaseKey(pool, owner, key.toLowerCase()).catch(() => undefined)
        }
      })
      next()
    } catch (error) {
      next(error)
    }
  }
}

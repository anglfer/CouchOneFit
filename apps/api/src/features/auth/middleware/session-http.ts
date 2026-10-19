import { timingSafeEqual } from 'node:crypto'
import { parseCookie } from 'cookie'
import type { Request, Response, NextFunction, CookieOptions } from 'express'
import { config } from '../../../config/index.js'
import { randomToken } from '../services/tokens.js'
import { AuthError } from '../types/errors.js'

export const cookies = (req: Request) => parseCookie(req.headers.cookie ?? '')
export function bearerToken(req: Request): string | undefined {
  const header = req.get('Authorization')
  if (!header) return undefined
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match ? match[1] : ''
}
const options = (path: string): CookieOptions => ({
  path,
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
})
export function csrfToken(req: Request, res: Response): void {
  const existing = cookies(req).cof_csrf
  const token =
    existing && /^[\w-]{43}$/.test(existing) ? existing : randomToken()
  res.cookie('cof_csrf', token, { ...options('/api'), maxAge: 30 * 86400000 })
  res.json({ csrfToken: token })
}
export function requireCsrf(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.get('X-CSRF-Token') ?? ''
  const stored = cookies(req).cof_csrf ?? ''
  if (
    !req.headers.origin ||
    !config.allowedOrigins.includes(req.headers.origin) ||
    !/^[\w-]{43}$/.test(header) ||
    !/^[\w-]{43}$/.test(stored) ||
    header.length !== stored.length ||
    !timingSafeEqual(Buffer.from(header), Buffer.from(stored))
  ) {
    next(
      new AuthError(
        403,
        'CSRF_INVALID',
        'No pudimos validar la solicitud. Recarga la página e inténtalo de nuevo.',
      ),
    )
    return
  }
  next()
}
export function setSessionCookies(
  res: Response,
  session: { access: string; refresh: string; expiresAt: Date },
): void {
  res.cookie('cof_access', session.access, {
    ...options('/api'),
    maxAge: 15 * 60000,
  })
  res.cookie('cof_refresh', session.refresh, {
    ...options('/api/auth'),
    expires: session.expiresAt,
  })
}
export function clearSessionCookies(res: Response): void {
  res.clearCookie('cof_access', options('/api'))
  res.clearCookie('cof_refresh', options('/api/auth'))
}

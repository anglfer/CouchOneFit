import { AuthError } from '../types/errors.js'
import type { Login } from '../types/login.js'

export function validateLogin(input: unknown): Login {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  const body = input as Record<string, unknown>
  if (
    Object.keys(body).some(
      (key) => !['identifier', 'password'].includes(key),
    ) ||
    typeof body.identifier !== 'string' ||
    typeof body.password !== 'string' ||
    !body.identifier.trim() ||
    body.identifier.length > 254 ||
    [...body.password].length < 1 ||
    [...body.password].length > 128
  )
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  return {
    identifier: body.identifier.trim().toLowerCase(),
    password: body.password,
  }
}

export function validateRefreshPayload(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  const body = input as Record<string, unknown>
  if (Object.keys(body).some((key) => key !== 'refreshToken'))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  return typeof body.refreshToken === 'string' ? body.refreshToken.trim() : undefined
}

export function validateLogoutPayload(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined
  if (typeof input !== 'object' || Array.isArray(input))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  const body = input as Record<string, unknown>
  if (Object.keys(body).some((key) => key !== 'refreshToken'))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  return typeof body.refreshToken === 'string' ? body.refreshToken.trim() : undefined
}

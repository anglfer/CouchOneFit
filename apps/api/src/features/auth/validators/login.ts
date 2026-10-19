import { AuthError } from '../types/errors.js'
import type { Login } from '../types/login.js'

export function validateLogin(input: unknown): Login {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  const body = input as Record<string, unknown>
  if (
    Object.keys(body).some(
      (key) => !['identificador', 'contrasena'].includes(key),
    ) ||
    typeof body.identificador !== 'string' ||
    typeof body.contrasena !== 'string' ||
    !body.identificador.trim() ||
    body.identificador.length > 254 ||
    [...body.contrasena].length < 1 ||
    [...body.contrasena].length > 128
  )
    throw new AuthError(400, 'INVALID_LOGIN', 'Revisa los datos de acceso.')
  return {
    identifier: body.identificador.trim().toLowerCase(),
    password: body.contrasena,
  }
}

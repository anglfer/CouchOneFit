import { AuthError } from '../types/errors.js'
import { NOTICE_VERSION } from '../types/registration.js'

export const invalidInput = (
  message = 'Revisa los datos del formulario.'
): never => {
  throw new AuthError(400, 'INVALID_INPUT', message)
}
export function payload(
  input: unknown,
  fields: string[]
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return invalidInput()
  const body = input as Record<string, unknown>
  if (Object.keys(body).some((key) => !fields.includes(key)))
    return invalidInput('El formulario contiene campos no permitidos.')
  return body
}
export function text(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === 'string' ? (body[key] as string) : ''
}
function password(body: Record<string, unknown>): string {
  const value = text(body, 'password')
  if ([...value].length < 15 || [...value].length > 128)
    return invalidInput('La contraseña debe tener entre 15 y 128 caracteres.')
  if (value !== text(body, 'passwordConfirmation'))
    return invalidInput('Las contraseñas no coinciden.')
  return value
}
export function code(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w-]{43}$/.test(value))
    return invalidInput('Escribe el código completo de 43 caracteres.')
  return value
}
export function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    return invalidInput()
  return value.toLowerCase()
}
function username(body: Record<string, unknown>): string {
  const value = text(body, 'username').trim().toLowerCase()
  if (!/^[a-z0-9._]{3,30}$/.test(value))
    return invalidInput(
      'Usa un usuario de 3 a 30 letras, números, puntos o guion bajo.'
    )
  return value
}
export function validateCredentials(input: unknown) {
  const body = payload(input, [
    'username',
    'password',
    'passwordConfirmation',
    'currentPassword',
  ])
  const currentPassword = text(body, 'currentPassword')
  if (!currentPassword || [...currentPassword].length > 128)
    return invalidInput('Escribe tu contraseña actual.')
  return { username: username(body), password: password(body), currentPassword }
}
export function validateActivation(input: unknown) {
  const body = payload(input, [
    'username',
    'email',
    'emailConfirmation',
    'password',
    'passwordConfirmation',
    'code',
    'noticeVersion',
    'acceptsNotice',
  ])
  const email = text(body, 'email').trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return invalidInput('Escribe un correo válido.')
  if (email !== text(body, 'emailConfirmation').trim().toLowerCase())
    return invalidInput('Los correos no coinciden.')
  if (body.acceptsNotice !== true || body.noticeVersion !== NOTICE_VERSION)
    return invalidInput('Confirma la información de registro vigente.')
  return {
    username: username(body),
    email,
    password: password(body),
    code: code(body.code),
    noticeVersion: NOTICE_VERSION,
  }
}
export function validateReset(input: unknown) {
  const body = payload(input, ['code', 'password', 'passwordConfirmation'])
  return { code: code(body.code), password: password(body) }
}
export function validateVerification(input: unknown) {
  const body = payload(input, [
    'identityVerified',
    'verificationMethod',
    'currentPassword',
  ])
  if (
    body.identityVerified !== true ||
    body.verificationMethod !== 'known_relationship'
  )
    return invalidInput(
      'Debes corroborar la identidad fuera de banda por la relación conocida; correo o identificador no son suficientes.'
    )
  const currentPassword = text(body, 'currentPassword')
  if (!currentPassword || [...currentPassword].length > 128)
    return invalidInput(
      'Confirma tu contraseña actual para autorizar la entrega.'
    )
  return { currentPassword }
}

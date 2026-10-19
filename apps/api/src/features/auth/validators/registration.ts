import {
  NOTICE_VERSION,
  RegistrationError,
  type Registration,
} from '../types/registration.js'
const fields = new Set([
  'fullName',
  'username',
  'email',
  'emailConfirmation',
  'password',
  'passwordConfirmation',
  'phone',
  'planInterest',
  'noticeVersion',
  'acceptsNotice',
])

export function validateRegistration(input: unknown): Registration {
  const invalid = (message: string): never => {
    throw new RegistrationError(400, 'INVALID_REGISTRATION', message)
  }
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return invalid('Revisa los datos del formulario.')
  const body = input as Record<string, unknown>
  if (Object.keys(body).some((key) => !fields.has(key)))
    return invalid('El formulario contiene campos no permitidos.')
  const text = (key: string) =>
    typeof body[key] === 'string' ? (body[key] as string) : ''
  const fullName = text('fullName').trim()
  const username = text('username').trim().toLowerCase()
  const email = text('email').trim().toLowerCase()
  const password = text('password')
  const phone = body.phone == null ? '' : text('phone').trim()
  const planInterest = body.planInterest ?? null
  if ([...fullName].length < 3 || [...fullName].length > 120)
    return invalid('El nombre debe tener entre 3 y 120 caracteres.')
  if (!/^[a-z0-9._]{3,30}$/.test(username))
    return invalid(
      'Usa un usuario de 3 a 30 letras, números, puntos o guion bajo.',
    )
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return invalid('Escribe un correo válido.')
  if (email !== text('emailConfirmation').trim().toLowerCase())
    return invalid('Los correos no coinciden.')
  if ([...password].length < 15 || [...password].length > 128)
    return invalid('La contraseña debe tener entre 15 y 128 caracteres.')
  if (password !== text('passwordConfirmation'))
    return invalid('Las contraseñas no coinciden.')
  if (
    (body.phone != null && typeof body.phone !== 'string') ||
    (phone && !/^\d{10,15}$/.test(phone))
  )
    return invalid('El teléfono debe tener de 10 a 15 dígitos.')
  if (planInterest !== null && !['basic', 'pro', 'elite'].includes(planInterest as string))
    return invalid('Selecciona un plan válido.')
  if (body.acceptsNotice !== true || body.noticeVersion !== NOTICE_VERSION)
    return invalid('Confirma la información de registro vigente.')
  return {
    fullName,
    username,
    email,
    password,
    phone: phone || null,
    planInterest: planInterest as Registration['planInterest'],
    noticeVersion: NOTICE_VERSION,
  }
}

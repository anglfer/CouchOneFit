import {
  NOTICE_VERSION,
  RegistrationError,
  type Registration,
} from '../types/registration.js'
const fields = new Set([
  'nombreCompleto',
  'usuario',
  'correo',
  'confirmacionCorreo',
  'contrasena',
  'confirmacionContrasena',
  'telefono',
  'planInteres',
  'avisoVersion',
  'aceptaAviso',
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
  const nombre = text('nombreCompleto').trim()
  const usuario = text('usuario').trim().toLowerCase()
  const correo = text('correo').trim().toLowerCase()
  const password = text('contrasena')
  const telefono = body.telefono == null ? '' : text('telefono').trim()
  const plan = body.planInteres ?? null
  if ([...nombre].length < 3 || [...nombre].length > 120)
    return invalid('El nombre debe tener entre 3 y 120 caracteres.')
  if (!/^[a-z0-9._]{3,30}$/.test(usuario))
    return invalid(
      'Usa un usuario de 3 a 30 letras, números, puntos o guion bajo.',
    )
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    return invalid('Escribe un correo válido.')
  if (correo !== text('confirmacionCorreo').trim().toLowerCase())
    return invalid('Los correos no coinciden.')
  if ([...password].length < 15 || [...password].length > 128)
    return invalid('La contraseña debe tener entre 15 y 128 caracteres.')
  if (password !== text('confirmacionContrasena'))
    return invalid('Las contraseñas no coinciden.')
  if (
    (body.telefono != null && typeof body.telefono !== 'string') ||
    (telefono && !/^\d{10,15}$/.test(telefono))
  )
    return invalid('El teléfono debe tener de 10 a 15 dígitos.')
  if (plan !== null && !['basico', 'pro', 'elite'].includes(plan as string))
    return invalid('Selecciona un plan válido.')
  if (body.aceptaAviso !== true || body.avisoVersion !== NOTICE_VERSION)
    return invalid('Confirma la información de registro vigente.')
  return {
    nombreCompleto: nombre,
    usuario,
    correo,
    contrasena: password,
    telefono: telefono || null,
    planInteres: plan as Registration['planInteres'],
    avisoVersion: NOTICE_VERSION,
  }
}

export const NOTICE_VERSION = '2026-10-15.1'
export interface Registration {
  nombreCompleto: string
  usuario: string
  correo: string
  contrasena: string
  telefono: string | null
  planInteres: 'basico' | 'pro' | 'elite' | null
  avisoVersion: string
}
export { AuthError as RegistrationError } from './errors.js'

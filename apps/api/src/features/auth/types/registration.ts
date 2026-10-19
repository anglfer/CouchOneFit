export const NOTICE_VERSION = '2026-10-15.1'
export interface Registration {
  fullName: string
  username: string
  email: string
  password: string
  phone: string | null
  planInterest: 'basic' | 'pro' | 'elite' | null
  noticeVersion: string
}
export { AuthError as RegistrationError } from './errors.js'

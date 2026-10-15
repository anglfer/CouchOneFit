import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { config } from '../../../config/index.js'
import { AuthError } from '../types/errors.js'

export const randomToken = () => randomBytes(32).toString('base64url')
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex')
export function jwtKey(): Uint8Array {
  const value = config.authJwtSecret
  if (Buffer.byteLength(value) < 32)
    throw new AuthError(
      503,
      'AUTH_UNAVAILABLE',
      'El acceso no está disponible. Inténtalo más tarde.',
    )
  return new TextEncoder().encode(value)
}
export function signAccess(id: string, sid: string): Promise<string> {
  return new SignJWT({ sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(id)
    .setIssuer('couchonefit-api')
    .setAudience('couchonefit-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(jwtKey())
}
export async function verifyAccess(
  token: string,
): Promise<{ id: string; sid: string }> {
  const key = jwtKey()
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: 'couchonefit-api',
      audience: 'couchonefit-web',
      requiredClaims: ['sub', 'sid', 'iat', 'exp'],
      maxTokenAge: '15m',
    })
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      !uuid.test(payload.sub) ||
      !uuid.test(payload.sid)
    )
      throw new Error('Invalid claims')
    return { id: payload.sub, sid: payload.sid }
  } catch {
    throw new AuthError(
      401,
      'SESSION_REQUIRED',
      'Tu sesión venció o no está disponible. Inicia sesión de nuevo.',
    )
  }
}

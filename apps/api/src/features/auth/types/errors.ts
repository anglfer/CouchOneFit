export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const invalidLogin = () =>
  new AuthError(
    401,
    'INVALID_CREDENTIALS',
    'No pudimos iniciar sesión. Revisa tus credenciales o el estado de tu cuenta.',
  )
export const invalidSession = () =>
  new AuthError(
    401,
    'SESSION_REQUIRED',
    'Tu sesión venció o no está disponible. Inicia sesión de nuevo.',
  )

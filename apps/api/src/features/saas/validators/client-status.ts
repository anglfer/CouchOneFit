import { AuthError } from '../../auth/types/errors.js'
import { payload } from '../../auth/validators/lifecycle.js'

export function clientStatusInput(input: unknown): {
  status: 'active' | 'inactive'
  version: number
} {
  const body = payload(input, ['status', 'version'])
  if (body.status !== 'active' && body.status !== 'inactive')
    throw new AuthError(
      400,
      'INVALID_INPUT',
      'El estado del expediente no es válido.'
    )
  if (
    !Number.isSafeInteger(body.version) ||
    Number(body.version) < 1 ||
    Number(body.version) > 2147483647
  )
    throw new AuthError(
      400,
      'INVALID_INPUT',
      'Consulta la versión actual del expediente antes de confirmar.',
      { version: 'La versión del expediente no es válida.' }
    )
  return { status: body.status, version: body.version as number }
}

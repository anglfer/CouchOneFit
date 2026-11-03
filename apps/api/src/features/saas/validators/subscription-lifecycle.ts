import { AuthError } from '../../auth/types/errors.js'
import { payload, uuid } from '../../auth/validators/lifecycle.js'

const METHODS = ['test_approved', 'test_declined', 'test_error']
const bad = (message: string) => new AuthError(400, 'INVALID_INPUT', message)

export function preferencesInput(input: unknown): {
  cancelAtPeriodEnd?: boolean
  renewalMethod?: string
} {
  const body = payload(input, ['cancelAtPeriodEnd', 'renewalMethod'])
  const out: { cancelAtPeriodEnd?: boolean; renewalMethod?: string } = {}
  if (body.cancelAtPeriodEnd !== undefined) {
    if (typeof body.cancelAtPeriodEnd !== 'boolean')
      throw bad('La cancelación debe ser verdadera o falsa.')
    out.cancelAtPeriodEnd = body.cancelAtPeriodEnd
  }
  if (body.renewalMethod !== undefined) {
    if (
      typeof body.renewalMethod !== 'string' ||
      !METHODS.includes(body.renewalMethod)
    )
      throw bad('El método de renovación no es válido.')
    out.renewalMethod = body.renewalMethod
  }
  if (!Object.keys(out).length) throw bad('No hay cambios que guardar.')
  return out
}

export function downgradeInput(input: unknown): {
  planId: string
  inactivateClientIds: string[]
} {
  const body = payload(input, ['planId', 'inactivateClientIds'])
  if (typeof body.planId !== 'string') throw bad('Elige un plan.')
  const ids = body.inactivateClientIds ?? []
  if (
    !Array.isArray(ids) ||
    ids.length > 1000 ||
    ids.some((id) => typeof id !== 'string')
  )
    throw bad('La lista de expedientes no es válida.')
  const unique = [...new Set((ids as string[]).map(uuid))]
  if (unique.length !== ids.length)
    throw bad('La lista de expedientes tiene repetidos.')
  return { planId: uuid(body.planId), inactivateClientIds: unique }
}

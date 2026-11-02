import { AuthError } from '../../auth/types/errors.js'
import { payload } from '../../auth/validators/lifecycle.js'
import { validateClientBaseFields } from './client-record.js'

export const editableClientFields = [
  'fullName',
  'goal',
  'birthDate',
  'heightCm',
  'baseWeightKg',
  'baseBodyFatPercentage',
  'waistCm',
  'hipCm'
] as const
export type EditableClientField = (typeof editableClientFields)[number]

export function clientEditInput(input: unknown) {
  const body = payload(input, ['version', ...editableClientFields])
  if (
    !Number.isSafeInteger(body.version) ||
    Number(body.version) < 1 ||
    Number(body.version) > 2147483647
  )
    throw new AuthError(
      400,
      'INVALID_INPUT',
      'La versión del expediente no es válida.',
      { version: 'Vuelve a consultar el expediente.' }
    )
  if (!editableClientFields.some((key) => Object.hasOwn(body, key)))
    throw new AuthError(
      400,
      'INVALID_INPUT',
      'Indica al menos un campo del expediente.'
    )
  return body
}

export function mergedClientEdit(
  current: Record<string, unknown>,
  body: Record<string, unknown>,
  now?: Date
) {
  const merged = Object.fromEntries(
    editableClientFields.map((key) => [
      key,
      Object.hasOwn(body, key) ? body[key] : current[key]
    ])
  )
  // Legacy all-NULL base groups may remain absent until a core field is supplied.
  const legacy = ['birthDate', 'heightCm', 'baseWeightKg'].every(
    (key) => current[key] === null
  )
  const touchesCore = ['birthDate', 'heightCm', 'baseWeightKg'].some((key) =>
    Object.hasOwn(body, key)
  )
  const validated = validateClientBaseFields(
    merged,
    now,
    legacy && !touchesCore
  )
  // Validation may normalize supplied text; omitted values remain byte-for-byte unchanged.
  return Object.fromEntries(
    editableClientFields.map((key) => [
      key,
      Object.hasOwn(body, key) ? validated[key] : current[key]
    ])
  )
}

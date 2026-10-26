import { invalidInput, payload } from '../../auth/validators/lifecycle.js'

export interface SaasPlanInput {
  name: string
  maxClients: number | null
  isUnlimited: boolean
  priceMxn: number
  isActive: boolean
}
export function validatePlanInput(
  input: unknown,
  _isUpdate = false
): SaasPlanInput {
  const body = payload(input, [
    'name',
    'maxClients',
    'isUnlimited',
    'priceMxn',
    'isActive',
  ])
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 3 || name.length > 50)
    return invalidInput('El nombre debe tener entre 3 y 50 caracteres.')
  const { maxClients, priceMxn, isUnlimited } = body
  if (
    typeof isUnlimited !== 'boolean' ||
    isUnlimited !== (maxClients === null) ||
    (maxClients !== null &&
      (typeof maxClients !== 'number' ||
        !Number.isInteger(maxClients) ||
        maxClients < 1 ||
        maxClients > 2147483647))
  )
    return invalidInput('Indica un límite entero positivo o cupo ilimitado.')
  if (
    typeof priceMxn !== 'number' ||
    !Number.isFinite(priceMxn) ||
    priceMxn < 0 ||
    priceMxn >= 100000000 ||
    Math.abs(priceMxn * 100 - Math.round(priceMxn * 100)) > 0.000001
  )
    return invalidInput(
      'El precio debe ser un número positivo con hasta dos decimales.'
    )
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean')
    return invalidInput()
  return {
    name,
    maxClients: maxClients as number | null,
    isUnlimited,
    priceMxn,
    isActive: (body.isActive as boolean) ?? true,
  }
}

import { AuthError } from '../../auth/types/errors.js'
import { payload } from '../../auth/validators/lifecycle.js'

export interface ClientInitialRecordInput {
  fullName: string
  goal: string | null
  birthDate: string
  heightCm: number
  baseWeightKg: number
  baseBodyFatPercentage: number | null
  waistCm: number | null
  hipCm: number | null
}

const clientFields = [
  'fullName',
  'goal',
  'birthDate',
  'heightCm',
  'baseWeightKg',
  'baseBodyFatPercentage',
  'waistCm',
  'hipCm'
]

const dateAtUtcMidnight = (value: string) => new Date(`${value}T00:00:00.000Z`)

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-'))
    return false
  const parsed = dateAtUtcMidnight(value)
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function isTenth(value: number) {
  return Number(value.toFixed(1)) === value
}

function clientInputError(fields: Record<string, string>): never {
  throw new AuthError(
    400,
    'INVALID_INPUT',
    'Revisa los campos marcados del expediente.',
    fields
  )
}

function optionalMeasurement(
  body: Record<string, unknown>,
  key: 'baseBodyFatPercentage' | 'waistCm' | 'hipCm',
  minimum: number,
  maximum: number,
  unit: string,
  fields: Record<string, string>
) {
  const value = body[key]
  if (value === undefined || value === null) return null
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !isTenth(value) ||
    value < minimum ||
    value > maximum
  ) {
    fields[key] =
      `Ingresa un valor entre ${minimum} y ${maximum} ${unit} con incrementos de 0.1.`
    return null
  }
  return value
}

function requiredMeasurement(
  body: Record<string, unknown>,
  key: 'heightCm' | 'baseWeightKg',
  minimum: number,
  maximum: number,
  unit: string,
  fields: Record<string, string>
) {
  const value = body[key]
  if (value === undefined || value === null) {
    fields[key] = 'Este dato es obligatorio.'
    return null
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !isTenth(value) ||
    value < minimum ||
    value > maximum
  ) {
    fields[key] =
      `Ingresa un valor entre ${minimum} y ${maximum} ${unit} con incrementos de 0.1.`
    return null
  }
  return value
}

export function validateClientBaseFields(
  input: unknown,
  now = new Date(),
  allowMissingBase = false
) {
  const body = payload(input, clientFields)
  const fields: Record<string, string> = {}
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  if ([...fullName].length < 2 || [...fullName].length > 150)
    fields.fullName = 'Escribe un nombre completo de 2 a 150 caracteres.'

  const goal =
    body.goal === undefined || body.goal === null
      ? null
      : typeof body.goal === 'string'
        ? body.goal.trim()
        : null
  if (
    (body.goal !== undefined &&
      body.goal !== null &&
      typeof body.goal !== 'string') ||
    (goal !== null && ([...goal].length < 1 || [...goal].length > 500))
  )
    fields.goal = 'Escribe un objetivo de 1 a 500 caracteres o déjalo vacío.'

  const birthDate = typeof body.birthDate === 'string' ? body.birthDate : ''
  const missingBase =
    allowMissingBase &&
    ['birthDate', 'heightCm', 'baseWeightKg'].every((key) => body[key] === null)
  if (missingBase) {
    // Preserve the genuine all-NULL pre-HU-015 group; never manufacture values.
  } else if (!validDate(birthDate)) {
    fields.birthDate = 'Ingresa una fecha de nacimiento válida.'
  } else {
    const adultDate = dateAtUtcMidnight(birthDate)
    adultDate.setUTCFullYear(adultDate.getUTCFullYear() + 18)
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now)
    const part = (type: string) =>
      parts.find((value) => value.type === type)!.value
    const today = dateAtUtcMidnight(
      `${part('year')}-${part('month')}-${part('day')}`
    )
    if (adultDate > today)
      fields.birthDate = 'El cliente debe tener al menos 18 años.'
  }

  const heightCm = missingBase
    ? null
    : requiredMeasurement(body, 'heightCm', 100, 250, 'cm', fields)
  const baseWeightKg = missingBase
    ? null
    : requiredMeasurement(body, 'baseWeightKg', 30, 300, 'kg', fields)
  const baseBodyFatPercentage = optionalMeasurement(
    body,
    'baseBodyFatPercentage',
    2,
    60,
    '%',
    fields
  )
  const waistCm = optionalMeasurement(body, 'waistCm', 40, 250, 'cm', fields)
  const hipCm = optionalMeasurement(body, 'hipCm', 50, 250, 'cm', fields)

  if (Object.keys(fields).length) return clientInputError(fields)
  return {
    fullName,
    goal,
    birthDate: missingBase ? null : birthDate,
    heightCm,
    baseWeightKg,
    baseBodyFatPercentage,
    waistCm,
    hipCm
  }
}

export function validateClientInitialRecord(
  input: unknown,
  now = new Date()
): ClientInitialRecordInput {
  return validateClientBaseFields(input, now) as ClientInitialRecordInput
}

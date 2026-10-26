import { payload, uuid, invalidInput } from '../../auth/validators/lifecycle.js'
import type { TestInstrument } from '../types/checkout.js'
export function quoteInput(input: unknown) {
  const body = payload(input, ['planId', 'idempotencyKey'])
  if (
    typeof body.planId !== 'string' ||
    typeof body.idempotencyKey !== 'string'
  )
    return invalidInput()
  return {
    planId: uuid(body.planId),
    idempotencyKey: uuid(body.idempotencyKey),
  }
}
export function instrumentInput(input: unknown): TestInstrument {
  const body = payload(input, ['instrument'])
  if (
    !['test_approved', 'test_declined', 'test_error'].includes(
      body.instrument as string
    )
  )
    return invalidInput('Selecciona una tarjeta disponible.')
  return body.instrument as TestInstrument
}

import type { Pool } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { uuid, payload } from '../../auth/validators/lifecycle.js'
import { quoteInput, instrumentInput } from '../validators/checkout.js'
import {
  availablePlans,
  createQuote,
  accessPayment,
  paymentHistory,
} from '../repositories/checkout.js'
import { paymentDto } from '../types/checkout.js'
export const listCheckoutPlans = (pool: Pool) => availablePlans(pool)
export const quotePayment = async (
  pool: Pool,
  identity: SessionIdentity,
  input: unknown
) => paymentDto(await createQuote(pool, identity, quoteInput(input)))
export async function paymentOperation(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  action: 'read' | 'confirm' | 'cancel',
  input: unknown = {}
) {
  const instrument = action === 'confirm' ? instrumentInput(input) : undefined
  if (action === 'cancel') payload(input, [])
  const result = await accessPayment(
    pool,
    identity,
    uuid(id),
    action,
    instrument
  )
  if ('conflict' in result) throw result.conflict
  return paymentDto(result)
}
export const listPayments = async (pool: Pool, identity: SessionIdentity) =>
  (await paymentHistory(pool, identity)).map(paymentDto)

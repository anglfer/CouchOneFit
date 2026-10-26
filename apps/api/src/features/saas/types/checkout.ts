export type TestInstrument = 'test_approved' | 'test_declined' | 'test_error'
export interface PaymentRow {
  id: string
  professional_id: string
  plan_id: string
  idempotency_key: string
  plan_snapshot: {
    id: string
    name: string
    max_clients: number | null
    is_unlimited: boolean
    price_mxn: string
    is_active: boolean
  }
  expected_subscription: unknown
  amount_cents: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
  instrument: TestInstrument | null
  failure_code: string | null
  quote_expires_at: Date
  processing_after: Date | null
  created_at: Date
  completed_at: Date | null
  period_start: Date | null
  period_end: Date | null
}
export function paymentDto(payment: PaymentRow) {
  return {
    id: payment.id,
    planId: payment.plan_id,
    planName: payment.plan_snapshot.name,
    limit: payment.plan_snapshot.max_clients,
    isUnlimited: payment.plan_snapshot.is_unlimited,
    amountCents: Number(payment.amount_cents),
    currency: 'MXN',
    status: payment.status,
    failureCode: payment.failure_code,
    instrument: payment.instrument,
    createdAt: payment.created_at,
    quoteExpiresAt: payment.quote_expires_at,
    processingAfter: payment.processing_after,
    completedAt: payment.completed_at,
    periodStart: payment.period_start,
    periodEnd: payment.period_end,
    simulated: true,
  }
}

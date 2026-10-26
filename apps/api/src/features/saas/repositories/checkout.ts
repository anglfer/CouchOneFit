import type { Pool, PoolClient } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { lockActor, transaction } from '../../auth/repositories/lifecycle.js'
import { lockProfessional } from './capacity.js'
import type { PaymentRow, TestInstrument } from '../types/checkout.js'

const conflict = (
  code = 'CHECKOUT_STALE',
  message = 'La cotización cambió o venció. Inicia una nueva operación.'
) => new AuthError(409, code, message)
async function actor(client: PoolClient, identity: SessionIdentity) {
  if (identity.role !== 'professional')
    throw new AuthError(
      403,
      'ROLE_FORBIDDEN',
      'Solo el profesional puede gestionar su suscripción.'
    )
  await lockActor(client, identity, undefined, true)
  const {
    rows: [p],
  } = await client.query<{ id: string }>(
    'SELECT id FROM private.professionals WHERE user_id=$1',
    [identity.id]
  )
  if (!p)
    throw new AuthError(404, 'NOT_FOUND', 'No existe el perfil profesional.')
  await lockProfessional(client, p.id)
  return p.id
}
async function validateQuote(client: PoolClient, payment: PaymentRow) {
  const {
    rows: [state],
  } = await client.query<{ valid: boolean }>(
    `SELECT p.is_active AND to_jsonb(p)=$2::jsonb AND
 (SELECT to_jsonb(s) FROM private.subscriptions s WHERE s.professional_id=$3) IS NOT DISTINCT FROM $4::jsonb AS valid
 FROM private.saas_plans p WHERE id=$1`,
    [
      payment.plan_id,
      payment.plan_snapshot,
      payment.professional_id,
      payment.expected_subscription,
    ]
  )
  return !!state?.valid
}
export async function availablePlans(pool: Pool) {
  return (
    await pool.query(
      `SELECT id,name,max_clients AS "maxClients",is_unlimited AS "isUnlimited",price_mxn AS "priceMxn" FROM private.saas_plans WHERE is_active ORDER BY max_clients NULLS LAST,id`
    )
  ).rows
}
export async function createQuote(
  pool: Pool,
  identity: SessionIdentity,
  data: { planId: string; idempotencyKey: string }
) {
  return transaction(pool, async (client) => {
    const professionalId = await actor(client, identity)
    const previous = await client.query<PaymentRow>(
      'SELECT * FROM private.simulated_payments WHERE professional_id=$1 AND idempotency_key=$2',
      [professionalId, data.idempotencyKey]
    )
    if (previous.rows[0]) {
      if (previous.rows[0].plan_id !== data.planId)
        throw conflict(
          'IDEMPOTENCY_CONFLICT',
          'Este intento ya corresponde a otro plan.'
        )
      return previous.rows[0]
    }
    await client.query(
      "UPDATE private.simulated_payments SET status='failed',failure_code='QUOTE_EXPIRED',completed_at=clock_timestamp() WHERE professional_id=$1 AND status='pending' AND quote_expires_at<=clock_timestamp()",
      [professionalId]
    )
    if (
      (
        await client.query(
          "SELECT id FROM private.simulated_payments WHERE professional_id=$1 AND status IN('pending','processing')",
          [professionalId]
        )
      ).rowCount
    )
      throw conflict(
        'PAYMENT_IN_PROGRESS',
        'Tienes una operación pendiente. Reanúdala desde tu historial.'
      )
    const {
      rows: [plan],
    } = await client.query(
      'SELECT p.*,to_jsonb(p) AS snapshot FROM private.saas_plans p WHERE id=$1 AND is_active',
      [data.planId]
    )
    if (!plan)
      throw new AuthError(
        404,
        'PLAN_UNAVAILABLE',
        'El plan no está disponible.'
      )
    const {
      rows: [subscription],
    } = await client.query(
      'SELECT s.*,to_jsonb(s) AS snapshot FROM private.subscriptions s WHERE professional_id=$1',
      [professionalId]
    )
    if (
      subscription?.status === 'active' &&
      subscription.expires_at > new Date()
    ) {
      const {
        rows: [current],
      } = await client.query(
        'SELECT max_clients FROM private.saas_plans WHERE id=$1',
        [subscription.plan_id]
      )
      if (
        current.max_clients === null ||
        (plan.max_clients !== null && plan.max_clients <= current.max_clients)
      )
        throw conflict(
          'UPGRADE_REQUIRED',
          'Elige un plan con mayor capacidad que el vigente.'
        )
    }
    return (
      await client.query<PaymentRow>(
        `INSERT INTO private.simulated_payments(professional_id,actor_id,plan_id,idempotency_key,plan_snapshot,expected_subscription,amount_cents) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          professionalId,
          identity.id,
          data.planId,
          data.idempotencyKey,
          plan.snapshot,
          subscription?.snapshot ?? null,
          Math.round(Number(plan.price_mxn) * 100),
        ]
      )
    ).rows[0]
  })
}
export async function accessPayment(
  pool: Pool,
  identity: SessionIdentity,
  id: string,
  action: 'read' | 'confirm' | 'cancel' = 'read',
  instrument?: TestInstrument
) {
  return transaction(pool, async (client) => {
    await actor(client, identity)
    let payment = (
      await client.query<PaymentRow>(
        'SELECT * FROM private.simulated_payments WHERE id=$1 AND actor_id=$2 FOR UPDATE',
        [id, identity.id]
      )
    ).rows[0]
    if (!payment)
      throw new AuthError(404, 'NOT_FOUND', 'La operación no existe.')
    const current = (
      await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')
    ).rows[0].now
    if (payment.status === 'pending' && payment.quote_expires_at <= current) {
      await client.query(
        "UPDATE private.simulated_payments SET status='failed',failure_code='QUOTE_EXPIRED',completed_at=clock_timestamp() WHERE id=$1",
        [id]
      )
      payment = { ...payment, status: 'failed', failure_code: 'QUOTE_EXPIRED' }
    }
    if (
      payment.status === 'processing' &&
      payment.processing_after! <= current
    ) {
      if (!(await validateQuote(client, payment)))
        await client.query(
          "UPDATE private.simulated_payments SET status='failed',failure_code='CHECKOUT_STALE',completed_at=clock_timestamp() WHERE id=$1",
          [id]
        )
      else if (payment.instrument === 'test_approved')
        await client.query('SELECT private.apply_simulated_payment($1)', [id])
      else
        await client.query(
          "UPDATE private.simulated_payments SET status='failed',failure_code=$2,completed_at=clock_timestamp() WHERE id=$1",
          [
            id,
            payment.instrument === 'test_declined'
              ? 'PAYMENT_DECLINED'
              : 'PROCESSOR_ERROR',
          ]
        )
      payment = (
        await client.query<PaymentRow>(
          'SELECT * FROM private.simulated_payments WHERE id=$1',
          [id]
        )
      ).rows[0]
    }
    if (
      action === 'cancel' &&
      (payment.status === 'pending' || payment.status === 'processing')
    ) {
      return (
        await client.query<PaymentRow>(
          "UPDATE private.simulated_payments SET status='cancelled',completed_at=clock_timestamp() WHERE id=$1 RETURNING *",
          [id]
        )
      ).rows[0]
    }
    if (action === 'confirm') {
      if (payment.status === 'succeeded' || payment.status === 'processing') {
        if (payment.instrument !== instrument)
          throw conflict(
            'IDEMPOTENCY_CONFLICT',
            'Este pago ya utiliza otro instrumento.'
          )
        return payment
      }
      if (payment.status !== 'pending')
        return {
          conflict: conflict(
            payment.failure_code ?? 'PAYMENT_CLOSED',
            'Esta operación terminó. Inicia una nueva cotización.'
          ),
        }
      if (!(await validateQuote(client, payment))) {
        await client.query(
          "UPDATE private.simulated_payments SET status='failed',failure_code='CHECKOUT_STALE',completed_at=clock_timestamp() WHERE id=$1",
          [id]
        )
        return { conflict: conflict() }
      }
      return (
        await client.query<PaymentRow>(
          "UPDATE private.simulated_payments SET status='processing',instrument=$2,processing_after=clock_timestamp()+interval '2 seconds' WHERE id=$1 RETURNING *",
          [id, instrument]
        )
      ).rows[0]
    }
    return payment
  })
}
export async function paymentHistory(pool: Pool, identity: SessionIdentity) {
  return transaction(pool, async (client) => {
    await actor(client, identity)
    return (
      await client.query<PaymentRow>(
        'SELECT * FROM private.simulated_payments WHERE actor_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',
        [identity.id]
      )
    ).rows
  })
}

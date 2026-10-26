import type { RequestHandler } from 'express'
import type { Pool } from 'pg'
import {
  listCheckoutPlans,
  quotePayment,
  paymentOperation,
  listPayments,
} from '../services/checkout.js'
export function checkoutControllers(pool: Pool) {
  const handle =
    (operation: RequestHandler): RequestHandler =>
    async (req, res, next) => {
      try {
        await operation(req, res, next)
      } catch (error) {
        next(error)
      }
    }
  return {
    plans: handle(async (_req, res) => {
      res.json({ plans: await listCheckoutPlans(pool) })
    }),
    quote: handle(async (req, res) => {
      res
        .status(201)
        .json({ payment: await quotePayment(pool, req.identity!, req.body) })
    }),
    history: handle(async (req, res) => {
      res.json({ payments: await listPayments(pool, req.identity!) })
    }),
    read: handle(async (req, res) => {
      res.json({
        payment: await paymentOperation(
          pool,
          req.identity!,
          req.params.id,
          'read'
        ),
      })
    }),
    confirm: handle(async (req, res) => {
      res.json({
        payment: await paymentOperation(
          pool,
          req.identity!,
          req.params.id,
          'confirm',
          req.body
        ),
      })
    }),
    cancel: handle(async (req, res) => {
      res.json({
        payment: await paymentOperation(
          pool,
          req.identity!,
          req.params.id,
          'cancel',
          req.body
        ),
      })
    }),
  }
}

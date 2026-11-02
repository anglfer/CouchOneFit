import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validatePlanInput } from '../src/features/admin/validators/plans.js'

test('plan limits reject fractions, non-finite values and oversized integers', () => {
  for (const maxClients of [1.5, NaN, Infinity, 2147483648, 0, -1]) {
    assert.throws(() =>
      validatePlanInput({ name: 'Plan', maxClients, priceMxn: 299 })
    )
  }
})
test('plan prices reject coercion, non-finite values and excess precision', () => {
  for (const priceMxn of [
    null,
    '',
    '299',
    Infinity,
    NaN,
    -1,
    0,
    1.001,
    100000000,
  ]) {
    assert.throws(() =>
      validatePlanInput({ name: 'Plan', maxClients: 10, priceMxn })
    )
  }
})
test('an update without isActive keeps availability while a create defaults to active', () => {
  const body = { name: 'Plan', maxClients: 10, isUnlimited: false, priceMxn: 299 }
  assert.equal(validatePlanInput(body, true).isActive, undefined)
  assert.equal(validatePlanInput(body).isActive, true)
  assert.equal(validatePlanInput({ ...body, isActive: false }, true).isActive, false)
})
test('unlimited capacity has an explicit flag consistent with its nullable limit', () => {
  assert.throws(() =>
    validatePlanInput({
      name: 'Plan',
      maxClients: null,
      isUnlimited: false,
      priceMxn: 999,
    })
  )
  assert.deepEqual(
    validatePlanInput({
      name: 'Élite',
      maxClients: null,
      isUnlimited: true,
      priceMxn: 999,
    }),
    {
      name: 'Élite',
      maxClients: null,
      isUnlimited: true,
      priceMxn: 999,
      isActive: true,
    }
  )
})

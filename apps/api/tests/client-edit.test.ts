import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clientEditInput, mergedClientEdit } from '../src/features/professional/validators/client-edit.js'

const current = { fullName: 'Client 😀', goal: null, birthDate: '1990-05-20', heightCm: 170.5,
  baseWeightKg: 70.2, baseBodyFatPercentage: null, waistCm: null, hipCm: null }
const now = new Date('2026-10-28T18:00:00Z')
test('HU-017 partial validation reuses dictionary boundaries, strict types and Unicode without altering omitted fields', () => {
  for (const [key,min,max] of [['heightCm',100,250],['baseWeightKg',30,300],['baseBodyFatPercentage',2,60],['waistCm',40,250],['hipCm',50,250]] as const) {
    for (const value of [min,max]) assert.equal(mergedClientEdit(current, { [key]: value }, now)[key], value)
    for (const value of [min-0.1,max+0.1,70.25,true,'70.2',Infinity,NaN])
      assert.throws(() => mergedClientEdit(current, { [key]: value }, now), { code: 'INVALID_INPUT' })
  }
  const name = '😀'.repeat(150)
  assert.equal(mergedClientEdit(current, {fullName: name}, now).fullName, name)
  assert.throws(() => mergedClientEdit(current, {fullName: name+'a'}, now), {code:'INVALID_INPUT'})
  assert.equal(mergedClientEdit(current, {birthDate:'2008-10-28'}, now).birthDate, '2008-10-28')
  assert.throws(() => mergedClientEdit(current, {birthDate:'2008-10-29'}, now), {code:'INVALID_INPUT'})
  for (const version of [null,'1',true,1.1,0,-1,2147483648]) assert.throws(() => clientEditInput({version,goal:'x'}), {code:'INVALID_INPUT'})
  assert.throws(() => clientEditInput({version:1,createdAt:'forged'}), {code:'INVALID_INPUT'})
})

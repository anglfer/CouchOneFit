import assert from 'node:assert/strict'
import {test} from 'node:test'
import {ageAt,calculate} from '../src/features/evaluations/domain/assessment.js'
import {assessmentInput} from '../src/features/evaluations/validators/assessment.js'
const input=(method:string,measurements:Record<string,unknown>,extra={})=>assessmentInput({method,equation:'not_applicable',measurements,...extra},'2026-11-09')
test('reference arithmetic preserves FFM, not muscle; missing inputs produce no inventions',()=>{
  assert.deepEqual(calculate(input('bioimpedancia',{weightKg:80,measuredBodyFatPercentage:25,waterLitres:40,muscleMassKg:30})),{bodyFatPercentage:25,fatMassKg:20,fatFreeMassKg:60,approximateWaterPercentage:50})
  assert.deepEqual(calculate(input('bioimpedancia',{muscleMassKg:30})),{})
  assert.deepEqual(calculate(input('bioimpedancia',{measuredBodyFatPercentage:25})),{bodyFatPercentage:25})
})
test('ratios use waist, never umbilical abdomen; Navy and JP3 remain disabled',()=>{
  assert.deepEqual(calculate(input('perimetros',{waistCm:80,hipCm:100,heightCm:200,abdomenUmbilicalCm:95})),{waistHipRatio:0.8,waistHeightRatio:0.4})
  assert.deepEqual(calculate(input('perimetros',{abdomenUmbilicalCm:95,neckCm:40,heightCm:180},{equation:'male'})),{})
  assert.deepEqual(calculate(input('pliegues',{pectoralSkinfoldMm:10,abdominalSkinfoldMm:15,thighSkinfoldMm:20},{equation:'male'})),{})
})
test('DTO rejects forged outputs, mixed fields, invalid numeric/date inputs and incoherent mass',()=>{
  for(const m of [{waterLitres:NaN},{waterLitres:Infinity},{waterLitres:0},{waterLitres:-1},{waterLitres:12.25},{weightKg:80,waterLitres:81},{neckCm:30}]) assert.throws(()=>input('bioimpedancia',m))
  for(const extra of [{ownerId:'forged'},{results:{bodyFatPercentage:20}},{effectiveDate:'2026-02-30'},{effectiveDate:'2026-11-10'},{equation:'unknown'}]) assert.throws(()=>input('perimetros',{waistCm:80},extra))
  assert.throws(()=>input('perimetros',{}));assert.throws(()=>input('perimetros',{weightKg:80}))
  assert.throws(()=>calculate({method:'perimetros',equation:'male',effectiveDate:null,measurements:{hipCm:0}}))
})
test('explicit homogeneous segmental units and effective birthdays',()=>{
  assert.equal(ageAt('1990-11-10','2026-11-09'),35);assert.equal(ageAt('1990-11-09','2026-11-09'),36);assert.equal(ageAt(null,'2026-11-09'),null)
  const s={type:'muscle_mass',unit:'kg',values:{leftArm:2.5,rightArm:2.6}}
  assert.deepEqual(input('bioimpedancia',{weightKg:80,muscleMassKg:30},{segmental:s}).segmental,s)
  assert.throws(()=>input('bioimpedancia',{muscleMassKg:30},{segmental:{...s,unit:'%'}}));assert.throws(()=>input('pliegues',{thighSkinfoldMm:10},{segmental:s}))
})

test('each method preserves omission and NULL without invented measurements', () => {
  for (const [method, measurements] of [
    ['perimetros', { waistCm: 80.1 }],
    ['pliegues', { bicepsSkinfoldMm: 8.1 }],
    ['bioimpedancia', { muscleMassKg: 30.1 }],
  ] as const) {
    const parsed = input(method, { ...measurements, weightKg: null, heightCm: null })
    assert.deepEqual(parsed.measurements, measurements)
    assert.equal(parsed.effectiveDate, null)
    assert.deepEqual(calculate(parsed), {})
  }
})

test('multimethod validates every DEC-006 bound and forbids forged technical dates and associations', () => {
  for (const [method, field, minimum, maximum] of [
    ['perimetros', 'waistCm', 40, 250],
    ['perimetros', 'hipCm', 50, 250],
    ['bioimpedancia', 'measuredBodyFatPercentage', 2, 60],
    ...['tricepsSkinfoldMm', 'bicepsSkinfoldMm', 'subscapularSkinfoldMm', 'suprailiacSkinfoldMm', 'pectoralSkinfoldMm', 'abdominalSkinfoldMm', 'thighSkinfoldMm'].map(field => ['pliegues', field, 1, 80] as const),
  ] as const) {
    for (const value of [minimum, maximum]) assert.equal(input(method, { [field]: value }).measurements[field], value)
    for (const value of [minimum - 0.1, maximum + 0.1, minimum + 0.01, null, '10', true, NaN, Infinity]) {
      assert.throws(() => input(method, { [field]: value }))
    }
  }
  for (const extra of [{ clientId: 'forged' }, { professionalId: 'forged' }, { evaluationDate: '2000-01-01' }, { createdAt: '2000-01-01T00:00:00Z' }]) {
    assert.throws(() => input('perimetros', { waistCm: 80 }, extra))
  }
})

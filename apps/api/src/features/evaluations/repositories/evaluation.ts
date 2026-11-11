import { ageAt, calculate, type Assessment, type AssessmentInput } from '../domain/assessment.js'
import type { Pool, PoolClient } from 'pg'
import { AuthError } from '../../auth/types/errors.js'
import { lockActor, readAsSubject, transaction } from '../../auth/repositories/lifecycle.js'
import type { SessionIdentity } from '../../auth/types/session.js'
import type { Evaluation, EvaluationMeasurementField, EvaluationMeasurements } from '../types/evaluation.js'

const fields: Record<EvaluationMeasurementField, string> = {
  weightKg: 'weight_kg',
  waistCm: 'waist_cm',
  hipCm: 'hip_cm',
  measuredBodyFatPercentage: 'measured_body_fat_percentage',
  pectoralSkinfoldMm: 'pectoral_skinfold_mm',
  abdominalSkinfoldMm: 'abdominal_skinfold_mm',
  tricepsSkinfoldMm: 'triceps_skinfold_mm',
  suprailiacSkinfoldMm: 'suprailiac_skinfold_mm',
  thighSkinfoldMm: 'thigh_skinfold_mm',
}

const projection = `id,client_id,evaluation_date::text AS evaluation_date,created_at,to_jsonb(client_evaluations)->'assessment' AS assessment,
  weight_kg::float8 AS weight_kg,waist_cm::float8 AS waist_cm,hip_cm::float8 AS hip_cm,
  measured_body_fat_percentage::float8 AS measured_body_fat_percentage,
  pectoral_skinfold_mm::float8 AS pectoral_skinfold_mm,abdominal_skinfold_mm::float8 AS abdominal_skinfold_mm,
  triceps_skinfold_mm::float8 AS triceps_skinfold_mm,suprailiac_skinfold_mm::float8 AS suprailiac_skinfold_mm,
  thigh_skinfold_mm::float8 AS thigh_skinfold_mm`

function mapEvaluation(row: Record<string, unknown>): Evaluation {
  const value = (field: EvaluationMeasurementField) => {
    const raw = row[fields[field]]
    return raw === null ? null : Number(raw)
  }
  return {
    ...(row.assessment ? { assessment: {...row.assessment as Assessment, method: ({circumference:'perimetros',skinfolds:'pliegues',bioimpedance:'bioimpedancia'} as const)[(row.assessment as {method:'circumference'|'skinfolds'|'bioimpedance'}).method]} } : {}),
    id: String(row.id),
    clientId: String(row.client_id),
    evaluationDate: String(row.evaluation_date),
    createdAt: new Date(row.created_at as Date).toISOString(),
    weightKg: value('weightKg'),
    waistCm: value('waistCm'),
    hipCm: value('hipCm'),
    measuredBodyFatPercentage: value('measuredBodyFatPercentage'),
    pectoralSkinfoldMm: value('pectoralSkinfoldMm'),
    abdominalSkinfoldMm: value('abdominalSkinfoldMm'),
    tricepsSkinfoldMm: value('tricepsSkinfoldMm'),
    suprailiacSkinfoldMm: value('suprailiacSkinfoldMm'),
    thighSkinfoldMm: value('thighSkinfoldMm'),
  }
}

function professionalOnly(identity: SessionIdentity): void {
  if (identity.role !== 'professional')
    throw new AuthError(403, 'EVALUATION_FORBIDDEN', 'No tienes permiso para consultar esta evaluación.')
}

async function assertPortfolio(c: PoolClient, identity: SessionIdentity, clientId: string, write: boolean): Promise<{birth_date: string | null}> {
  const { rows: [authorization] } = await c.query<{ allowed: boolean }>(
    'SELECT private.training_professional($1) AS allowed', [identity.id],
  )
  if (!authorization.allowed)
    throw new AuthError(403, 'EVALUATION_FORBIDDEN', 'No tienes permiso para consultar o registrar evaluaciones.')
  const { rows: [row] } = await c.query<{ id: string; status: string; birth_date: string | null }>(
    `SELECT c.id,c.status,c.birth_date::text FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
     WHERE c.id=$1 AND p.user_id=$2 ${write ? 'FOR UPDATE OF c' : ''}`,
    [clientId, identity.id],
  )
  if (!row) throw new AuthError(404, 'CLIENT_NOT_FOUND', 'El cliente no está disponible.')
  if (write && row.status !== 'active')
    throw new AuthError(403, 'EVALUATION_FORBIDDEN', 'No se pueden registrar evaluaciones en un expediente inactivo.')
  return row
}

export async function create(pool: Pool, identity: SessionIdentity, clientId: string, measurements: EvaluationMeasurements, now = new Date(), input?: AssessmentInput): Promise<Evaluation> {
  professionalOnly(identity)
  return transaction(pool, async (c) => {
    await lockActor(c, identity, now, true)
    const client = await assertPortfolio(c, identity, clientId, true)
    let assessment: Assessment | null = null
    if (input) {
      const {rows:[schema]}=await c.query<{ready:boolean}>("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='private' AND table_name='client_evaluations' AND column_name='assessment') AS ready")
      if (!schema.ready) throw new AuthError(503,'EVALUATION_UPGRADE_REQUIRED','El registro multimétodo requiere aplicar la migración autorizada. El historial anterior sigue disponible.')
      const { rows: [clock] } = await c.query<{date:string}>("SELECT timezone('UTC',clock_timestamp())::date::text AS date")
      const effectiveDate = input.effectiveDate ?? clock.date
      if (effectiveDate > clock.date || (client.birth_date && effectiveDate < client.birth_date)) throw new AuthError(400, 'INVALID_EVALUATION', 'La fecha efectiva no corresponde al cliente.')
      assessment = {...input,protocol:input.method==='perimetros'?'circumference-sites-pending':input.method==='pliegues'?'jp3-sites-pending':'device-kg-litre-v1',effectiveDate,ownerId:identity.id,birthDate:client.birth_date,ageYears:ageAt(client.birth_date,effectiveDate),version:'composition-arithmetic-v1',calculationStatus:input.method==='bioimpedancia' ? 'available' : 'pending_verification',provenance:input.method==='bioimpedancia' ? 'device_reported':'manual_measurements',results:calculate(input)}
      if (!Object.keys(assessment.results).length && input.method==='bioimpedancia') assessment.calculationStatus='partial'
    }
    const columns: string[] = Object.values(fields)
    const values: unknown[] = Object.keys(fields).map((key) => measurements[key as EvaluationMeasurementField])
    if (assessment) {columns.push('assessment'); values.push(JSON.stringify({...assessment,method:({perimetros:'circumference',pliegues:'skinfolds',bioimpedancia:'bioimpedance'} as const)[assessment.method]}))}
    const placeholders = values.map((_, index) => `$${index + 2}`).join(',')
    const { rows: [row] } = await c.query(
      `INSERT INTO private.client_evaluations(client_id,${columns.join(',')})
       VALUES($1,${placeholders}) RETURNING ${projection}`,
      [clientId, ...values],
    )
    return mapEvaluation(row)
  })
}

export async function list(pool: Pool, identity: SessionIdentity, clientId: string, offset = 0): Promise<Evaluation[]> {
  professionalOnly(identity)
  return readAsSubject(pool, identity.id, async (c) => {
    await lockActor(c, identity, undefined, true)
    await assertPortfolio(c, identity, clientId, false)
    const { rows } = await c.query(
      `SELECT ${projection} FROM private.client_evaluations
       WHERE client_id=$1 ORDER BY COALESCE(to_jsonb(client_evaluations)->'assessment'->>'effectiveDate',evaluation_date::text) DESC,created_at DESC,id DESC LIMIT 20 OFFSET $2`,
      [clientId, offset],
    )
    return rows.map(mapEvaluation)
  })
}

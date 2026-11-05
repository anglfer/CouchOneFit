import { createHash } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import { AuthError } from '../../auth/types/errors.js'
import { lockActor, readAsSubject } from '../../auth/repositories/lifecycle.js'
import type { Prescription, SetResult, TrainingSession, TrainingVersion, TrainingActivity } from '../types/training.js'

export const conflict = (message = 'El entrenamiento cambió. Actualiza la rutina antes de guardar.'): never => { throw new AuthError(409, 'TRAINING_CONFLICT', message) }
export const missing = (): never => { throw new AuthError(404, 'TRAINING_NOT_FOUND', 'El entrenamiento no está disponible.') }
export const forbidden = (): never => { throw new AuthError(403, 'TRAINING_READ_ONLY', 'Puedes consultar tu rutina, pero no registrar cambios en este momento.') }
export interface Scope { clientId: string; timeZone: string; canWrite: boolean; clientRevision: number; clientName?: string }
export async function scope(c: PoolClient, identity: SessionIdentity, clientId: string | null, write = false): Promise<Scope | null> {
  if (identity.role === 'professional') {
    const { rows: [allowed] } = await c.query('SELECT private.training_professional($1) AS allowed', [identity.id])
    if (!allowed.allowed) return forbidden()
    if (!clientId) return null
    const { rows: [client] } = await c.query(`SELECT c.id,c.time_zone,c.version,c.status,c.full_name FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=$1 AND p.user_id=$2 ${write ? 'FOR UPDATE OF c' : ''}`, [clientId, identity.id])
    if (!client) return missing()
    if (write && client.status !== 'active') return forbidden()
    return { clientId: client.id, timeZone: client.time_zone, canWrite: client.status === 'active', clientRevision: client.version, clientName: client.full_name }
  }
  if (identity.role !== 'client') return forbidden()
  if (write) await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`training-session:${identity.id}`])
  const { rows: [client] } = await c.query(`SELECT c.id,c.time_zone,c.version,private.training_client_access(c.id,true) AS writable FROM private.clients c WHERE c.user_id=$1`, [identity.id])
  if (!client || (clientId && client.id !== clientId)) return missing()
  if (write && !client.writable) return forbidden()
  return { clientId: client.id, timeZone: client.time_zone, canWrite: client.writable, clientRevision: client.version }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value)
}
export const read = <T>(pool: Pool, identity: SessionIdentity, work: (c: PoolClient) => Promise<T>) => readAsSubject(pool, identity.id, work)
export async function mutate<T>(pool: Pool, identity: SessionIdentity, key: string, operation: string, body: unknown, now: Date, work: (c: PoolClient) => Promise<T>): Promise<T> {
  return read(pool, identity, async c => {
    await lockActor(c, identity, now, true)
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${identity.id}:${key}`])
    const hash = createHash('sha256').update(operation+'\n'+canonical(body)).digest('hex')
    const { rows: [saved] } = await c.query('SELECT request_hash,response FROM private.idempotency_keys WHERE owner_id=$1 AND key=$2 FOR UPDATE', [identity.id,key])
    if (saved) {
      if (saved.request_hash !== hash) throw new AuthError(409,'IDEMPOTENCY_KEY_REUSED','La clave ya corresponde a otro cambio.')
      if (!saved.response) return conflict('La operación sigue en curso. Reintenta la misma solicitud.')
      return saved.response as T
    }
    const result = await work(c)
    await c.query('INSERT INTO private.idempotency_keys(owner_id,key,request_hash,status_code,response,completed_at) VALUES($1,$2,$3,200,$4,clock_timestamp())', [identity.id,key,hash,JSON.stringify(result)])
    return result
  })
}
const projection = `SELECT v.*,p.client_id FROM private.training_versions v JOIN private.training_plans p ON p.id=v.plan_id`
// Documents stored before rep ranges/RIR/rest/set kinds existed read back with explicit defaults.
const normalize = (document: Prescription): Prescription => ({ ...document, days: document.days.map(day => ({ ...day, exercises: day.exercises.map(e => ({ ...e, restSeconds: e.restSeconds ?? null, sets: e.sets.map(s => ({ ...s, kind: s.kind ?? 'working', repsMax: s.repsMax ?? null, rpe: s.rpe ?? null, rir: s.rir ?? null })) })) })) })
function mapVersion(row: { document: Prescription; id: string; plan_id: string; client_id: string | null; number: number; revision: number; published: boolean; created_at: Date }): TrainingVersion {
  return { ...normalize(row.document), id: row.id, planId: row.plan_id, clientId: row.client_id, number: row.number, revision: row.revision, published: row.published, createdAt: new Date(row.created_at).toISOString() }
}
export async function version(c: PoolClient, id: string): Promise<TrainingVersion> {
  const { rows: [row] } = await c.query(`${projection} WHERE v.id=$1`,[id])
  return row ? mapVersion(row) : missing()
}
export async function versions(c: PoolClient, identity: SessionIdentity, clientId: string | null) {
  const { rows } = await c.query(`${projection} WHERE p.owner_id=$1 AND p.client_id IS NOT DISTINCT FROM $2::uuid ORDER BY v.created_at DESC,v.number DESC`,[identity.id,clientId])
  return rows.map(mapVersion)
}
export async function ownedPlan(c: PoolClient, identity: SessionIdentity, planId: string, clientId: string | null) {
  const { rows: [row] } = await c.query('SELECT * FROM private.training_plans WHERE id=$1 AND owner_id=$2 AND client_id IS NOT DISTINCT FROM $3::uuid',[planId,identity.id,clientId])
  if (!row) return missing()
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[planId])
}
export async function createPlan(c: PoolClient, identity: SessionIdentity, id: string, clientId: string | null) {
  if (clientId && (await c.query('SELECT 1 FROM private.training_plans WHERE client_id=$1',[clientId])).rowCount) return conflict('El cliente ya tiene una rutina. Edítala desde su historial.')
  await c.query('INSERT INTO private.training_plans(id,owner_id,client_id) VALUES($1,$2,$3)',[id,identity.id,clientId])
}
export async function hydrate(c: PoolClient, document: Prescription): Promise<Prescription> {
  for (const day of document.days) for (const exercise of day.exercises) {
    if (!exercise.catalogId) continue
    const { rows: [catalog] } = await c.query('SELECT * FROM private.training_exercise_catalog WHERE id=$1 AND selectable',[exercise.catalogId])
    if (!catalog) throw new AuthError(400,'EXERCISE_UNAVAILABLE','El ejercicio del catálogo no admite esta prescripción por repeticiones.')
    exercise.name = catalog.name
    exercise.guidance = catalog.guidance
    exercise.images = catalog.images
  }
  return document
}
export async function storeVersion(c: PoolClient, planId: string, id: string, document: Prescription, revision?: number): Promise<TrainingVersion> {
  if (revision !== undefined) {
    const { rowCount } = await c.query('UPDATE private.training_versions SET document=$3,revision=revision+1 WHERE id=$1 AND plan_id=$2 AND revision=$4 AND NOT published',[id,planId,JSON.stringify(document),revision])
    if (!rowCount) return conflict()
    await c.query('DELETE FROM private.training_sets WHERE version_id=$1',[id])
    await c.query('DELETE FROM private.training_exercises WHERE version_id=$1',[id])
    await c.query('DELETE FROM private.training_days WHERE version_id=$1',[id])
  } else {
    if ((await c.query('SELECT 1 FROM private.training_versions WHERE plan_id=$1 AND NOT published',[planId])).rowCount) return conflict('Ya existe un borrador. Continúa editándolo.')
    await c.query('INSERT INTO private.training_versions(id,plan_id,number,document) SELECT $1,$2,COALESCE(max(number),0)+1,$3 FROM private.training_versions WHERE plan_id=$2',[id,planId,JSON.stringify(document)])
  }
  for (const [i,day] of document.days.entries()) {
    await c.query('INSERT INTO private.training_days(version_id,id,ordinal,kind) VALUES($1,$2,$3,$4)',[id,day.id,i,day.kind])
    for (const [j,e] of day.exercises.entries()) {
      await c.query('INSERT INTO private.training_exercises(version_id,day_id,id,ordinal,load_mode,rest_seconds) VALUES($1,$2,$3,$4,$5,$6)',[id,day.id,e.id,j,e.loadMode,e.restSeconds])
      for (const [k,s] of e.sets.entries()) await c.query('INSERT INTO private.training_sets(version_id,exercise_id,id,ordinal,kind,reps,reps_max,rpe,rir,target_load_kg) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,e.id,s.id,k,s.kind,s.reps,s.repsMax,s.rpe,s.rir,s.targetLoadKg])
    }
  }
  return version(c,id)
}
export async function active(c: PoolClient, clientId: string) {
  const { rows: [row] } = await c.query('SELECT version_id,revision FROM private.training_active WHERE client_id=$1',[clientId])
  return row ? { versionId: row.version_id as string, revision: row.revision as number } : { versionId: null, revision: 0 }
}
export async function activate(c: PoolClient, identity: SessionIdentity, clientId: string, v: TrainingVersion, expectedActive: number, now: Date, localDate: string, timeZone: string) {
  const previous = await active(c,clientId)
  if (previous.revision !== expectedActive) return conflict('La rutina activa cambió en otro dispositivo.')
  if (!v.published) await c.query('UPDATE private.training_versions SET published=true,revision=revision+1 WHERE id=$1 AND revision=$2',[v.id,v.revision])
  await c.query('INSERT INTO private.training_active(client_id,plan_id,version_id,revision) VALUES($1,$2,$3,$4) ON CONFLICT(client_id) DO UPDATE SET plan_id=excluded.plan_id,version_id=excluded.version_id,revision=excluded.revision',[clientId,v.planId,v.id,previous.revision+1])
  await c.query('INSERT INTO private.training_activations(client_id,plan_id,version_id,activated_at,local_date,time_zone,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[clientId,v.planId,v.id,now,localDate,timeZone,previous.revision+1])
  await audit(c,identity,clientId,'activated',{versionId:v.id,revision:previous.revision+1})
  return { version: await version(c,v.id), activeRevision: previous.revision+1 }
}
export async function historical(c: PoolClient, clientId: string, date: string) {
  const { rows: [row] } = await c.query('SELECT version_id FROM private.training_activations WHERE client_id=$1 AND local_date<=$2::date ORDER BY local_date DESC,revision DESC LIMIT 1',[clientId,date])
  return row ? version(c,row.version_id) : null
}
export async function session(c: PoolClient, clientId: string, date: string): Promise<TrainingSession | null> {
  const { rows: [row] } = await c.query('SELECT * FROM private.training_sessions WHERE client_id=$1 AND local_date=$2::date',[clientId,date])
  if (!row) return null
  const { rows } = await c.query('SELECT set_id,state,reps,load_kg,rpe,rir FROM private.training_results WHERE session_id=$1 ORDER BY set_id',[row.id])
  return { id:row.id,localDate:date,timeZone:row.time_zone,versionId:row.version_id,dayId:row.day_id,revision:row.revision,status:row.status,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),results:rows.map(s=>({setId:s.set_id,state:s.state,reps:s.reps,loadKg:s.load_kg===null?null:Number(s.load_kg),rpe:s.rpe===null?null:Number(s.rpe),rir:s.rir})) }
}
export async function saveSession(c: PoolClient, identity: SessionIdentity, clientId: string, id: string, date: string, timeZone: string, versionId: string, dayId: string, status: string, entries: SetResult[], previous: TrainingSession | null, now: Date) {
  if (!previous) await c.query('INSERT INTO private.training_sessions(id,client_id,version_id,day_id,local_date,time_zone,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)',[id,clientId,versionId,dayId,date,timeZone,status,now])
  else await c.query('UPDATE private.training_sessions SET revision=revision+1,status=$2,updated_at=$3 WHERE id=$1',[previous.id,status,now])
  const sessionId = previous?.id ?? id
  await c.query('DELETE FROM private.training_results WHERE session_id=$1',[sessionId])
  for(const s of entries) await c.query('INSERT INTO private.training_results(session_id,version_id,set_id,state,reps,load_kg,rpe,rir) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[sessionId,versionId,s.setId,s.state,s.reps,s.loadKg,s.rpe,s.rir])
  const current = (await session(c,clientId,date))!
  await audit(c,identity,clientId,previous?'session_corrected':'session_created',{before:previous,after:current})
  return current
}
export async function audit(c: PoolClient, identity: SessionIdentity, clientId: string | null, action: string, data: unknown) {
  await c.query('INSERT INTO private.training_audit(owner_id,client_id,action,data) VALUES($1,$2,$3,$4)',[identity.id,clientId,action,JSON.stringify(data)])
}
export async function changeZone(c: PoolClient, identity: SessionIdentity, s: Scope, timeZone: string, revision: number) {
  const { rows:[row] } = await c.query('UPDATE private.clients SET time_zone=$2 WHERE id=$1 AND version=$3 RETURNING version',[s.clientId,timeZone,revision])
  if (!row) return conflict()
  await audit(c,identity,s.clientId,'time_zone_changed',{before:s.timeZone,after:timeZone})
  return {timeZone,clientRevision:row.version}
}
/** Recent training activity of one client, in the client's local calendar. */
export async function activity(c: PoolClient, clientId: string): Promise<TrainingActivity> {
  const { rows: [row] } = await c.query(`SELECT max(s.local_date)::text AS "lastSession",
      count(s.id) FILTER (WHERE s.local_date > (CURRENT_TIMESTAMP AT TIME ZONE c.time_zone)::date-7)::int AS "sessionsLast7",
      count(s.id) FILTER (WHERE s.local_date > (CURRENT_TIMESTAMP AT TIME ZONE c.time_zone)::date-30)::int AS "sessionsLast30",
      (SELECT count(*)::int FROM private.training_results r JOIN private.training_sessions x ON x.id=r.session_id
        WHERE x.client_id=c.id AND r.state='performed' AND x.local_date > (CURRENT_TIMESTAMP AT TIME ZONE c.time_zone)::date-30) AS "setsLast30"
    FROM private.clients c LEFT JOIN private.training_sessions s ON s.client_id=c.id WHERE c.id=$1 GROUP BY c.id,c.time_zone`,[clientId])
  return row ?? { lastSession: null, sessionsLast7: 0, sessionsLast30: 0, setsLast30: 0 }
}
/** Muscles, body part and equipment by catalog id, for client-facing reads. */
export async function catalogFacts(c: PoolClient, ids: string[]) {
  const {rows} = ids.length ? await c.query('SELECT id,body_part,muscles,equipment FROM private.training_exercise_catalog WHERE id=ANY($1)',[ids]) : {rows:[]}
  return new Map<string,{bodyPart:string,muscles:string[],equipment:string[]}>(rows.map(r=>[r.id,{bodyPart:r.body_part,muscles:r.muscles,equipment:r.equipment}]))
}
export async function catalog(c: PoolClient, search: string, muscle: string, equipment: string, offset: number) {
  const {rows} = await c.query(`SELECT id,name,body_part AS "bodyPart",muscles,equipment,guidance,images,selectable FROM private.training_exercise_catalog
    WHERE selectable AND ($1='' OR name ILIKE '%'||$1||'%') AND ($2='' OR muscles ? $2 OR body_part=$2) AND ($3='' OR equipment ? $3) ORDER BY name,id LIMIT 41 OFFSET $4`,[search,muscle,equipment,offset])
  const {rows:[filters]}=await c.query(`SELECT (SELECT COALESCE(jsonb_agg(x ORDER BY x),'[]') FROM (SELECT DISTINCT jsonb_array_elements_text(muscles) x FROM private.training_exercise_catalog WHERE selectable) m) muscles,
    (SELECT COALESCE(jsonb_agg(x ORDER BY x),'[]') FROM (SELECT DISTINCT jsonb_array_elements_text(equipment) x FROM private.training_exercise_catalog WHERE selectable) e) equipment`)
  return {exercises:rows.slice(0,40),nextOffset:rows.length>40?offset+40:null,filters,attribution:'Exercise data by RepDB (repdb.co)'}
}
export async function listSessions(c: PoolClient, clientId: string, offset: number) {
  const { rows } = await c.query("SELECT local_date::text AS date FROM private.training_sessions WHERE client_id=$1 ORDER BY local_date DESC LIMIT 41 OFFSET $2",[clientId,offset])
  const sessions=[]
  for (const row of rows.slice(0,40)) sessions.push(await session(c,clientId,row.date))
  return {sessions,nextOffset:rows.length>40?offset+40:null}
}
// shortcut: returns the whole portfolio (no paging); add a cursor if Élite portfolios grow past a few hundred.
export async function trainingClients(c: PoolClient, identity: SessionIdentity) {
  const { rows } = await c.query(`SELECT c.id,c.full_name AS "fullName",c.status,
      (SELECT v.document->>'name' FROM private.training_active a JOIN private.training_versions v ON v.id=a.version_id WHERE a.client_id=c.id) AS "activeRoutine",
      EXISTS(SELECT 1 FROM private.training_plans tp JOIN private.training_versions v ON v.plan_id=tp.id WHERE tp.client_id=c.id AND NOT v.published) AS "hasDraft",
      (SELECT max(local_date)::text FROM private.training_sessions s WHERE s.client_id=c.id) AS "lastSession",
      (SELECT count(*)::int FROM private.training_sessions s WHERE s.client_id=c.id AND s.local_date > (CURRENT_TIMESTAMP AT TIME ZONE c.time_zone)::date-7) AS "sessionsLast7"
    FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    WHERE p.user_id=$1 ORDER BY c.status='active' DESC,c.full_name,c.id`,[identity.id])
  return { clients: rows }
}

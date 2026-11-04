import type { Pool, PoolClient } from 'pg'
import type { SessionIdentity } from '../../auth/types/session.js'
import type { TrainingContext } from '../types/training.js'
import * as validate from '../validators/training.js'
import * as repository from '../repositories/training.js'
import { calendarDistance, localDate, scheduledDay } from './calendar.js'

export async function readContext(c: PoolClient, identity: SessionIdentity, clientId: string | null, requestedDate: string | null, now: Date, execution = false): Promise<TrainingContext> {
  const scope = (await repository.scope(c,identity,clientId))!
  const date = requestedDate ?? localDate(now,scope.timeZone)
  const session = execution ? await repository.session(c,scope.clientId,date) : null
  const today = localDate(now,session?.timeZone??scope.timeZone)
  if (execution && (calendarDistance(today,date)<0 || calendarDistance(today,date)>2)) return validate.invalid('Solo puedes registrar hoy y las dos fechas anteriores.')
  const current = await repository.active(c,scope.clientId)
  const plan = session ? await repository.version(c,session.versionId) : execution ? await repository.historical(c,scope.clientId,date) : current.versionId ? await repository.version(c,current.versionId) : null
  const day = plan ? scheduledDay(plan,date) : null
  return {clientId:scope.clientId,localDate:date,today,timeZone:session?.timeZone??scope.timeZone,canWrite:scope.canWrite,activeRevision:current.revision,plan,dayId:session?.dayId??day?.id??null,session}
}
export function getContext(pool: Pool, identity: SessionIdentity, clientId: string | null, query: unknown, now: Date, execution = false) {
  const q=validate.object(query,execution?['date']:[])
  const date=q.date===undefined?null:validate.date(q.date)
  return repository.read(pool,identity,c=>readContext(c,identity,clientId,date,now,execution))
}
export function getVersions(pool: Pool, identity: SessionIdentity, clientId: string | null) {
  return repository.read(pool,identity,async c=>{
    const scope=await repository.scope(c,identity,clientId)
    const active=clientId?await repository.active(c,clientId):{versionId:null,revision:0}
    return {versions:await repository.versions(c,identity,clientId),activeVersionId:active.versionId,activeRevision:active.revision,timeZone:scope?.timeZone??null,clientRevision:scope?.clientRevision??null,clientName:scope?.clientName??null}
  })
}
export async function writePlan(pool: Pool, identity: SessionIdentity, clientId: string | null, planId: string | null, versionId: string | null, key: unknown, body: unknown, now: Date) {
  const input=validate.object(body,versionId?['revision','prescription']:['id','versionId','prescription'])
  const id=planId??validate.uuid(input.id)
  const vid=versionId??validate.uuid(input.versionId)
  const revision=versionId?validate.number(input.revision,1,2147483646):undefined
  const document=validate.prescription(input.prescription)
  return repository.mutate(pool,identity,validate.uuid(key),`plan:${clientId}:${planId}:${versionId}`,body,now,async c=>{
    await repository.scope(c,identity,clientId,true)
    if (!planId) await repository.createPlan(c,identity,id,clientId)
    await repository.ownedPlan(c,identity,id,clientId)
    const v=await repository.storeVersion(c,id,vid,await repository.hydrate(c,document),revision)
    return {version:v}
  })
}
export async function activatePlan(pool: Pool, identity: SessionIdentity, clientId: string, planId: string, versionId: string, key: unknown, body: unknown, now: Date) {
  const input=validate.object(body,['revision','activeRevision'])
  const revision=validate.number(input.revision,1,2147483646)
  const expected=validate.number(input.activeRevision,0,2147483646)
  return repository.mutate(pool,identity,validate.uuid(key),`activate:${clientId}:${planId}:${versionId}`,body,now,async c=>{
    const scope=(await repository.scope(c,identity,clientId,true))!
    await repository.ownedPlan(c,identity,planId,clientId)
    const version=await repository.version(c,versionId)
    if(version.planId!==planId) return repository.missing()
    if(version.revision!==revision) return repository.conflict()
    return repository.activate(c,identity,clientId,version,expected,now,localDate(now,scope.timeZone),scope.timeZone)
  })
}
export async function saveSession(pool: Pool, identity: SessionIdentity, key: unknown, body: unknown, now: Date) {
  const input=validate.object(body,['id','localDate','versionId','revision','status','results'])
  const id=validate.uuid(input.id),date=validate.date(input.localDate),versionId=validate.uuid(input.versionId)
  const revision=validate.number(input.revision,0,2147483646),entries=validate.results(input.results)
  if(input.status!=='draft' && input.status!=='finalized') return validate.invalid()
  const status=input.status
  return repository.mutate(pool,identity,validate.uuid(key),'session',body,now,async c=>{
    const scope=(await repository.scope(c,identity,null,true))!
    const context=await readContext(c,identity,scope.clientId,date,now,true)
    const plan=context.plan,previous=context.session
    if(!plan || plan.id!==versionId || (previous && (previous.id!==id || previous.revision!==revision)) || (!previous && revision!==0)) return repository.conflict()
    const day=plan.days.find(day=>day.id===context.dayId)
    if(!day || day.kind==='rest') return validate.invalid('No se puede registrar entrenamiento en un día de descanso o sin programación.')
    if(previous?.status==='finalized' && status!=='finalized') return validate.invalid('Una corrección conserva la sesión finalizada.')
    const prescribed=new Map(day.exercises.flatMap(e=>e.sets.map(s=>[s.id,e.loadMode] as const)))
    for(const result of entries) {
      const mode=prescribed.get(result.setId)
      if(!mode) return validate.invalid('La serie no pertenece al día prescrito.')
      if(result.state==='performed' && (result.loadKg===null || (mode==='bodyweight'?result.loadKg!==0:result.loadKg<=0))) return validate.invalid('Una serie realizada necesita su carga: 0 corporal o mayor que 0 externa.')
    }
    if(status==='finalized' && entries.length!==prescribed.size) return validate.invalid('Indica realizada o no realizada en todas las series antes de finalizar.')
    return {session:await repository.saveSession(c,identity,scope.clientId,id,date,context.timeZone,plan.id,day.id,status,entries,previous,now)}
  })
}
export async function changeZone(pool: Pool, identity: SessionIdentity, clientId: string, key: unknown, body: unknown, now: Date) {
  const input=validate.object(body,['timeZone','revision']),timeZone=validate.zone(input.timeZone),revision=validate.number(input.revision,1,2147483646)
  return repository.mutate(pool,identity,validate.uuid(key),`zone:${clientId}`,body,now,async c=>repository.changeZone(c,identity,(await repository.scope(c,identity,clientId,true))!,timeZone,revision))
}
export function getCatalog(pool: Pool, identity: SessionIdentity, query: unknown) {
  const q=validate.object(query,['search','muscle','equipment','offset'])
  const offset=q.offset===undefined?0:typeof q.offset==='string' && /^\d+$/.test(q.offset)?validate.number(Number(q.offset),0,100000):validate.invalid()
  return repository.read(pool,identity,async c=>{
    await repository.scope(c,identity,null)
    return repository.catalog(c,validate.text(q.search??'',150),validate.text(q.muscle??'',100),validate.text(q.equipment??'',100),offset)
  })
}
export function getSessions(pool: Pool, identity: SessionIdentity, clientId: string, query: unknown) {
  const q=validate.object(query,['offset'])
  const offset=q.offset===undefined?0:typeof q.offset==='string' && /^\d+$/.test(q.offset)?validate.number(Number(q.offset),0,100000):validate.invalid()
  return repository.read(pool,identity,async c=>{await repository.scope(c,identity,clientId);return repository.listSessions(c,clientId,offset)})
}
export function getClients(pool: Pool, identity: SessionIdentity) {
  return repository.read(pool,identity,async c=>{await repository.scope(c,identity,null);return repository.trainingClients(c,identity)})
}

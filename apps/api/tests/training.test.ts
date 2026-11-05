import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes,randomUUID } from 'node:crypto'
import { before,after,test } from 'node:test'
import { Pool } from 'pg'
import request from 'supertest'
import { prescription,results } from '../src/features/training/validators/training.js'
import { scheduledDay,calendarDistance,localDate } from '../src/features/training/services/calendar.js'
import { catalogFacts } from '../src/features/training/repositories/training.js'

process.env.AUTH_JWT_SECRET='training-local-test-secret-at-least-32-bytes'
process.env.CORS_ORIGIN='http://localhost:5000'
const {createApp}=await import('../src/app.js')
const {signAccess}=await import('../src/features/auth/services/tokens.js')
const url=process.env.TEST_DATABASE_URL!
assert(url && ['localhost','127.0.0.1'].includes(new URL(url).hostname),'Local test database required')
const owner=new Pool({connectionString:url}),name=`cof_training_${randomBytes(5).toString('hex')}`
let db:Pool,runtime:Pool,app:ReturnType<typeof createApp>,created=false
type Actor={id:string;token:string;professionalId?:string;clientId?:string}
let pro:Actor,other:Actor,client:Actor,clientB:Actor
async function actor(role:'professional'|'client',parent?:Actor):Promise<Actor>{
 const id=randomUUID(),session=randomUUID()
 await db.query("INSERT INTO private.users(id,username,email,password_hash,role) VALUES($1::uuid,replace(left($1::text,20),'-',''),$2,'$argon2id$fixture',$3)",[id,`${id}@example.com`,role])
 await db.query('INSERT INTO private.sessions(id,user_id) VALUES($1,$2)',[session,id])
 const a:Actor={id,token:await signAccess(id,session)}
 if(role==='professional'){
  a.professionalId=(await db.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Training QA') RETURNING id",[id])).rows[0].id
  await db.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE max_clients=10",[a.professionalId])
 }else a.clientId=(await db.query("INSERT INTO private.clients(professional_id,user_id,full_name,birth_date,height_cm,base_weight_kg) VALUES($1,$2,'Training client','1995-01-01',170,70) RETURNING id",[parent!.professionalId,id])).rows[0].id
 return a
}
before(async()=>{
 await owner.query(`CREATE DATABASE "${name}"`);created=true
 const target=new URL(url);target.pathname='/'+name
 db=new Pool({connectionString:target.toString()})
 await db.query(readFileSync(new URL('../../../docs/database/schemas/identity_access.sql',import.meta.url),'utf8'))
 runtime=new Pool({connectionString:target.toString(),options:'-c role=couchone_authentication -c statement_timeout=10000',max:10})
 app=createApp(runtime);pro=await actor('professional');other=await actor('professional');client=await actor('client',pro);clientB=await actor('client',other)
})
after(async()=>{await runtime?.end();await db?.end();if(created)await owner.query(`DROP DATABASE "${name}"`);await owner.end()})
function input(){
 return {name:'Fuerza de prueba',schedule:'weekly',startDate:'2020-01-01',days:Array.from({length:7},(_,i)=>({id:randomUUID(),name:`Día ${i+1}`,kind:'training',date:null,exercises:[{id:randomUUID(),catalogId:null,name:'Sentadilla',instructions:'Controla el movimiento.',guidance:[],images:[],loadMode:'bodyweight',sets:[{id:randomUUID(),reps:10,rpe:7.5,targetLoadKg:null}]}]}))}
}
async function send(method:'post'|'patch',path:string,body:unknown,who=pro,key=randomUUID()){
 let call=request(app)[method](path).set('Idempotency-Key',key)
 if(who===client||who===clientB)call=call.set('Authorization',`Bearer ${who.token}`)
 else{const csrf=await request(app).get('/api/auth/csrf');call=call.set('Origin','http://localhost:5000').set('Cookie',[`cof_access=${who.token}`,...(csrf.headers['set-cookie'] as string[]).map(x=>x.split(';')[0])]).set('X-CSRF-Token',csrf.body.csrfToken)}
 return call.send(body)
}
const get=(path:string,who=pro)=>request(app).get(path).set('Authorization',`Bearer ${who.token}`)
test('validation and calendar boundaries distinguish rest, absence, zero and precision',()=>{
 const p=prescription(input());assert.equal(p.days.length,7)
 assert.throws(()=>prescription({...input(),days:[]}))
 const invalid=input();invalid.days[0].exercises[0].sets[0].rpe=7.2;assert.throws(()=>prescription(invalid))
 assert.throws(()=>results([{setId:randomUUID(),state:'not_performed',reps:0,loadKg:0}]))
 assert.throws(()=>results([{setId:randomUUID(),state:'not_performed',reps:0,loadKg:null,rpe:8}]))
 assert.throws(()=>results([{setId:randomUUID(),state:'performed',reps:8,loadKg:0,rpe:8.2}]))
 assert.deepEqual(results([{setId:'00000000-0000-4000-8000-000000000001',state:'performed',reps:8,loadKg:0,rir:2}])[0],{setId:'00000000-0000-4000-8000-000000000001',state:'performed',reps:8,loadKg:0,rpe:null,rir:2})
 const ranged=input(),set=ranged.days[0].exercises[0].sets[0] as Record<string,unknown>
 Object.assign(set,{reps:8,repsMax:12,rpe:null,rir:2});Object.assign(ranged.days[0].exercises[0],{restSeconds:90})
 const parsed=prescription(ranged).days[0].exercises[0];assert.deepEqual([parsed.restSeconds,parsed.sets[0].repsMax,parsed.sets[0].rpe,parsed.sets[0].rir],[90,12,null,2])
 set.repsMax=8;assert.equal(prescription(ranged).days[0].exercises[0].sets[0].repsMax,null)
 set.repsMax=7;assert.throws(()=>prescription(ranged))
 set.repsMax=null;set.rir=11;assert.throws(()=>prescription(ranged))
 assert.equal(localDate(new Date('2026-11-04T02:00:00Z'),'America/Mexico_City'),'2026-11-03')
 assert.equal(calendarDistance('2026-03-09','2026-03-07'),2)
 assert.equal(scheduledDay({...p,schedule:'cycle',startDate:'2026-11-01'},'2026-11-08')?.id,p.days[0].id)
 assert.equal(scheduledDay({...p,schedule:'calendar',days:[{...p.days[0],date:'2026-11-04'}]},'2026-11-05'),null)
})
test('complete prescription, activation, session, revisions, ownership and idempotent retries',async()=>{
 const base=`/api/clients/${client.clientId}/training-plans`,id=randomUUID(),versionId=randomUUID(),document=input(),key=randomUUID()
 const body={id,versionId,prescription:document}
 const saved=await send('post',base,body,pro,key);assert.equal(saved.status,200,JSON.stringify(saved.body))
 assert.deepEqual((await send('post',base,body,pro,key)).body,saved.body)
 assert.equal((await send('post',base,{...body,prescription:{...document,name:'Otro'}},pro,key)).status,409)
 assert.equal((await get('/api/me/training-plan',client)).body.plan,null)
 assert.equal((await get(base,other)).status,404)
 const activation=`${base}/${id}/versions/${versionId}/activate`
 const activated=await send('post',activation,{revision:1,activeRevision:0});assert.equal(activated.status,200,JSON.stringify(activated.body))
 const context=await get('/api/me/training-sessions/context',client);assert.equal(context.status,200,JSON.stringify(context.body));assert.equal(context.body.plan.id,versionId)
 assert.equal((await get(`/api/clients/${client.clientId}/record`)).body.record.sections.trainingPlan.status,'available')
 const day=context.body.plan.days.find((d:{id:string})=>d.id===context.body.dayId)
 assert.deepEqual([day.exercises[0].muscles,day.exercises[0].bodyPart],[[],null])
 const execution={id:randomUUID(),localDate:context.body.today,versionId,revision:0,status:'draft',results:[] as unknown[]}
 const sessionKey=randomUUID(),draft=await send('post','/api/me/training-sessions',execution,client,sessionKey);assert.equal(draft.status,200,JSON.stringify(draft.body))
 assert.deepEqual((await send('post','/api/me/training-sessions',execution,client,sessionKey)).body,draft.body)
 assert.equal((await send('post','/api/me/training-sessions',{...execution,revision:1,status:'finalized'},client)).status,400)
 const done={...execution,revision:1,status:'finalized',results:[{setId:day.exercises[0].sets[0].id,state:'performed',reps:9,loadKg:0,rpe:8.5,rir:1}]}
 const final=await send('post','/api/me/training-sessions',done,client);assert.equal(final.status,200,JSON.stringify(final.body))
 assert.equal((await send('post','/api/me/training-sessions',done,client)).status,409)
 assert.equal((await send('post','/api/me/training-sessions',{...done,revision:2,status:'draft'},client)).status,400)
 const v2=randomUUID();assert.equal((await send('post',`${base}/${id}/versions`,{id,versionId:v2,prescription:input()})).status,200)
 const races=await Promise.all([send('post',`${base}/${id}/versions/${v2}/activate`,{revision:1,activeRevision:1}),send('post',activation,{revision:2,activeRevision:1})])
 assert.deepEqual(races.map(r=>r.status).sort(),[200,409])
 const pinned=await get('/api/me/training-sessions/context',client);assert.equal(pinned.body.plan.id,versionId)
 assert.equal((await db.query('SELECT count(*) FROM private.training_active WHERE client_id=$1',[client.clientId])).rows[0].count,'1')
 assert.equal((await send('patch',`${base}/${id}/versions/${versionId}`,{revision:2,prescription:input()})).status,409)
 const logged=(await get(`/api/clients/${client.clientId}/training-sessions`)).body.sessions;assert.equal(logged.length,1)
 const hub=(await get('/api/training/clients')).body.clients;assert.equal(hub.length,1)
 const recordActivity=(await get(`/api/clients/${client.clientId}/record`)).body.record.sections.trainingPlan.activity
 assert.deepEqual([recordActivity.lastSession,recordActivity.sessionsLast7,recordActivity.sessionsLast30,recordActivity.setsLast30],[context.body.today,1,1,1])
 assert.deepEqual([hub[0].id,hub[0].activeRoutine,hub[0].sessionsLast7],[client.clientId,'Fuerza de prueba',1])
 assert.equal((await get('/api/training/clients',other)).body.clients.length,1)
 assert.equal((await get('/api/training/clients',client)).status,403)
 assert.equal((await get(base)).body.clientName,'Training client')
 assert.deepEqual([logged[0].results[0].rpe,logged[0].results[0].rir,logged[0].results[0].reps],[8.5,1,9])
 assert.equal((await get(`/api/clients/${client.clientId}/training-sessions`,other)).status,404)
 const history=await get('/api/me/training-history',client);assert.equal(history.status,200,JSON.stringify(history.body))
 assert.deepEqual([history.body.sessions.length,history.body.sessions[0].dayName,history.body.sessions[0].exercises[0].name,history.body.sessions[0].exercises[0].sets[0]],[1,day.name,'Sentadilla',{setId:day.exercises[0].sets[0].id,state:'performed',reps:9,loadKg:0,rpe:8.5,rir:1}])
 assert.deepEqual([history.body.sessions[0].exercises[0].muscles,history.body.sessions[0].exercises[0].catalogId],[[],null])
 assert.equal((await get('/api/me/training-history',clientB)).body.sessions.length,0)
 assert.equal((await get('/api/me/training-history')).status,403)
 assert.equal((await get('/api/me/training-history?offset=x',client)).status,400)
 const r=await runtime.connect();try{await r.query('BEGIN');await r.query("SELECT set_config('app.subject_id',$1,true)",[clientB.id]);assert.equal((await r.query('SELECT * FROM private.training_sessions')).rowCount,0);assert.equal((await r.query('SELECT * FROM private.training_versions')).rowCount,0)}finally{await r.query('ROLLBACK');r.release()}
 await db.query("UPDATE private.subscriptions SET status='suspended' WHERE professional_id=$1",[pro.professionalId])
 assert.equal((await get('/api/me/training-plan',client)).status,200)
 assert.equal((await send('post','/api/me/training-sessions',{...done,revision:2},client)).status,403)
})


test('templates remain independent; historical dates, corrections, catalog and SQL guards',async()=>{
 const coach=await actor('professional'),a=await actor('client',coach),b=await actor('client',coach);
 const template={id:randomUUID(),versionId:randomUUID(),prescription:input()};
 assert.equal((await send('post','/api/training/templates',template,coach)).status,200);
 const versions=[];
 for(const target of [a,b]){
  const body={id:randomUUID(),versionId:randomUUID(),prescription:structuredClone(template.prescription)};
  const base=`/api/clients/${target.clientId}/training-plans`;
  assert.equal((await send('post',base,body,coach)).status,200);versions.push({base,body});
 }
 const first=versions[0],second=versions[1];
 assert.equal((await send('patch',`${first.base}/${first.body.id}/versions/${first.body.versionId}`,{revision:1,prescription:{...first.body.prescription,name:'Adaptada'}},coach)).status,200);
 assert.equal((await get(second.base,coach)).body.versions[0].name,template.prescription.name);
 assert.equal((await get('/api/training/templates',coach)).body.versions[0].name,template.prescription.name);
 const activated=await send('post',`${first.base}/${first.body.id}/versions/${first.body.versionId}/activate`,{revision:2,activeRevision:0},coach);assert.equal(activated.status,200);
 const context=(await get('/api/me/training-plan',a)).body;
 const today=context.today,yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 const old=new Date(Date.parse(today+'T12:00:00Z')-4*86400000).toISOString().slice(0,10);
 assert.equal((await get(`/api/me/training-sessions/context?date=${yesterday}`,a)).body.plan,null);
 await db.query('UPDATE private.training_activations SET local_date=$2::date WHERE client_id=$1',[a.clientId,old]);
 const v2=randomUUID();assert.equal((await send('post',`${first.base}/${first.body.id}/versions`,{id:first.body.id,versionId:v2,prescription:input()},coach)).status,200);
 assert.equal((await send('post',`${first.base}/${first.body.id}/versions/${v2}/activate`,{revision:1,activeRevision:1},coach)).status,200);
 const historical=await get(`/api/me/training-sessions/context?date=${yesterday}`,a);assert.equal(historical.status,200,JSON.stringify(historical.body));assert.equal(historical.body.plan.id,first.body.versionId);
 const day=historical.body.plan.days.find((d:{id:string})=>d.id===historical.body.dayId),set=day.exercises[0].sets[0];
 const capture={id:randomUUID(),localDate:yesterday,versionId:first.body.versionId,revision:0,status:'finalized',results:[{setId:set.id,state:'not_performed',reps:0,loadKg:null}]};
 const submit=()=>request(app).post('/api/me/training-sessions').set('Authorization',`Bearer ${a.token}`).set('Idempotency-Key',randomUUID());
 assert.equal((await submit().send({...capture,localDate:old})).status,400);
 assert.equal((await submit().send({...capture,results:[{...capture.results[0],setId:randomUUID()}]})).status,400);
 const saved=await submit().send(capture);assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal((await submit().send({...capture,revision:1,results:[{setId:set.id,state:'performed',reps:1000,loadKg:0}]})).status,200);
 assert.equal((await db.query('SELECT count(*) FROM private.training_results WHERE session_id=$1',[capture.id])).rows[0].count,'1');
 const clientRevision=(await get(first.base,coach)).body.clientRevision;
 assert.equal((await send('patch',`/api/clients/${a.clientId}/training-time-zone`,{revision:clientRevision,timeZone:'America/New_York'},coach)).status,200);
 assert.equal((await get(`/api/me/training-sessions/context?date=${yesterday}`,a)).body.timeZone,'America/Mexico_City');
 const r=await runtime.connect();
 try{
  await r.query('BEGIN');await r.query("SELECT set_config('app.subject_id',$1,true)",[a.id]);
  await assert.rejects(r.query("UPDATE private.training_sessions SET status='draft',revision=revision+1 WHERE id=$1",[capture.id]),/immutable/);await r.query('ROLLBACK');
  await r.query('BEGIN');await r.query("SELECT set_config('app.subject_id',$1,true)",[a.id]);
  await r.query('DELETE FROM private.training_results WHERE session_id=$1',[capture.id]);
  await assert.rejects(r.query('COMMIT'),/every prescribed set/);
 }finally{await r.query('ROLLBACK');r.release();}
 assert.equal((await db.query('SELECT count(*) FROM private.training_results WHERE session_id=$1',[capture.id])).rows[0].count,'1');
 await db.query(`INSERT INTO private.training_exercise_catalog(id,name,body_part,muscles,equipment,guidance,images,selectable,source_revision) VALUES('qa-row','Remo','Espalda','["Dorsal ancho"]','["Polea"]','[]','[]',true,'qa')`);
 const rc=await runtime.connect();
 try{await rc.query('BEGIN');await rc.query("SELECT set_config('app.subject_id',$1,true)",[a.id]);assert.deepEqual([...(await catalogFacts(rc,['qa-row','missing'])).entries()],[['qa-row',{bodyPart:'Espalda',muscles:['Dorsal ancho'],equipment:['Polea']}]])}finally{await rc.query('ROLLBACK');rc.release()}
 assert.equal((await get('/api/training/templates',a)).status,403);
 assert.equal((await get('/api/training/exercises',coach)).status,200);
});

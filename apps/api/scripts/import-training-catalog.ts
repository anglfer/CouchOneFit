import 'dotenv/config'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

// Data: MIT. Media (thumbnail + GIF, 180x180) © Gym visual; every use must show the attribution below.
const revision='7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
const base=`https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${revision}/`
const attribution='© Gym visual — https://gymvisual.com/'
const target=process.env.DATABASE_URL
assert(target && ['localhost','127.0.0.1','[::1]'].includes(new URL(target).hostname),'Explicit local DATABASE_URL required')
const bodyParts:Record<string,string>={back:'Espalda',cardio:'Cardio',chest:'Pecho','lower arms':'Antebrazos','lower legs':'Pantorrillas',neck:'Cuello',shoulders:'Hombros','upper arms':'Brazos','upper legs':'Piernas',waist:'Zona media'}
// Labels must match the mobile muscle groups in training_progress.dart.
const targets:Record<string,string>={abs:'Recto abdominal',abductors:'Abductores',adductors:'Aductores',biceps:'Bíceps',calves:'Gemelos','cardiovascular system':'Sistema cardiovascular',delts:'Deltoides',forearms:'Antebrazos',glutes:'Glúteo mayor',hamstrings:'Isquiotibiales',lats:'Dorsal ancho','levator scapulae':'Elevador de la escápula',pectorals:'Pectoral mayor',quads:'Cuádriceps','serratus anterior':'Serrato anterior',spine:'Erectores espinales',traps:'Trapecio',triceps:'Tríceps','upper back':'Espalda alta'}
// 'body weight' maps to no equipment, which the editor reads as a bodyweight load.
const equipment:Record<string,string|null>={assisted:'Asistido',band:'Banda elástica',barbell:'Barra','body weight':null,'bosu ball':'Bosu',cable:'Polea',dumbbell:'Mancuernas','elliptical machine':'Elíptica','ez barbell':'Barra Z',hammer:'Mazo',kettlebell:'Pesa rusa','leverage machine':'Máquina de palanca','medicine ball':'Balón medicinal','olympic barbell':'Barra olímpica','resistance band':'Banda de resistencia',roller:'Rodillo',rope:'Cuerda','skierg machine':'Ergómetro de esquí','sled machine':'Máquina de trineo','smith machine':'Máquina Smith','stability ball':'Pelota de estabilidad','stationary bike':'Bicicleta estática','stepmill machine':'Escaladora',tire:'Neumático','trap bar':'Barra hexagonal','upper body ergometer':'Ergómetro de brazos',weighted:'Con lastre','wheel roller':'Rueda abdominal'}
const translate=<T,>(map:Record<string,T>,value:unknown)=>{assert(typeof value==='string' && value in map,`Missing translation: ${value}`);return map[value]}
const response=await fetch(base+'data/exercises.json')
assert(response.ok,'Catalog download failed')
const source=await response.json() as Record<string,unknown>[]
assert(Array.isArray(source) && source.length)
const seen=new Set<string>()
const records=source.map(e=>{
  assert(typeof e.id==='string' && /^[0-9]{4}$/.test(e.id) && !seen.has(e.id));seen.add(e.id)
  assert(typeof e.name==='string' && e.name.trim() && e.attribution===attribution)
  const steps=(e.instruction_steps as {es?:unknown}).es
  assert(Array.isArray(steps) && steps.length && steps.every(x=>typeof x==='string' && x.trim()))
  assert(typeof e.image==='string' && /^images\/[0-9]{4}-[\w-]+\.jpg$/.test(e.image))
  assert(typeof e.gif_url==='string' && /^videos\/[0-9]{4}-[\w-]+\.gif$/.test(e.gif_url))
  const name=e.name.trim(),gear=translate(equipment,e.equipment)
  return {id:e.id,name:name[0].toUpperCase()+name.slice(1),bodyPart:translate(bodyParts,e.body_part),muscles:[translate(targets,e.target)],equipment:gear?[gear]:[],guidance:steps as string[],
    // Still thumbnail first (paused / reduced motion), animated GIF second.
    images:[base+e.image,base+e.gif_url],
    // Only repetition work is prescribable: no cardio, stretches, poses or held planks.
    selectable:e.body_part!=='cardio' && !/stretch|\bpose\b|yoga|plank$|l-sit/i.test(name)}
})
const pool=new Pool({connectionString:target}),c=await pool.connect()
try{
  await c.query('BEGIN')
  // Replaces the whole catalog; published plans keep their own copied name, guidance and media.
  await c.query('DELETE FROM private.training_exercise_catalog WHERE NOT (id = ANY($1))',[[...seen]])
  for(const e of records)await c.query(`INSERT INTO private.training_exercise_catalog(id,name,body_part,muscles,equipment,guidance,images,selectable,source_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,body_part=excluded.body_part,muscles=excluded.muscles,equipment=excluded.equipment,guidance=excluded.guidance,images=excluded.images,selectable=excluded.selectable,source_revision=excluded.source_revision`,[e.id,e.name,e.bodyPart,JSON.stringify(e.muscles),JSON.stringify(e.equipment),JSON.stringify(e.guidance),JSON.stringify(e.images),e.selectable,revision])
  await c.query('COMMIT');console.log(`Imported ${records.length} exercises, ${records.filter(e=>e.selectable).length} support repetitions. Media ${attribution}`)
}catch(error){await c.query('ROLLBACK');throw error}finally{c.release();await pool.end()}

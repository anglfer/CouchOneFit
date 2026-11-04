import 'dotenv/config'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

// In-app import only. Do not publish the imported dataset as a dataset or public API.
const revision='66c4298af8d99b9dc397dad6699e508fb871d249'
const base=`https://raw.githubusercontent.com/RepDB/exercise-dataset/${revision}/`
const target=process.env.DATABASE_URL
assert(target && ['localhost','127.0.0.1','[::1]'].includes(new URL(target).hostname),'Explicit local DATABASE_URL required')
const labels:Record<string,string>={
  back:'Espalda',chest:'Pecho',core:'Zona media',full_body:'Cuerpo completo',lower_arms:'Antebrazos',lower_legs:'Pantorrillas',shoulders:'Hombros',upper_arms:'Brazos',upper_legs:'Piernas',
  abductors:'Abductores',adductors:'Aductores',anterior_deltoid:'Deltoides anterior',biceps_brachii:'Bíceps',brachialis:'Braquial',brachioradialis:'Braquiorradial',erector_spinae:'Erectores espinales',forearm_extensors:'Extensores del antebrazo',forearm_flexors:'Flexores del antebrazo',gastrocnemius:'Gemelos',gluteus_maximus:'Glúteo mayor',gluteus_medius:'Glúteo medio',hamstrings:'Isquiotibiales',hip_flexors:'Flexores de cadera',infraspinatus_teres_minor:'Infraespinoso y redondo menor',lateral_deltoid:'Deltoides lateral',latissimus_dorsi:'Dorsal ancho',obliques:'Oblicuos',pectoralis_major:'Pectoral mayor',posterior_deltoid:'Deltoides posterior',quadratus_lumborum:'Cuadrado lumbar',quadriceps:'Cuádriceps',rectus_abdominis:'Recto abdominal',rhomboids:'Romboides',soleus:'Sóleo',tibialis_anterior:'Tibial anterior',transverse_abdominis:'Transverso abdominal',trapezius:'Trapecio',triceps_brachii:'Tríceps',
  ab_crunch_machine:'Máquina abdominal',ab_wheel:'Rueda abdominal',air_bike:'Bicicleta de aire',assisted_pullup_machine:'Máquina de dominadas asistidas',back_extension_machine:'Máquina de extensión lumbar',barbell:'Barra',battle_rope:'Cuerdas de batalla',bicep_curl_machine:'Máquina de bíceps',bicycle:'Bicicleta',bosu_ball:'Bosu',cable:'Polea',chest_fly_machine:'Máquina de aperturas',chest_press_machine:'Máquina de press de pecho',climbing_rope:'Cuerda de escalada',dip_machine:'Máquina de fondos',dip_station:'Paralelas',donkey_calf_raise_machine:'Máquina de gemelos inclinado',dumbbell:'Mancuernas',elliptical:'Elíptica',ez_bar:'Barra Z',flat_bench:'Banco plano',glute_ham_developer:'Banco GHD',hack_squat:'Máquina hack',hip_abduction_machine:'Máquina de abductores',hip_adduction_machine:'Máquina de aductores',hip_thrust_machine:'Máquina de hip thrust',jump_rope:'Cuerda para saltar',kettlebell:'Pesa rusa',lat_pulldown_machine:'Máquina de jalón',leg_curl:'Máquina de curl femoral',leg_extension:'Máquina de extensión de piernas',leg_press:'Prensa de piernas',loop_band:'Banda circular',medicine_ball:'Balón medicinal',pec_deck:'Máquina pec deck',plate_loaded_dip_machine:'Máquina de fondos con discos',plate_loaded_lateral_raise_machine:'Máquina de elevación lateral con discos',plates:'Discos',plyo_box:'Cajón pliométrico',preacher_curl_machine:'Máquina de curl predicador',pull_up_bar:'Barra de dominadas',resistance_band:'Banda elástica',reverse_fly_machine:'Máquina de aperturas inversas',rings:'Anillas',rower:'Remo ergómetro',sandbag:'Saco de arena',seated_calf_raise_machine:'Máquina de gemelos sentado',seated_row_machine:'Máquina de remo sentado',shoulder_press_machine:'Máquina de press de hombros',shrug_machine:'Máquina de encogimientos',ski_erg:'Ergómetro de esquí',slam_ball:'Balón de golpeo',sled:'Trineo',smith_machine:'Máquina Smith',stability_ball:'Pelota de estabilidad',stair_climber:'Escaladora',standing_calf_raise_machine:'Máquina de gemelos de pie',stationary_bike:'Bicicleta estática',suspension_trainer:'Entrenador de suspensión',trap_bar:'Barra hexagonal',treadmill:'Caminadora',tricep_extension_machine:'Máquina de tríceps',wall_ball:'Balón de pared',wrist_roller:'Rodillo de muñeca',
}
const translate=(value:unknown)=>{assert(typeof value==='string' && labels[value],`Missing translation: ${value}`);return labels[value]}
const strings=(value:unknown):string[]=>{assert(Array.isArray(value) && value.every(x=>typeof x==='string'));return value}
const response=await fetch(base+'exercises.json')
assert(response.ok,'Catalog download failed')
const source=await response.json() as {exercises:Record<string,unknown>[];count:number}
assert(Array.isArray(source.exercises) && source.count===source.exercises.length)
const seen=new Set<string>()
const records=source.exercises.map(e=>{
  assert(typeof e.id==='string' && /^[a-z0-9-]+$/.test(e.id) && !seen.has(e.id));seen.add(e.id)
  assert(typeof e.name_es==='string' && e.name_es.trim())
  const instructions=strings(e.instructions_es);assert(instructions.length)
  const images=Object.values((e.images as {flat:Record<string,string>}).flat)
  assert(images.length>=1 && images.length<=2 && images.every(p=>/^images\/flat\/[a-z0-9-]+\.webp$/.test(p)))
  const equipment=e.equipment===undefined?[]:Array.isArray(e.equipment)?strings(e.equipment):[String(e.equipment)]
  return {id:e.id,name:e.name_es,bodyPart:translate(e.body_part),muscles:(e.primary_muscles==null?[]:strings(e.primary_muscles)).map(translate),equipment:equipment.map(translate),guidance:instructions,images:images.map(p=>base+p),selectable:e.force_type!=='static' && ['strength','olympic','plyometrics'].includes(String(e.category))}
})
const pool=new Pool({connectionString:target}),c=await pool.connect()
try{
  await c.query('BEGIN')
  for(const e of records)await c.query(`INSERT INTO private.training_exercise_catalog(id,name,body_part,muscles,equipment,guidance,images,selectable,source_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,body_part=excluded.body_part,muscles=excluded.muscles,equipment=excluded.equipment,guidance=excluded.guidance,images=excluded.images,selectable=excluded.selectable,source_revision=excluded.source_revision`,[e.id,e.name,e.bodyPart,JSON.stringify(e.muscles),JSON.stringify(e.equipment),JSON.stringify(e.guidance),JSON.stringify(e.images),e.selectable,revision])
  await c.query('COMMIT');console.log(`Imported ${records.length} exercises, ${records.filter(e=>e.selectable).length} support repetitions. Exercise data by RepDB (repdb.co).`)
}catch(error){await c.query('ROLLBACK');throw error}finally{c.release();await pool.end()}

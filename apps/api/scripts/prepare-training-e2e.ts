import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Pool } from 'pg'
import { hash } from 'argon2'

const target=process.env.TEST_DATABASE_URL!
assert(target && ['127.0.0.1','localhost'].includes(new URL(target).hostname) && new URL(target).pathname.toLowerCase()==='/couchonefit_test','Exclusive local database required')
const pool=new Pool({connectionString:target}),c=await pool.connect()
try {
 const suffix=randomBytes(5).toString('hex'),password=randomBytes(24).toString('base64url'),digest=await hash(password)
 await c.query('BEGIN')
 const pro=(await c.query("INSERT INTO private.users(username,email,password_hash,role) VALUES($1,$2,$3,'professional') RETURNING id",[`qa.ep06.p${suffix}`,`qa.ep06.p${suffix}@example.com`,digest])).rows[0]
 const professional=(await c.query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Profesional EP06 QA') RETURNING id",[pro.id])).rows[0]
 await c.query("INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,clock_timestamp()+interval '30 days' FROM private.saas_plans WHERE max_clients=10",[professional.id])
 const user=(await c.query("INSERT INTO private.users(username,email,password_hash,role) VALUES($1,$2,$3,'client') RETURNING id",[`qa.ep06.c${suffix}`,`qa.ep06.c${suffix}@example.com`,digest])).rows[0]
 const client=(await c.query("INSERT INTO private.clients(user_id,professional_id,full_name,goal,birth_date,height_cm,base_weight_kg) VALUES($1,$2,'Sofía Entrenamiento QA','Fuerza y movilidad','1990-06-15',170.5,70.2) RETURNING id",[user.id,professional.id])).rows[0]
 const output=resolve(tmpdir(),'cof-ep06-qa.json')
 await writeFile(output,JSON.stringify({API_BASE_URL:'http://127.0.0.1:3000',QA_PROFESSIONAL_USERNAME:`qa.ep06.p${suffix}`,QA_PROFESSIONAL_PASSWORD:password,QA_CLIENT_USERNAME:`qa.ep06.c${suffix}`,QA_CLIENT_PASSWORD:password,QA_CLIENT_FULL_NAME:'Sofía Entrenamiento QA',QA_CLIENT_GOAL:'Fuerza y movilidad',QA_CLIENT_ID:client.id}),{mode:0o600})
 await c.query('COMMIT');console.log('Synthetic EP06 accounts created; private QA configuration saved in the OS temporary directory.')
}catch(error){await c.query('ROLLBACK');throw error}finally{c.release();await pool.end()}

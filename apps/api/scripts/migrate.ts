import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL)
  throw new Error('Configura DATABASE_URL para aplicar migraciones.')
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
})
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('couchonefit_migrations'))",
  )
  await client.query('CREATE SCHEMA IF NOT EXISTS migraciones')
  await client.query('REVOKE ALL ON SCHEMA migraciones FROM PUBLIC')
  await client.query(
    'CREATE TABLE IF NOT EXISTS migraciones.historial (id uuid CONSTRAINT pk_historial PRIMARY KEY DEFAULT gen_random_uuid(), nombre text NOT NULL CONSTRAINT uk_historial_nombre UNIQUE, suma_verificacion text NOT NULL, aplicado_en timestamptz NOT NULL DEFAULT now())',
  )
  const directory = new URL(
    '../../../docs/database/migrations/',
    import.meta.url,
  )
  const names = (await readdir(directory))
    .filter((name) => /^\d{12}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
  const { rows: applied } = await client.query('SELECT nombre FROM migraciones.historial')
  if (applied.some((row) => !names.includes(row.nombre)))
    throw new Error('El historial contiene migraciones ausentes en esta versión; revisar antes de continuar.')
  for (const name of names) {
    const sql = await readFile(new URL(name, directory), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const {
      rows: [previous],
    } = await client.query(
      'SELECT suma_verificacion AS checksum FROM migraciones.historial WHERE nombre=$1',
      [name],
    )
    if (previous) {
      if (previous.checksum !== checksum)
        throw new Error(`Migración aplicada modificada: ${name}`)
      continue
    }
    await client.query(sql)
    await client.query(
      'INSERT INTO migraciones.historial (nombre,suma_verificacion) VALUES ($1,$2)',
      [name, checksum],
    )
    console.log(`Aplicada: ${name}`)
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}

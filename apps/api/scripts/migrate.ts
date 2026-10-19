import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL before applying migrations.')
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
  const hasHistory = async () => {
    const { rows: [history] } = await client.query(
      "SELECT to_regclass('migrations.history') IS NOT NULL AS current, to_regclass('migraciones.historial') IS NOT NULL AS legacy",
    )
    return history.current ? 'current' : history.legacy ? 'legacy' : 'new'
  }
  if (await hasHistory() === 'new') {
    await client.query('CREATE SCHEMA migrations')
    await client.query('REVOKE ALL ON SCHEMA migrations FROM PUBLIC')
    await client.query(
      'CREATE TABLE migrations.history (id uuid CONSTRAINT pk_migration_history PRIMARY KEY DEFAULT gen_random_uuid(), filename text NOT NULL CONSTRAINT uk_migration_history_filename UNIQUE, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    )
  }
  const directory = new URL(
    '../../../docs/database/migrations/',
    import.meta.url,
  )
  const names = (await readdir(directory))
    .filter((name) => /^\d{12}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
  const trackingSchema = async () =>
    (await hasHistory()) === 'legacy'
      ? { table: 'migraciones.historial', filename: 'nombre', checksum: 'suma_verificacion' }
      : { table: 'migrations.history', filename: 'filename', checksum: 'checksum' }
  let tracking = await trackingSchema()
  const { rows: applied } = await client.query(
    `SELECT ${tracking.filename} AS filename FROM ${tracking.table}`,
  )
  if (applied.some((row) => !names.includes(row.filename)))
    throw new Error('Migration history contains files missing from this version.')
  for (const name of names) {
    const sql = await readFile(new URL(name, directory), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const {
      rows: [previous],
    } = await client.query(
      `SELECT ${tracking.checksum} AS checksum FROM ${tracking.table} WHERE ${tracking.filename}=$1`,
      [name],
    )
    if (previous) {
      // Historical checkouts used both CRLF and LF. Preserve their recorded
      // checksums and accept only those newline variants of the same SQL.
      const lf = sql.replaceAll('\r\n', '\n')
      const compatibleChecksums = [sql, lf, lf.replaceAll('\n', '\r\n')]
        .map((source) => createHash('sha256').update(source).digest('hex'))
      if (!compatibleChecksums.includes(previous.checksum))
        throw new Error(`Applied migration was modified: ${name}`)
      continue
    }
    await client.query(sql)
    tracking = await trackingSchema()
    await client.query(
      `INSERT INTO ${tracking.table} (${tracking.filename},${tracking.checksum}) VALUES ($1,$2)`,
      [name, checksum],
    )
    console.log(`Applied: ${name}`)
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}

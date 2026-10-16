import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { Pool } from 'pg'

test('migración inicial repetible y esquema integrado producen la misma base con permisos', async () => {
  const value = process.env.TEST_DATABASE_URL
  if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname))
    throw new Error('Se requiere base local exclusiva de pruebas')
  const owner = new Pool({ connectionString: value })
  const created: string[] = []
  const databases: Pool[] = []
  try {
    const urls = []
    for (const suffix of ['migracion', 'schema']) {
      const name = `CouchOneFit_${suffix}_test_${randomBytes(6).toString('hex')}`
      await owner.query(`CREATE DATABASE "${name}"`)
      created.push(name)
      const target = new URL(value)
      target.pathname = `/${name}`
      urls.push(target.toString())
      databases.push(new Pool({ connectionString: target.toString() }))
    }
    const migrate = () => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: urls[0] },
      encoding: 'utf8',
      stdio: 'pipe',
    })
    assert.match(migrate(), /Aplicada: 202610150001_inicial_identidad_acceso.sql/)
    assert.doesNotMatch(migrate(), /Aplicada:/)
    assert.equal((await databases[0].query('SELECT count(*) FROM migraciones.historial')).rows[0].count, '2')
    await databases[1].query(readFileSync(new URL('../../../docs/database/schemas/identidad_acceso.sql', import.meta.url), 'utf8'))
    const catalog = async (db: Pool) => {
      const queries = [
        "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='privado' ORDER BY table_name,ordinal_position",
        "SELECT c.relname,c.relrowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='privado' AND c.relkind='r' ORDER BY c.relname",
        "SELECT t.relname,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definicion FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='privado' ORDER BY t.relname,c.conname",
        "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='privado' ORDER BY tablename,indexname",
        "SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='privado' ORDER BY tablename,policyname",
        "SELECT nspacl::text FROM pg_namespace WHERE nspname='privado'",
        "SELECT grantor,grantee,table_name,column_name,privilege_type,is_grantable FROM information_schema.column_privileges WHERE table_schema='privado' ORDER BY grantor,grantee,table_name,column_name,privilege_type",
      ]
      return Promise.all(queries.map(async (sql) => (await db.query(sql)).rows))
    }
    const actual = await catalog(databases[0])
    assert.equal(new Set(actual[0].map((r) => r.table_name)).size, 5)
    assert.deepEqual(await catalog(databases[1]), actual)
    await databases[0].query("UPDATE migraciones.historial SET suma_verificacion=repeat('0',64)")
    assert.throws(migrate, /Migración aplicada modificada/)
    await databases[0].query("UPDATE migraciones.historial SET nombre='200001010001_ausente.sql' WHERE nombre='202610150001_inicial_identidad_acceso.sql'")
    assert.throws(migrate, /historial contiene migraciones ausentes/)
    assert.deepEqual(await catalog(databases[0]), actual)
  } finally {
    await Promise.all(databases.map((db) => db.end()))
    for (const name of created) await owner.query(`DROP DATABASE "${name}"`)
    await owner.end()
  }
})

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';

test('migrations and the integrated schema produce the same English database', async () => {
  const value = process.env.TEST_DATABASE_URL;
  if (
    !value ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)
  )
    throw new Error('Se requiere base local exclusiva de pruebas');
  const owner = new Pool({ connectionString: value });
  const created: string[] = [];
  const createdRoles: string[] = [];
  const databases: Pool[] = [];
  try {
    const urls = [];
    for (const suffix of ['migration', 'schema', 'legacy']) {
      const name = `CouchOneFit_${suffix}_test_${randomBytes(6).toString('hex')}`;
      await owner.query(`CREATE DATABASE "${name}"`);
      created.push(name);
      const target = new URL(value);
      target.pathname = `/${name}`;
      urls.push(target.toString());
      databases.push(new Pool({ connectionString: target.toString() }));
    }
    const migrate = (databaseUrl = urls[0]) =>
      execFileSync(
        process.execPath,
        ['--import', 'tsx', 'scripts/migrate.ts'],
        {
          cwd: process.cwd(),
          env: { ...process.env, DATABASE_URL: databaseUrl },
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );
    const applied = migrate();
    assert.match(applied, /Applied: 202610150001_inicial_identidad_acceso.sql/);
    assert.match(applied, /Applied: 202610160001_provision_administrador.sql/);
    assert.match(applied, /Applied: 202610190001_english_identifiers.sql/);
    assert.match(applied, /Applied: 202610190002_client_records.sql/);
    assert.doesNotMatch(migrate(), /Applied:/);
    assert.equal(
      (await databases[0].query('SELECT count(*) FROM migrations.history'))
        .rows[0].count,
      '4'
    );
    await databases[1].query(
      readFileSync(
        new URL(
          '../../../docs/database/schemas/identity_access.sql',
          import.meta.url
        ),
        'utf8'
      )
    );
    await databases[2].query(`CREATE SCHEMA migraciones;
      CREATE TABLE migraciones.historial (
        id uuid CONSTRAINT pk_historial PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre text NOT NULL CONSTRAINT uk_historial_nombre UNIQUE,
        suma_verificacion text NOT NULL,
        aplicado_en timestamptz NOT NULL DEFAULT now()
      )`);
    for (const name of [
      '202610150001_inicial_identidad_acceso.sql',
      '202610160001_provision_administrador.sql',
    ]) {
      const sql = readFileSync(
        new URL(`../../../docs/database/migrations/${name}`, import.meta.url),
        'utf8'
      );
      await databases[2].query(sql);
      await databases[2].query(
        'INSERT INTO migraciones.historial (nombre,suma_verificacion) VALUES ($1,$2)',
        [name, createHash('sha256').update(sql).digest('hex')]
      );
    }
    await databases[2].query('CREATE ROLE migration_runtime LOGIN');
    createdRoles.push('migration_runtime');
    const {
      rows: [professional],
    } = await databases[2].query(
      "INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ('pro.migration','pro.migration@example.com','$argon2id$fixture','profesional') RETURNING id"
    );
    await databases[2].query(
      "INSERT INTO privado.profesionales (usuario_id,nombre_completo,plan_interes) VALUES ($1,'Migration Fixture','basico')",
      [professional.id]
    );
    await databases[2].query(
      "INSERT INTO privado.aceptaciones_avisos (usuario_id,version) VALUES ($1,'fixture')",
      [professional.id]
    );
    const {
      rows: [session],
    } = await databases[2].query(
      'INSERT INTO privado.sesiones (usuario_id) VALUES ($1) RETURNING id',
      [professional.id]
    );
    await databases[2].query(
      'INSERT INTO privado.tokens_renovacion (hash_token,sesion_id) VALUES ($1,$2)',
      ['a'.repeat(64), session.id]
    );
    await databases[2].query(
      "INSERT INTO privado.usuarios (usuario,correo,hash_contrasena,rol) VALUES ('admin.migration','admin.migration@example.com','$argon2id$fixture','administrador')"
    );
    const legacyApplied = migrate(urls[2]);
    await databases[2].query(
      'GRANT couchone_authentication TO migration_runtime'
    );
    assert.match(
      legacyApplied,
      /Applied: 202610190001_english_identifiers.sql/
    );
    assert.match(legacyApplied, /Applied: 202610190002_client_records.sql/);
    assert.equal(
      (await databases[2].query('SELECT count(*) FROM migrations.history'))
        .rows[0].count,
      '4'
    );
    assert.equal(
      (
        await databases[2].query(
          "SELECT to_regclass('migraciones.historial') AS legacy"
        )
      ).rows[0].legacy,
      null
    );
    const {
      rows: [migrated],
    } = await databases[2].query(
      `SELECT u.id,u.password_hash,u.role,u.status,p.user_id,p.user_role,p.full_name,p.plan_interest,
              n.version,s.id AS session_id,t.token_hash
       FROM private.users u JOIN private.professionals p ON p.user_id=u.id
       JOIN private.notice_acceptances n ON n.user_id=u.id
       JOIN private.sessions s ON s.user_id=u.id
       JOIN private.refresh_tokens t ON t.session_id=s.id
       WHERE u.username='pro.migration'`
    );
    assert.equal(migrated.id, professional.id);
    assert.equal(migrated.password_hash, '$argon2id$fixture');
    assert.equal(migrated.role, 'professional');
    assert.equal(migrated.status, 'active');
    assert.equal(migrated.user_id, professional.id);
    assert.equal(migrated.user_role, 'professional');
    assert.equal(migrated.full_name, 'Migration Fixture');
    assert.equal(migrated.plan_interest, 'basic');
    assert.equal(migrated.version, 'fixture');
    assert.equal(migrated.session_id, session.id);
    assert.equal(migrated.token_hash, 'a'.repeat(64));
    assert.equal(
      (
        await databases[2].query(
          "SELECT role FROM private.users WHERE username='admin.migration'"
        )
      ).rows[0].role,
      'admin'
    );
    assert.equal(
      (
        await databases[2].query(
          "SELECT pg_has_role('migration_runtime','couchone_authentication','MEMBER') AS allowed"
        )
      ).rows[0].allowed,
      true
    );
    assert.equal(
      (
        await databases[2].query(
          "SELECT count(*) FROM pg_roles WHERE rolname IN ('couchone_registration','couchone_authentication')"
        )
      ).rows[0].count,
      '2'
    );
    const catalog = async (db: Pool) => {
      const queries = [
        "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='private' ORDER BY table_name,ordinal_position",
        "SELECT c.relname,c.relrowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='r' ORDER BY c.relname",
        "SELECT t.relname,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='private' AND c.contype<>'n' ORDER BY t.relname,c.conname",
        "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='private' ORDER BY tablename,indexname",
        "SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='private' ORDER BY tablename,policyname",
        "SELECT nspacl::text FROM pg_namespace WHERE nspname='private'",
        "SELECT grantor,grantee,table_name,column_name,privilege_type,is_grantable FROM information_schema.column_privileges WHERE table_schema='private' ORDER BY grantor,grantee,table_name,column_name,privilege_type",
      ];
      return Promise.all(
        queries.map(async (sql) => (await db.query(sql)).rows)
      );
    };
    const actual = await catalog(databases[0]);
    assert.equal(new Set(actual[0].map((r) => r.table_name)).size, 6);
    assert.deepEqual(await catalog(databases[1]), actual);
    await databases[0].query(
      "UPDATE migrations.history SET checksum=repeat('0',64) WHERE filename='202610150001_inicial_identidad_acceso.sql'"
    );
    assert.throws(migrate, /Applied migration was modified/);
    await databases[0].query(
      "UPDATE migrations.history SET filename='200001010001_missing.sql' WHERE filename='202610150001_inicial_identidad_acceso.sql'"
    );
    assert.throws(
      migrate,
      /Migration history contains files missing from this version/
    );
    assert.deepEqual(await catalog(databases[0]), actual);
  } finally {
    await Promise.all(databases.map((db) => db.end()));
    for (const name of created) await owner.query(`DROP DATABASE "${name}"`);
    for (const role of createdRoles) await owner.query(`DROP ROLE ${role}`);
    await owner.end();
  }
});

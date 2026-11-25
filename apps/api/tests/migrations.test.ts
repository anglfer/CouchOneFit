import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { Pool } from 'pg';
import { readAsSubject } from '../src/features/auth/repositories/lifecycle.js';
import type { SessionIdentity } from '../src/features/auth/types/session.js';
import { activateVersion, getActivePlanForClient, getVersions, saveDraft, updateDraft } from '../src/features/nutrition/services/nutrition.js';

async function verifyNutritionAccess(owner: Pool, connectionString: string) {
  async function createActor(username: string, role: SessionIdentity['role']): Promise<SessionIdentity> {
    const email = `${username}@example.com`;
    const { rows: [{ id }] } = await owner.query(
      "INSERT INTO private.users(username,email,password_hash,role) VALUES($1,$2,'$argon2id$fixture',$3) RETURNING id",
      [username, email, role],
    );
    return { id, role, username, email, fullName: username, sessionId: randomUUID(), expiresAt: new Date() };
  }

  async function createPortfolio(suffix: string) {
    const professional = await createActor(`nutrition.pro.${suffix}`, 'professional');
    const client = await createActor(`nutrition.client.${suffix}`, 'client');
    const { rows: [{ id: professionalId }] } = await owner.query(
      'INSERT INTO private.professionals(user_id,full_name) VALUES($1,$2) RETURNING id',
      [professional.id, professional.fullName],
    );
    await owner.query(
      "INSERT INTO private.subscriptions(professional_id,plan_id,expires_at) SELECT $1,id,now()+interval '1 day' FROM private.saas_plans WHERE name='Básico 10'",
      [professionalId],
    );
    const { rows: [{ id: clientId }] } = await owner.query(
      'INSERT INTO private.clients(professional_id,user_id,full_name) VALUES($1,$2,$3) RETURNING id',
      [professionalId, client.id, client.fullName],
    );
    // Nutrition requires a prior physical evaluation.
    await owner.query('INSERT INTO private.client_evaluations(client_id,weight_kg) VALUES($1,70)', [clientId]);
    return { professional, client, clientId };
  }

  const runtime = new Pool({ connectionString, options: '-c role=couchone_authentication' });
  try {
    const a = await createPortfolio('a');
    const b = await createPortfolio('b');
    const now = new Date();
    const document = {
      name: 'Plan V1',
      meals: [{ id: randomUUID(), name: 'Desayuno', items: [{ id: randomUUID(), name: 'Avena', quantity: 50, unit: 'g' }] }],
    };
    assert.deepEqual(await getVersions(runtime, a.professional, a.clientId), {
      versions: [], activeVersionId: null, activeRevision: 0, canWrite: true,
    });
    const draft = await saveDraft(runtime, a.professional, a.clientId, undefined, document);
    assert.deepEqual(await getActivePlanForClient(runtime, a.client), { plan: null });
    const update = { ...document, meals: [{ ...document.meals[0], name: 'Desayuno actualizado' }], revision: draft.revision };
    const edited = await updateDraft(runtime, a.professional, a.clientId, draft.planId, draft.id, update);
    assert.equal(edited.meals[0].name, 'Desayuno actualizado');
    await activateVersion(runtime, a.professional, a.clientId, draft.planId, draft.id, { expectedActiveRevision: 0 }, now);
    assert.equal((await getActivePlanForClient(runtime, a.client)).plan?.id, draft.id);
    const next = await saveDraft(runtime, a.professional, a.clientId, draft.planId, { ...document, name: 'Plan V2' });
    assert.equal((await getActivePlanForClient(runtime, a.client)).plan?.id, draft.id);
    await activateVersion(runtime, a.professional, a.clientId, next.planId, next.id, { expectedActiveRevision: 1 }, now);
    assert.equal((await getActivePlanForClient(runtime, a.client)).plan?.id, next.id);
    assert.deepEqual((await getVersions(runtime, a.professional, a.clientId)).versions.map((version) => version.id).sort(), [draft.id, next.id].sort());
    assert.deepEqual((await owner.query('SELECT version_id FROM private.nutrition_activations WHERE client_id=$1 ORDER BY revision', [a.clientId])).rows, [{ version_id: draft.id }, { version_id: next.id }]);

    await assert.rejects(getVersions(runtime, b.professional, a.clientId), { code: 'NUTRITION_NOT_FOUND' });
    assert.deepEqual(await getActivePlanForClient(runtime, b.client), { plan: null });
    const visibleVersions = (subject: string) => readAsSubject(runtime, subject, (db) => db.query('SELECT id FROM private.nutrition_versions'));
    assert.deepEqual((await visibleVersions(a.client.id)).rows, [{ id: next.id }]);
    assert.deepEqual((await visibleVersions(b.professional.id)).rows, []);
    for (const actor of [a.client, b.professional]) {
      await assert.rejects(readAsSubject(runtime, actor.id, (db) => db.query(
        'INSERT INTO private.nutrition_versions(id,plan_id,number,document) VALUES($1,$2,3,$3)',
        [randomUUID(), draft.planId, JSON.stringify(document)],
      )), { code: '42501' });
    }
    assert.equal((await readAsSubject(runtime, a.professional.id, (db) => db.query(
      'UPDATE private.nutrition_versions SET document=$1 WHERE id=$2', [{}, draft.id],
    ))).rowCount, 0);
  } finally {
    await runtime.end();
  }
}

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
  const runtimeRole = `cof_migration_${randomBytes(6).toString('hex')}`;
  const databases: Pool[] = [];
  try {
    assert.equal((await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [runtimeRole])).rowCount, 0);
    const urls = [];
    for (const suffix of ['migration', 'schema', 'legacy', 'evaluation_upgrade', 'observability_upgrade']) {
      const name = `CouchOneFit_${suffix}_test_${randomBytes(6).toString('hex')}`;
      assert.equal((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount, 0);
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
    await verifyNutritionAccess(databases[0], urls[0]);
    assert.match(applied, /Applied: 202610150001_inicial_identidad_acceso.sql/);
    assert.match(applied, /Applied: 202610160001_provision_administrador.sql/);
    assert.match(applied, /Applied: 202610190001_english_identifiers.sql/);
    assert.match(applied, /Applied: 202610190002_client_records.sql/);
    assert.match(applied, /Applied: 202610190003_account_lifecycle.sql/);
    assert.match(applied, /Applied: 202610270001_client_initial_record.sql/);
    assert.match(applied, /Applied: 202610280001_client_read_isolation.sql/);
    assert.match(applied, /Applied: 202610280002_invitation_professional_lock.sql/);
    assert.match(applied, /Applied: 202610280003_client_portfolio_order.sql/);
    assert.match(applied, /Applied: 202610280004_client_record_version.sql/);
    assert.match(applied, /Applied: 202610290001_client_record_status_audit.sql/);
    assert.match(applied, /Applied: 202611030001_idempotency_keys.sql/);
    assert.match(applied, /Applied: 202611080001_client_evaluations.sql/);
    assert.match(applied, /Applied: 202611090001_multimethod_evaluations.sql/);
    assert.match(applied, /Applied: 202611100001_evaluation_measurement_integrity.sql/);
    assert.match(applied, /Applied: 202611130001_evaluation_estimation_snapshots.sql/);
    assert.match(applied, /Applied: 202611170001_nutrition_plans.sql/);
    assert.match(applied, /Applied: 202611190001_nutrition_runtime_access.sql/);
    assert.match(applied, /Applied: 202611210001_professional_foods.sql/);
    assert.match(applied, /Applied: 202611240001_client_maximum_age.sql/);
    assert.match(applied, /Applied: 202611250001_observability_sla.sql/);
    assert.match(applied, /Applied: 202611250002_observability_measurement_windows.sql/);
    assert.doesNotMatch(migrate(), /Applied:/);
    // Git can check out the same immutable SQL with Windows or Unix newlines.
    for (const { filename } of (
      await databases[0].query('SELECT filename FROM migrations.history')
    ).rows) {
      const sql = readFileSync(
        new URL(`../../../docs/database/migrations/${filename}`, import.meta.url),
        'utf8'
      );
      const opposite = sql.includes('\r\n')
        ? sql.replaceAll('\r\n', '\n')
        : sql.replaceAll('\n', '\r\n');
      await databases[0].query(
        'UPDATE migrations.history SET checksum=$1 WHERE filename=$2',
        [createHash('sha256').update(opposite).digest('hex'), filename]
      );
    }
    assert.doesNotMatch(migrate(), /Applied:/);
    assert.equal(
      (await databases[0].query('SELECT count(*) FROM migrations.history'))
        .rows[0].count,
      '37'
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
    await databases[2].query(`CREATE ROLE ${runtimeRole} LOGIN`);
    createdRoles.push(runtimeRole);
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
    const applyHistoricalMigration = async (name: string) => {
      const sql = readFileSync(
        new URL(`../../../docs/database/migrations/${name}`, import.meta.url),
        'utf8'
      )
      await databases[2].query(sql)
      const {
        rows: [history],
      } = await databases[2].query(
        "SELECT to_regclass('migrations.history') IS NOT NULL AS current"
      )
      await databases[2].query(
        history.current
          ? 'INSERT INTO migrations.history (filename,checksum) VALUES ($1,$2)'
          : 'INSERT INTO migraciones.historial (nombre,suma_verificacion) VALUES ($1,$2)',
        [name, createHash('sha256').update(sql).digest('hex')]
      )
    }
    for (const name of [
      '202610190001_english_identifiers.sql',
      '202610190002_client_records.sql',
      '202610190003_account_lifecycle.sql',
      '202610231730_create_saas_plans.sql',
      '202610231745_saas_relations_history.sql',
      '202610260001_saas_integrity.sql',
      '202610260002_simulated_checkout.sql',
      '202610260003_live_plan_catalog.sql',
    ])
      await applyHistoricalMigration(name)
    const {
      rows: [legacyClient],
    } = await databases[2].query(
      `INSERT INTO private.clients(professional_id,full_name,goal)
       SELECT id,'Legacy client','Conservar objetivo' FROM private.professionals
       WHERE user_id=$1 RETURNING id`,
      [professional.id]
    )
    await databases[2].query("INSERT INTO private.invitations(client_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", [legacyClient.id, 'b'.repeat(64)]);
    await databases[2].query("INSERT INTO private.access_events(actor_id,client_id,action) VALUES($1,$2,'invitation_issued')", [professional.id, legacyClient.id]);
    const priorRelated = {
      invitations: (await databases[2].query('SELECT * FROM private.invitations WHERE client_id=$1', [legacyClient.id])).rows,
      events: (await databases[2].query('SELECT * FROM private.access_events WHERE client_id=$1', [legacyClient.id])).rows,
    };
    const legacyApplied = migrate(urls[2]);
    assert.deepEqual((await databases[2].query('SELECT * FROM private.invitations WHERE client_id=$1', [legacyClient.id])).rows, priorRelated.invitations);
    assert.deepEqual((await databases[2].query('SELECT * FROM private.access_events WHERE client_id=$1', [legacyClient.id])).rows, priorRelated.events);
    await databases[2].query(
      `GRANT couchone_authentication TO ${runtimeRole}`
    );
    assert.match(legacyApplied, /Applied: 202610270001_client_initial_record.sql/);
    assert.match(legacyApplied, /Applied: 202610280001_client_read_isolation.sql/);
    assert.match(legacyApplied, /Applied: 202610280002_invitation_professional_lock.sql/);
    assert.match(legacyApplied, /Applied: 202610280003_client_portfolio_order.sql/);
      assert.match(legacyApplied, /Applied: 202610280004_client_record_version.sql/);
      assert.match(legacyApplied, /Applied: 202610290001_client_record_status_audit.sql/);
    assert.equal(
      (await databases[2].query('SELECT count(*) FROM migrations.history'))
        .rows[0].count,
      '37'
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
    const {
      rows: [preservedClient],
    } = await databases[2].query(
      `SELECT full_name,goal,birth_date,height_cm,base_weight_kg,
              base_body_fat_percentage,waist_cm,hip_cm,version
       FROM private.clients WHERE id=$1`,
      [legacyClient.id]
    );
    assert.deepEqual(preservedClient, {
      full_name: 'Legacy client',
      goal: 'Conservar objetivo',
      birth_date: null,
      height_cm: null,
      base_weight_kg: null,
      base_body_fat_percentage: null,
      waist_cm: null,
      hip_cm: null,
      version: 1,
    });
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
          "SELECT pg_has_role($1,'couchone_authentication','MEMBER') AS allowed", [runtimeRole]
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
        "SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
        "SELECT c.relname,c.relrowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND c.relkind='r' ORDER BY c.relname",
        "SELECT t.relname,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='private' AND c.contype<>'n' ORDER BY t.relname,c.conname",
        "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='private' ORDER BY tablename,indexname",
        "SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='private' ORDER BY tablename,policyname",
        "SELECT CASE WHEN nspacl IS NULL THEN NULL ELSE ARRAY(SELECT acl::text FROM unnest(nspacl) AS acl ORDER BY acl::text) END AS nspacl FROM pg_namespace WHERE nspname='private'",
        "SELECT grantor,grantee,table_name,column_name,privilege_type,is_grantable FROM information_schema.column_privileges WHERE table_schema='private' ORDER BY grantor,grantee,table_name,column_name,privilege_type",
        "SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.proconfig,p.proacl::text,replace(p.prosrc,chr(13)||chr(10),chr(10)) AS prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname IN ('invited_client_record','link_invited_client','admin_client_counts','lock_expired_invitation_client','version_client_record','nutrition_professional','nutrition_client_access','nutrition_can_write','observability_ingest_snapshot','observability_access_event_logs','observability_needs_hourly_evaluation','record_observability_slo_evaluation','prune_observability_data') ORDER BY p.proname, arguments",
      ];
      return Promise.all(
        queries.map(async (sql) => (await db.query(sql)).rows)
      );
    };
    // Upgrade from the previous integrated schema with a real historical evaluation.
    const previousSchema=readFileSync(new URL('../../../docs/database/schemas/identity_access.sql',import.meta.url),'utf8').split('-- HU-021 scope extension.')[0];
    await databases[3].query(previousSchema);
    await databases[3].query('CREATE SCHEMA migrations; CREATE TABLE migrations.history(filename text PRIMARY KEY,checksum text NOT NULL)');
    const migrationDirectory=new URL('../../../docs/database/migrations/',import.meta.url);
    const observabilityFile = '202611250002_observability_measurement_windows.sql';
    const priorObservabilitySchema = readFileSync(new URL('../../../docs/database/schemas/identity_access.sql',import.meta.url),'utf8')
      .split('-- Bound sampling and read the configuration version in force at the observation.')[0];
    await databases[4].query(priorObservabilitySchema);
    await databases[4].query('CREATE SCHEMA migrations; CREATE TABLE migrations.history(filename text PRIMARY KEY,checksum text NOT NULL)');
    for (const filename of readdirSync(migrationDirectory).filter((name)=>/^\d{12}_.*\.sql$/.test(name) && name < observabilityFile)) {
      const checksum = createHash('sha256').update(readFileSync(new URL(filename,migrationDirectory),'utf8')).digest('hex');
      await databases[4].query('INSERT INTO migrations.history(filename,checksum) VALUES($1,$2)', [filename, checksum]);
    }
    const { rows: [priorObservabilityEvaluation] } = await databases[4].query(
      `INSERT INTO private.observability_slo_evaluations (
        slo_id, slo_version, environment, period_start, period_end, target_value, observed_value, samples, compliance_status
      )
      SELECT id, 1, 'test', clock_timestamp() - interval '1 hour', clock_timestamp(), target_value, 100, 1, 'met'
      FROM private.observability_slo_definitions WHERE code = 'slo_availability'
      RETURNING *`
    );
    assert.match(migrate(urls[4]), new RegExp(`Applied: ${observabilityFile}`));
    const { rows: [preservedObservabilityEvaluation] } = await databases[4].query(
      'SELECT * FROM private.observability_slo_evaluations WHERE id=$1', [priorObservabilityEvaluation.id]
    );
    assert.deepEqual(preservedObservabilityEvaluation, { ...priorObservabilityEvaluation, automatic: false });
    for(const filename of readdirSync(migrationDirectory).filter(n=>/^\d{12}_.*\.sql$/.test(n)&&n<'202611090001_multimethod_evaluations.sql').sort()) {
      await databases[3].query('INSERT INTO migrations.history(filename,checksum) VALUES($1,$2)',[filename,createHash('sha256').update(readFileSync(new URL(filename,migrationDirectory),'utf8')).digest('hex')]);
    }
    const upgradeUser=(await databases[3].query("INSERT INTO private.users(username,email,password_hash,role) VALUES('upgrade.eval','upgrade.eval@example.com','$argon2id$fixture','professional') RETURNING id")).rows[0].id;
    const upgradeProfessional=(await databases[3].query("INSERT INTO private.professionals(user_id,full_name) VALUES($1,'Upgrade evaluation') RETURNING id",[upgradeUser])).rows[0].id;
    const upgradeClient=(await databases[3].query("INSERT INTO private.clients(professional_id,full_name) VALUES($1,'Legacy evaluation client') RETURNING id",[upgradeProfessional])).rows[0].id;
    const previousEvaluation=(await databases[3].query('INSERT INTO private.client_evaluations(client_id,weight_kg) VALUES($1,70.2) RETURNING *',[upgradeClient])).rows[0];
    const nutritionFile = '202611170001_nutrition_plans.sql';
    const nutritionSql = readFileSync(new URL(nutritionFile, migrationDirectory), 'utf8');
    await databases[3].query(nutritionSql);
    await databases[3].query('INSERT INTO migrations.history(filename,checksum) VALUES($1,$2)', [nutritionFile, createHash('sha256').update(nutritionSql).digest('hex')]);
    const planId = randomUUID();
    const versionId = randomUUID();
    const existingPlan = { name: 'Plan histórico', meals: [] };
    await databases[3].query('INSERT INTO private.nutrition_plans(id,owner_id,client_id) VALUES($1,$2,$3)', [planId, upgradeUser, upgradeClient]);
    await databases[3].query('INSERT INTO private.nutrition_versions(id,plan_id,number,published,document) VALUES($1,$2,1,true,$3)', [versionId, planId, existingPlan]);
    await databases[3].query('INSERT INTO private.nutrition_active(client_id,plan_id,version_id,revision) VALUES($1,$2,$3,1)', [upgradeClient, planId, versionId]);
    await databases[3].query("INSERT INTO private.nutrition_activations(client_id,plan_id,version_id,local_date,time_zone,revision) VALUES($1,$2,$3,CURRENT_DATE,'America/Mexico_City',1)", [upgradeClient, planId, versionId]);
    const upgraded = migrate(urls[3]);
    assert.match(upgraded,/Applied: 202611090001_multimethod_evaluations.sql/);
    assert.match(upgraded,/Applied: 202611190001_nutrition_runtime_access.sql/);
    assert.deepEqual((await databases[3].query(
      `SELECT v.document, a.version_id, h.revision FROM private.nutrition_active a
      JOIN private.nutrition_versions v ON v.id=a.version_id
      JOIN private.nutrition_activations h ON h.client_id=a.client_id AND h.version_id=v.id
      WHERE a.client_id=$1`, [upgradeClient],
    )).rows, [{ document: existingPlan, version_id: versionId, revision: 1 }]);
    const preserved=(await databases[3].query('SELECT * FROM private.client_evaluations WHERE id=$1',[previousEvaluation.id])).rows[0];
    const {assessment,...originalColumns}=preserved;
    assert.equal(assessment,null);
    assert.deepEqual(originalColumns,previousEvaluation);
    const actual = await catalog(databases[0]);
    assert.equal(new Set(actual[0].map((r) => r.table_name)).size, 52);
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


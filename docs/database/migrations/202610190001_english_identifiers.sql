-- English identifiers and values. Run with the migration runner during maintenance.
-- Applied migrations remain immutable; identifiers, hashes and timestamps are preserved.
DO $roles$
DECLARE
  has_legacy_registration boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname='couchone_registro');
  has_legacy_authentication boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname='couchone_autenticacion');
  has_registration boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname='couchone_registration');
  has_authentication boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname='couchone_authentication');
BEGIN
  IF has_legacy_registration AND NOT has_registration THEN
    ALTER ROLE couchone_registro RENAME TO couchone_registration;
    has_legacy_registration := false;
    has_registration := true;
  END IF;
  IF has_legacy_authentication AND NOT has_authentication THEN
    ALTER ROLE couchone_autenticacion RENAME TO couchone_authentication;
    has_legacy_authentication := false;
    has_authentication := true;
  END IF;
  IF NOT has_registration OR NOT has_authentication
     OR has_legacy_registration <> has_legacy_authentication THEN
    RAISE EXCEPTION 'Expected both English application roles and matching legacy roles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (
       'couchone_registro','couchone_autenticacion','couchone_registration','couchone_authentication')
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'CouchOneFit application roles have incompatible privileges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles parent ON parent.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE member.rolname IN ('couchone_registration','couchone_authentication')
      AND NOT (member.rolname='couchone_authentication' AND parent.rolname='couchone_registration')
  ) THEN
    RAISE EXCEPTION 'CouchOneFit English application roles have unexpected memberships';
  END IF;
END $roles$;
DO $migration_history$
BEGIN
  IF to_regclass('migraciones.historial') IS NOT NULL THEN
    IF to_regclass('migrations.history') IS NOT NULL OR to_regnamespace('migrations') IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot rename migration history because the English target already exists';
    END IF;
    ALTER SCHEMA migraciones RENAME TO migrations;
    ALTER TABLE migrations.historial RENAME TO history;
    ALTER TABLE migrations.history RENAME COLUMN nombre TO filename;
    ALTER TABLE migrations.history RENAME COLUMN suma_verificacion TO checksum;
    ALTER TABLE migrations.history RENAME COLUMN aplicado_en TO applied_at;
    ALTER TABLE migrations.history RENAME CONSTRAINT pk_historial TO pk_migration_history;
    ALTER TABLE migrations.history RENAME CONSTRAINT uk_historial_nombre TO uk_migration_history_filename;
  END IF;
END $migration_history$;
ALTER SCHEMA privado RENAME TO private;
ALTER TABLE private.usuarios RENAME TO users;
ALTER TABLE private.users RENAME COLUMN usuario TO username;
ALTER TABLE private.users RENAME COLUMN correo TO email;
ALTER TABLE private.users RENAME COLUMN hash_contrasena TO password_hash;
ALTER TABLE private.users RENAME COLUMN rol TO role;
ALTER TABLE private.users RENAME COLUMN estado TO status;
ALTER TABLE private.users RENAME COLUMN creado_en TO created_at;
ALTER TABLE private.profesionales RENAME TO professionals;
ALTER TABLE private.professionals RENAME COLUMN usuario_id TO user_id;
ALTER TABLE private.professionals RENAME COLUMN rol_usuario TO user_role;
ALTER TABLE private.professionals RENAME COLUMN nombre_completo TO full_name;
ALTER TABLE private.professionals RENAME COLUMN telefono TO phone;
ALTER TABLE private.professionals RENAME COLUMN plan_interes TO plan_interest;
ALTER TABLE private.aceptaciones_avisos RENAME TO notice_acceptances;
ALTER TABLE private.notice_acceptances RENAME COLUMN usuario_id TO user_id;
ALTER TABLE private.notice_acceptances RENAME COLUMN aceptado_en TO accepted_at;
ALTER TABLE private.sesiones RENAME TO sessions;
ALTER TABLE private.sessions RENAME COLUMN usuario_id TO user_id;
ALTER TABLE private.sessions RENAME COLUMN creado_en TO created_at;
ALTER TABLE private.sessions RENAME COLUMN expira_en TO expires_at;
ALTER TABLE private.sessions RENAME COLUMN revocado_en TO revoked_at;
ALTER TABLE private.tokens_renovacion RENAME TO refresh_tokens;
ALTER TABLE private.refresh_tokens RENAME COLUMN hash_token TO token_hash;
ALTER TABLE private.refresh_tokens RENAME COLUMN sesion_id TO session_id;
ALTER TABLE private.refresh_tokens RENAME COLUMN creado_en TO created_at;
ALTER TABLE private.refresh_tokens RENAME COLUMN usado_en TO used_at;
ALTER TABLE private.users RENAME CONSTRAINT pk_usuarios TO pk_users;
ALTER TABLE private.users RENAME CONSTRAINT ck_usuarios_usuario TO ck_users_username;
ALTER TABLE private.users RENAME CONSTRAINT ck_usuarios_correo TO ck_users_email;
ALTER TABLE private.users RENAME CONSTRAINT ck_usuarios_hash_contrasena TO ck_users_password_hash;
ALTER TABLE private.users DROP CONSTRAINT ck_usuarios_rol;
ALTER TABLE private.users DROP CONSTRAINT ck_usuarios_estado;
ALTER TABLE private.users RENAME CONSTRAINT uk_usuarios_id_rol TO uk_users_id_role;
ALTER TABLE private.professionals RENAME CONSTRAINT pk_profesionales TO pk_professionals;
ALTER TABLE private.professionals RENAME CONSTRAINT uk_profesionales_usuario_id TO uk_professionals_user_id;
ALTER TABLE private.professionals DROP CONSTRAINT ck_profesionales_rol_usuario;
ALTER TABLE private.professionals RENAME CONSTRAINT ck_profesionales_nombre_completo TO ck_professionals_full_name;
ALTER TABLE private.professionals RENAME CONSTRAINT ck_profesionales_telefono TO ck_professionals_phone;
ALTER TABLE private.professionals DROP CONSTRAINT ck_profesionales_plan_interes;
ALTER TABLE private.professionals DROP CONSTRAINT fk_profesionales_usuario_rol;
ALTER TABLE private.notice_acceptances RENAME CONSTRAINT pk_aceptaciones_avisos TO pk_notice_acceptances;
ALTER TABLE private.notice_acceptances RENAME CONSTRAINT fk_aceptaciones_avisos_usuario TO fk_notice_acceptances_user;
ALTER TABLE private.notice_acceptances RENAME CONSTRAINT uk_aceptaciones_avisos_usuario_version TO uk_notice_acceptances_user_version;
ALTER TABLE private.sessions RENAME CONSTRAINT pk_sesiones TO pk_sessions;
ALTER TABLE private.sessions RENAME CONSTRAINT fk_sesiones_usuario TO fk_sessions_user;
ALTER TABLE private.sessions RENAME CONSTRAINT ck_sesiones_vigencia TO ck_sessions_lifetime;
ALTER TABLE private.refresh_tokens RENAME CONSTRAINT pk_tokens_renovacion TO pk_refresh_tokens;
ALTER TABLE private.refresh_tokens RENAME CONSTRAINT uk_tokens_renovacion_hash_token TO uk_refresh_tokens_token_hash;
ALTER TABLE private.refresh_tokens RENAME CONSTRAINT ck_tokens_renovacion_hash_token TO ck_refresh_tokens_token_hash;
ALTER TABLE private.refresh_tokens RENAME CONSTRAINT fk_tokens_renovacion_sesion TO fk_refresh_tokens_session;
UPDATE private.users SET role=CASE role WHEN 'profesional' THEN 'professional' WHEN 'administrador' THEN 'admin' WHEN 'cliente' THEN 'client' ELSE role END, status=CASE status WHEN 'activo' THEN 'active' WHEN 'inactivo' THEN 'inactive' ELSE status END;
UPDATE private.professionals SET user_role='professional', plan_interest=CASE plan_interest WHEN 'basico' THEN 'basic' ELSE plan_interest END;
ALTER TABLE private.users ALTER COLUMN status SET DEFAULT 'active', ADD CONSTRAINT ck_users_role CHECK (role IN ('professional','client','admin')), ADD CONSTRAINT ck_users_status CHECK (status IN ('active','inactive'));
ALTER TABLE private.professionals ALTER COLUMN user_role SET DEFAULT 'professional', ADD CONSTRAINT ck_professionals_user_role CHECK (user_role='professional'), ADD CONSTRAINT ck_professionals_plan_interest CHECK (plan_interest IN ('basic','pro','elite')), ADD CONSTRAINT fk_professionals_user_role FOREIGN KEY (user_id,user_role) REFERENCES private.users(id,role) ON DELETE RESTRICT;
ALTER INDEX private.uk_usuarios_usuario_normalizado RENAME TO uk_users_username_normalized;
ALTER INDEX private.uk_usuarios_correo_normalizado RENAME TO uk_users_email_normalized;
ALTER INDEX private.idx_sesiones_usuario_id RENAME TO idx_sessions_user_id;
ALTER INDEX private.idx_tokens_renovacion_sesion_id RENAME TO idx_refresh_tokens_session_id;
GRANT couchone_registration TO couchone_authentication;
GRANT USAGE ON SCHEMA private TO couchone_registration,couchone_authentication;
GRANT INSERT,SELECT ON private.users,private.professionals,private.notice_acceptances TO couchone_registration;
GRANT SELECT ON private.users TO couchone_authentication;
GRANT SELECT,INSERT,UPDATE ON private.sessions,private.refresh_tokens TO couchone_authentication;
DO $memberships$
DECLARE membership record;
BEGIN
  FOR membership IN
    SELECT parent.rolname AS source, member.rolname AS member,
           m.admin_option, m.inherit_option, m.set_option
    FROM pg_auth_members m
    JOIN pg_roles parent ON parent.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE parent.rolname IN ('couchone_registro','couchone_autenticacion')
      AND member.rolname <> 'couchone_autenticacion'
  LOOP
    EXECUTE format('GRANT %I TO %I WITH ADMIN %s, INHERIT %s, SET %s',
      CASE membership.source WHEN 'couchone_registro' THEN 'couchone_registration' ELSE 'couchone_authentication' END,
      membership.member, membership.admin_option, membership.inherit_option, membership.set_option);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='couchone_registro') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA private FROM couchone_registro,couchone_autenticacion;
    REVOKE ALL ON SCHEMA private FROM couchone_registro,couchone_autenticacion;
  END IF;
END $memberships$;
ALTER POLICY insertar_usuarios_profesionales ON private.users RENAME TO insert_professional_users;
ALTER POLICY insert_professional_users ON private.users TO couchone_registration WITH CHECK (role='professional' AND status='active');
ALTER POLICY consultar_usuarios_profesionales ON private.users RENAME TO select_professional_users;
ALTER POLICY select_professional_users ON private.users TO couchone_registration USING (role='professional');
ALTER POLICY consultar_usuarios_acceso ON private.users RENAME TO select_login_users;
ALTER POLICY select_login_users ON private.users TO couchone_authentication USING(true);
ALTER POLICY insertar_profesionales ON private.professionals RENAME TO insert_professionals;
ALTER POLICY insert_professionals ON private.professionals TO couchone_registration WITH CHECK(true);
ALTER POLICY consultar_profesionales ON private.professionals RENAME TO select_professionals;
ALTER POLICY select_professionals ON private.professionals TO couchone_registration USING(true);
ALTER POLICY insertar_aceptaciones_avisos ON private.notice_acceptances RENAME TO insert_notice_acceptances;
ALTER POLICY insert_notice_acceptances ON private.notice_acceptances TO couchone_registration WITH CHECK(true);
ALTER POLICY consultar_aceptaciones_avisos ON private.notice_acceptances RENAME TO select_notice_acceptances;
ALTER POLICY select_notice_acceptances ON private.notice_acceptances TO couchone_registration USING(true);
ALTER POLICY gestionar_sesiones ON private.sessions RENAME TO manage_sessions;
ALTER POLICY manage_sessions ON private.sessions TO couchone_authentication USING(true) WITH CHECK(true);
ALTER POLICY gestionar_tokens_renovacion ON private.refresh_tokens RENAME TO manage_refresh_tokens;
ALTER POLICY manage_refresh_tokens ON private.refresh_tokens TO couchone_authentication USING(true) WITH CHECK(true);
ALTER POLICY insertar_administradores_controlados ON private.users RENAME TO insert_controlled_admins;
ALTER POLICY insert_controlled_admins ON private.users TO couchone_provision WITH CHECK (role='admin' AND status='active');
ALTER POLICY consultar_administradores_controlados ON private.users RENAME TO select_controlled_admins;
ALTER POLICY select_controlled_admins ON private.users TO couchone_provision USING (role='admin');

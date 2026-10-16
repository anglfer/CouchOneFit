-- CouchOneFit: estructura completa de identidad y acceso (HU-001, HU-002 y HU-003).
-- Auth propia en API; no usa ni modifica auth.users de Supabase.
-- Los roles pertenecen al clúster y pueden compartirse entre dev y test.
DO $roles$
BEGIN
  BEGIN
    CREATE ROLE couchone_registro NOLOGIN;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  BEGIN
    CREATE ROLE couchone_autenticacion NOLOGIN;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('couchone_registro','couchone_autenticacion')
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
  OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles padre ON padre.oid=m.roleid
    JOIN pg_roles miembro ON miembro.oid=m.member
    WHERE miembro.rolname IN ('couchone_registro','couchone_autenticacion')
    AND NOT (miembro.rolname='couchone_autenticacion' AND padre.rolname='couchone_registro')) THEN
    RAISE EXCEPTION 'Los roles de CouchOneFit tienen privilegios incompatibles; revisar antes de migrar';
  END IF;
END $roles$;
GRANT couchone_registro TO couchone_autenticacion;
CREATE SCHEMA privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;

CREATE TABLE privado.usuarios (
  id uuid CONSTRAINT pk_usuarios PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario text NOT NULL CONSTRAINT ck_usuarios_usuario CHECK (usuario ~ '^[a-z0-9._]{3,30}$'),
  correo text NOT NULL CONSTRAINT ck_usuarios_correo CHECK (correo = lower(btrim(correo)) AND length(correo) <= 254 AND correo ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  hash_contrasena text NOT NULL CONSTRAINT ck_usuarios_hash_contrasena CHECK (hash_contrasena LIKE '$argon2id$%'),
  rol text NOT NULL CONSTRAINT ck_usuarios_rol CHECK (rol IN ('profesional', 'cliente', 'administrador')),
  estado text NOT NULL DEFAULT 'activo' CONSTRAINT ck_usuarios_estado CHECK (estado IN ('activo', 'inactivo')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_usuarios_id_rol UNIQUE (id, rol)
);
CREATE UNIQUE INDEX uk_usuarios_usuario_normalizado ON privado.usuarios (lower(btrim(usuario)));
CREATE UNIQUE INDEX uk_usuarios_correo_normalizado ON privado.usuarios (lower(btrim(correo)));
CREATE TABLE privado.profesionales (
  id uuid CONSTRAINT pk_profesionales PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL CONSTRAINT uk_profesionales_usuario_id UNIQUE,
  rol_usuario text NOT NULL DEFAULT 'profesional' CONSTRAINT ck_profesionales_rol_usuario CHECK (rol_usuario = 'profesional'),
  nombre_completo text NOT NULL CONSTRAINT ck_profesionales_nombre_completo CHECK (char_length(btrim(nombre_completo)) BETWEEN 3 AND 120),
  telefono text CONSTRAINT ck_profesionales_telefono CHECK (telefono ~ '^[0-9]{10,15}$'),
  -- Es solo interes en un plan; no concede suscripcion ni capacidad.
  plan_interes text CONSTRAINT ck_profesionales_plan_interes CHECK (plan_interes IN ('basico', 'pro', 'elite')),
  CONSTRAINT fk_profesionales_usuario_rol FOREIGN KEY (usuario_id, rol_usuario) REFERENCES privado.usuarios (id, rol) ON DELETE RESTRICT
);
CREATE TABLE privado.aceptaciones_avisos (
  id uuid CONSTRAINT pk_aceptaciones_avisos PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL CONSTRAINT fk_aceptaciones_avisos_usuario REFERENCES privado.usuarios (id) ON DELETE RESTRICT,
  version text NOT NULL,
  aceptado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_aceptaciones_avisos_usuario_version UNIQUE (usuario_id, version)
);
CREATE TABLE privado.sesiones (
  id uuid CONSTRAINT pk_sesiones PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL CONSTRAINT fk_sesiones_usuario REFERENCES privado.usuarios(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now(),
  expira_en timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revocado_en timestamptz,
  CONSTRAINT ck_sesiones_vigencia CHECK (expira_en > creado_en)
);
CREATE INDEX idx_sesiones_usuario_id ON privado.sesiones(usuario_id);
CREATE TABLE privado.tokens_renovacion (
  id uuid CONSTRAINT pk_tokens_renovacion PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_token text NOT NULL CONSTRAINT uk_tokens_renovacion_hash_token UNIQUE CONSTRAINT ck_tokens_renovacion_hash_token CHECK (hash_token ~ '^[a-f0-9]{64}$'),
  sesion_id uuid NOT NULL CONSTRAINT fk_tokens_renovacion_sesion REFERENCES privado.sesiones(id) ON DELETE RESTRICT,
  creado_en timestamptz NOT NULL DEFAULT now(),
  usado_en timestamptz
);
CREATE INDEX idx_tokens_renovacion_sesion_id ON privado.tokens_renovacion(sesion_id);
REVOKE ALL ON ALL TABLES IN SCHEMA privado FROM PUBLIC;
ALTER TABLE privado.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.aceptaciones_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE privado.tokens_renovacion ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA privado TO couchone_registro,couchone_autenticacion;
GRANT INSERT,SELECT ON privado.usuarios,privado.profesionales,privado.aceptaciones_avisos TO couchone_registro;
GRANT SELECT ON privado.usuarios TO couchone_autenticacion;
GRANT SELECT,INSERT,UPDATE ON privado.sesiones,privado.tokens_renovacion TO couchone_autenticacion;
CREATE POLICY insertar_usuarios_profesionales ON privado.usuarios FOR INSERT TO couchone_registro WITH CHECK (rol='profesional' AND estado='activo');
CREATE POLICY consultar_usuarios_profesionales ON privado.usuarios FOR SELECT TO couchone_registro USING (rol='profesional');
CREATE POLICY consultar_usuarios_acceso ON privado.usuarios FOR SELECT TO couchone_autenticacion USING(true);
CREATE POLICY insertar_profesionales ON privado.profesionales FOR INSERT TO couchone_registro WITH CHECK(true);
CREATE POLICY consultar_profesionales ON privado.profesionales FOR SELECT TO couchone_registro USING(true);
CREATE POLICY insertar_aceptaciones_avisos ON privado.aceptaciones_avisos FOR INSERT TO couchone_registro WITH CHECK(true);
CREATE POLICY consultar_aceptaciones_avisos ON privado.aceptaciones_avisos FOR SELECT TO couchone_registro USING(true);
CREATE POLICY gestionar_sesiones ON privado.sesiones FOR ALL TO couchone_autenticacion USING(true) WITH CHECK(true);
CREATE POLICY gestionar_tokens_renovacion ON privado.tokens_renovacion FOR ALL TO couchone_autenticacion USING(true) WITH CHECK(true);


-- HU-003: provisión exclusiva de operadores; nunca conceder este rol al runtime.
DO $roles$
BEGIN
  BEGIN
    CREATE ROLE couchone_provision NOLOGIN;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='couchone_provision'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
  OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
    WHERE r.rolname='couchone_provision')
  OR pg_has_role('couchone_autenticacion','couchone_provision','MEMBER')
  OR pg_has_role('couchone_registro','couchone_provision','MEMBER') THEN
    RAISE EXCEPTION 'El rol de provisión tiene privilegios o membresías incompatibles';
  END IF;
END $roles$;
GRANT USAGE ON SCHEMA privado TO couchone_provision;
GRANT SELECT (id,usuario,correo,rol,estado), INSERT (usuario,correo,hash_contrasena,rol)
  ON privado.usuarios TO couchone_provision;
CREATE POLICY insertar_administradores_controlados ON privado.usuarios
  FOR INSERT TO couchone_provision WITH CHECK (rol='administrador' AND estado='activo');
CREATE POLICY consultar_administradores_controlados ON privado.usuarios
  FOR SELECT TO couchone_provision USING (rol='administrador');

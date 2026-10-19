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

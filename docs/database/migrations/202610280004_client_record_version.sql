-- HU-017: optimistic concurrency for all effective client-row changes.
ALTER TABLE private.clients ADD COLUMN version integer NOT NULL DEFAULT 1
  CONSTRAINT ck_clients_version CHECK (version > 0);

CREATE FUNCTION private.version_client_record() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,private AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.version := 1;
  ELSIF (to_jsonb(NEW)-'version') IS DISTINCT FROM (to_jsonb(OLD)-'version') THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.version_client_record() FROM PUBLIC;
CREATE TRIGGER version_client_record BEFORE INSERT OR UPDATE ON private.clients
  FOR EACH ROW EXECUTE FUNCTION private.version_client_record();

-- Ownership continues to be enforced by the existing UPDATE/SELECT policies.
-- Neither version nor linkage/ownership can be assigned by ordinary runtime UPDATE.
GRANT UPDATE(full_name,goal,birth_date,height_cm,base_weight_kg,
  base_body_fat_percentage,waist_cm,hip_cm) ON private.clients TO couchone_authentication;

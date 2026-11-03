-- DEC-017: the administrator is read-only support. It can list client accounts, view a client
-- record (base data only) and issue a password reset, always leaving an admin-only log with
-- who, when and why. It still cannot edit records or subscriptions, deactivate accounts or move clients.
CREATE TABLE private.support_log (
  id uuid CONSTRAINT pk_support_log PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  action text NOT NULL CONSTRAINT ck_support_log_action CHECK (action IN ('view_record','reset_issued')),
  reason text NOT NULL CONSTRAINT ck_support_log_reason CHECK (char_length(reason) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_support_log_created ON private.support_log(created_at DESC, id DESC);
ALTER TABLE private.support_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.support_log FROM PUBLIC;
GRANT SELECT ON private.support_log TO couchone_authentication;
CREATE POLICY admin_reads_support_log ON private.support_log FOR SELECT TO couchone_authentication
  USING (EXISTS (SELECT 1 FROM private.users u WHERE u.id::text=current_setting('app.subject_id',true) AND u.role='admin' AND u.status='active'));

CREATE FUNCTION private.is_active_admin() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT u.id FROM private.users u
  WHERE u.id::text=current_setting('app.subject_id',true) AND u.role='admin' AND u.status='active'
$$;
REVOKE ALL ON FUNCTION private.is_active_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_active_admin() TO couchone_authentication;

CREATE FUNCTION private.log_support(target_client uuid, log_action text, log_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE admin uuid:=private.is_active_admin();
BEGIN
  IF admin IS NULL THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN'; END IF;
  INSERT INTO private.support_log(admin_id,client_id,action,reason) VALUES(admin,target_client,log_action,btrim(log_reason));
END $$;
REVOKE ALL ON FUNCTION private.log_support(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.log_support(uuid,text,text) TO couchone_authentication;

-- Directory of client accounts: identifiers and states only, no physical data.
CREATE FUNCTION private.support_clients(search_text text, page_limit int, page_offset int)
RETURNS TABLE(total bigint, client_id uuid, user_id uuid, full_name text, username text, account_status text, record_status text, professional_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
BEGIN
  IF private.is_active_admin() IS NULL THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN'; END IF;
  RETURN QUERY
  WITH f AS (
    SELECT c.id,c.user_id,c.full_name,u.username,u.status AS account_status,c.status AS record_status,p.full_name AS professional_name
    FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id LEFT JOIN private.users u ON u.id=c.user_id
    WHERE search_text='' OR position(lower(search_text COLLATE pg_catalog.pg_c_utf8) in lower((c.full_name||' '||COALESCE(u.username,'')) COLLATE pg_catalog.pg_c_utf8))>0
  )
  SELECT (SELECT count(*) FROM f),f.id,f.user_id,f.full_name,f.username,f.account_status,f.record_status,f.professional_name
  FROM f ORDER BY f.full_name,f.id LIMIT page_limit OFFSET page_offset;
END $$;
REVOKE ALL ON FUNCTION private.support_clients(text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_clients(text,int,int) TO couchone_authentication;

-- Read-only view of one record (the base data of DEC-017) plus account and subscription state; logs the access.
CREATE FUNCTION private.support_client_view(target_client uuid, view_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE result jsonb;
BEGIN
  IF private.is_active_admin() IS NULL THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN'; END IF;
  SELECT jsonb_build_object(
      'clientId',c.id,'userId',c.user_id,'fullName',c.full_name,'goal',c.goal,'birthDate',c.birth_date::text,
      'heightCm',c.height_cm::float8,'baseWeightKg',c.base_weight_kg::float8,'recordStatus',c.status,
      'accountStatus',u.status,'username',u.username,'email',u.email,
      'professionalName',p.full_name,'subscriptionStatus',
        CASE WHEN s.id IS NULL THEN 'none' WHEN COALESCE(s.grace_until,s.expires_at)<=clock_timestamp() THEN 'expired'
             WHEN s.expires_at<=clock_timestamp() THEN 'grace' ELSE s.status END,
      'subscriptionExpiresAt',s.expires_at)
    INTO result
  FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    LEFT JOIN private.users u ON u.id=c.user_id LEFT JOIN private.subscriptions s ON s.professional_id=p.id
  WHERE c.id=target_client;
  IF result IS NULL THEN RETURN NULL; END IF;
  PERFORM private.log_support(target_client,'view_record',view_reason);
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.support_client_view(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_client_view(uuid,text) TO couchone_authentication;

-- Client record behind a linked account, for the reset flow (admin only).
CREATE FUNCTION private.support_client_of_account(account uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE found uuid;
BEGIN
  IF private.is_active_admin() IS NULL THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN'; END IF;
  SELECT c.id INTO found FROM private.clients c JOIN private.users u ON u.id=c.user_id
   WHERE c.user_id=account AND u.role='client' AND u.status='active';
  RETURN found;
END $$;
REVOKE ALL ON FUNCTION private.support_client_of_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_client_of_account(uuid) TO couchone_authentication;

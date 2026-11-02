-- TT-010: ordinary reads require an active persisted subject and ownership.
-- The API establishes this context transaction-locally after authentication.
DROP POLICY select_clients ON private.clients;
CREATE POLICY select_owned_clients ON private.clients FOR SELECT TO couchone_authentication
USING (
  EXISTS (
    SELECT 1 FROM private.users u
    WHERE u.id::text=current_setting('app.subject_id',true) AND u.status='active'
      AND (
        (u.role='client' AND private.clients.user_id=u.id)
        OR (u.role='professional' AND EXISTS (
          SELECT 1 FROM private.professionals p
          WHERE p.id=private.clients.professional_id AND p.user_id=u.id
        ))
      )
  )
);

-- Anonymous redemption may lock one token-selected row and obtain identifiers,
-- never names, goals or physical measurements, nor a tenant-wide read context.
CREATE FUNCTION private.invited_client_record(digest text, checked_at timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid,professional_id uuid,user_id uuid,status text)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT c.id,c.professional_id,c.user_id,c.status
  FROM private.clients c JOIN private.invitations i ON i.client_id=c.id
  WHERE digest ~ '^[a-f0-9]{64}$' AND i.token_hash=digest
    AND i.expires_at>GREATEST(clock_timestamp(),COALESCE(checked_at,clock_timestamp()))
  FOR UPDATE OF c
$$;

-- Linking is a narrow capability operation, not a general runtime UPDATE grant.
REVOKE UPDATE(user_id) ON private.clients FROM couchone_authentication;
DROP POLICY link_activated_clients ON private.clients;
CREATE FUNCTION private.link_invited_client(digest text,account_id uuid,checked_at timestamptz DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE linked uuid;
BEGIN
  IF current_setting('app.access_operation',true) IS DISTINCT FROM 'activation' THEN
    RETURN false;
  END IF;
  UPDATE private.clients c SET user_id=account_id
  WHERE c.id::text=current_setting('app.client_id',true)
    AND c.user_id IS NULL AND c.status='active'
    AND EXISTS (SELECT 1 FROM private.users u WHERE u.id=account_id AND u.role='client' AND u.status='active')
    AND EXISTS (
      SELECT 1 FROM private.invitations i WHERE i.client_id=c.id AND i.token_hash=digest
        AND digest ~ '^[a-f0-9]{64}$'
        AND i.expires_at>GREATEST(clock_timestamp(),COALESCE(checked_at,clock_timestamp()))
    )
  RETURNING c.id INTO linked;
  RETURN linked IS NOT NULL;
END;
$$;

-- Admin directory receives counts only; admins do not get client-row SELECT.
CREATE FUNCTION private.admin_client_counts()
RETURNS TABLE(professional_id uuid,active_count integer,inactive_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT c.professional_id,
    count(*) FILTER (WHERE c.status='active')::integer,
    count(*) FILTER (WHERE c.status='inactive')::integer
  FROM private.clients c
  WHERE EXISTS (SELECT 1 FROM private.users u
    WHERE u.id::text=current_setting('app.subject_id',true) AND u.role='admin' AND u.status='active')
  GROUP BY c.professional_id
$$;

-- Maintenance can lock only a row with a server-expired invitation, without data.
CREATE FUNCTION private.lock_expired_invitation_client(target_id uuid)
RETURNS uuid
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT c.id FROM private.clients c JOIN private.invitations i ON i.client_id=c.id
  WHERE c.id=target_id AND i.expires_at<=clock_timestamp() FOR UPDATE OF c
$$;

REVOKE ALL ON FUNCTION private.invited_client_record(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.link_invited_client(text,uuid,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.admin_client_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.lock_expired_invitation_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.invited_client_record(text,timestamptz),
  private.link_invited_client(text,uuid,timestamptz),private.admin_client_counts(),
  private.lock_expired_invitation_client(uuid) TO couchone_authentication;

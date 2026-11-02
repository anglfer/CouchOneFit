-- Anonymous invitation access cannot adopt the owner's subject to lock users.
-- Keep that lock within the same token-limited metadata capability instead.
CREATE OR REPLACE FUNCTION private.invited_client_record(digest text, checked_at timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid,professional_id uuid,user_id uuid,status text)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT c.id,c.professional_id,c.user_id,c.status
  FROM private.clients c JOIN private.invitations i ON i.client_id=c.id
  JOIN private.professionals p ON p.id=c.professional_id
  JOIN private.users u ON u.id=p.user_id AND u.status='active' AND u.role='professional'
  WHERE digest ~ '^[a-f0-9]{64}$' AND i.token_hash=digest
    AND i.expires_at>GREATEST(clock_timestamp(),COALESCE(checked_at,clock_timestamp()))
  FOR UPDATE OF c FOR SHARE OF u
$$;
REVOKE ALL ON FUNCTION private.invited_client_record(text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.invited_client_record(text,timestamptz) TO couchone_authentication;

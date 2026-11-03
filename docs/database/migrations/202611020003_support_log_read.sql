-- DEC-017: the admin-only support log is read through a definer function because the runtime
-- has no SELECT on client records (needed to show the client name next to each entry).
CREATE FUNCTION private.support_log_page(page_limit int, page_offset int)
RETURNS TABLE(total bigint, id uuid, action text, reason text, created_at timestamptz, admin_username text, client_id uuid, client_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
BEGIN
  IF private.is_active_admin() IS NULL THEN RAISE EXCEPTION 'SUPPORT_FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT count(*) OVER(),l.id,l.action,l.reason,l.created_at,a.username,l.client_id,c.full_name
    FROM private.support_log l JOIN private.users a ON a.id=l.admin_id JOIN private.clients c ON c.id=l.client_id
   ORDER BY l.created_at DESC,l.id DESC LIMIT page_limit OFFSET page_offset;
END $$;
REVOKE ALL ON FUNCTION private.support_log_page(int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.support_log_page(int,int) TO couchone_authentication;

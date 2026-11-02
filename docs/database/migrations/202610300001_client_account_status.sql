-- DEC-004/HU-018: the owning professional may explicitly deactivate or reactivate the linked
-- client account. This is distinct from the record status, the subscription and invitations.
-- Runtime keeps no UPDATE grant on users.status; this narrow capability checks ownership itself.
ALTER TABLE private.access_events DROP CONSTRAINT ck_access_events_action;
ALTER TABLE private.access_events ADD CONSTRAINT ck_access_events_action CHECK (action IN (
  'credentials_changed','invitation_issued','invitation_revoked','account_activated',
  'reset_issued','password_reset','emergency_reset_issued',
  'client_record_activated','client_record_inactivated',
  'client_account_deactivated','client_account_reactivated'
));

CREATE FUNCTION private.set_client_account_status(target_client uuid, target_status text)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE account_id uuid;
BEGIN
  IF target_status NOT IN ('active','inactive') THEN
    RETURN NULL;
  END IF;
  UPDATE private.users u SET status=target_status
  FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    JOIN private.users owner ON owner.id=p.user_id AND owner.role='professional' AND owner.status='active'
  WHERE c.id=target_client AND c.user_id=u.id AND u.role='client'
    AND owner.id::text=current_setting('app.subject_id',true)
  RETURNING u.id INTO account_id;
  RETURN account_id;
END;
$$;
REVOKE ALL ON FUNCTION private.set_client_account_status(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.set_client_account_status(uuid,text) TO couchone_authentication;

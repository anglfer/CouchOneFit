-- HU-006/007/008/009. Existing records remain unchanged and reserve capacity once.
CREATE TABLE private.subscriptions (
  id uuid CONSTRAINT pk_subscriptions PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL CONSTRAINT uk_subscriptions_professional UNIQUE REFERENCES private.professionals(id) ON DELETE RESTRICT,
  plan text NOT NULL CONSTRAINT ck_subscriptions_plan CHECK (plan IN ('basic','pro','elite')),
  status text NOT NULL DEFAULT 'active' CONSTRAINT ck_subscriptions_status CHECK (status IN ('active','suspended','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.invitations (
  id uuid CONSTRAINT pk_invitations PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL CONSTRAINT uk_invitations_client UNIQUE REFERENCES private.clients(id) ON DELETE RESTRICT,
  token_hash text NOT NULL CONSTRAINT uk_invitations_hash UNIQUE CONSTRAINT ck_invitations_hash CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT ck_invitations_lifetime CHECK (expires_at > created_at)
);
CREATE TABLE private.password_resets (
  id uuid CONSTRAINT pk_password_resets PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL CONSTRAINT uk_password_resets_user UNIQUE REFERENCES private.users(id) ON DELETE RESTRICT,
  issued_by uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL CONSTRAINT uk_password_resets_hash UNIQUE CONSTRAINT ck_password_resets_hash CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT ck_password_resets_lifetime CHECK (expires_at > created_at)
);
CREATE TABLE private.access_events (
  id uuid CONSTRAINT pk_access_events PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES private.users(id) ON DELETE RESTRICT,
  subject_id uuid REFERENCES private.users(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES private.clients(id) ON DELETE RESTRICT,
  action text NOT NULL CONSTRAINT ck_access_events_action CHECK (action IN ('credentials_changed','invitation_issued','invitation_revoked','account_activated','reset_issued','password_reset','emergency_reset_issued')),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.subscriptions,private.invitations,private.password_resets,private.access_events FROM PUBLIC;
ALTER TABLE private.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.access_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON private.subscriptions TO couchone_authentication;
GRANT UPDATE (id) ON private.subscriptions TO couchone_authentication;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.invitations,private.password_resets TO couchone_authentication;
GRANT SELECT,INSERT ON private.access_events TO couchone_authentication;
GRANT UPDATE (username,password_hash) ON private.users TO couchone_authentication;
GRANT UPDATE (user_id) ON private.clients TO couchone_authentication;
CREATE POLICY select_access_subscriptions ON private.subscriptions FOR SELECT TO couchone_authentication USING (true);
CREATE POLICY lock_access_subscriptions ON private.subscriptions FOR UPDATE TO couchone_authentication USING (true) WITH CHECK (true);
-- Context is set by the trusted API connection within each transaction, never by a public client.
CREATE POLICY insert_activated_users ON private.users FOR INSERT TO couchone_authentication
  WITH CHECK (role='client' AND status='active' AND current_setting('app.access_operation',true)='activation');
CREATE POLICY update_own_credentials ON private.users FOR UPDATE TO couchone_authentication
  USING (id::text=current_setting('app.subject_id',true))
  WITH CHECK (id::text=current_setting('app.subject_id',true));
CREATE POLICY link_activated_clients ON private.clients FOR UPDATE TO couchone_authentication
  USING (id::text=current_setting('app.client_id',true) AND user_id IS NULL)
  WITH CHECK (id::text=current_setting('app.client_id',true));
CREATE POLICY manage_invitations ON private.invitations FOR ALL TO couchone_authentication
  USING (client_id::text=current_setting('app.client_id',true))
  WITH CHECK (client_id::text=current_setting('app.client_id',true));
-- Anonymous code lookup exposes hashes only to the private API role.
CREATE POLICY lookup_invitations ON private.invitations FOR SELECT TO couchone_authentication USING (true);
CREATE POLICY manage_password_resets ON private.password_resets FOR ALL TO couchone_authentication
  USING (user_id::text=current_setting('app.subject_id',true))
  WITH CHECK (user_id::text=current_setting('app.subject_id',true));
CREATE POLICY lookup_password_resets ON private.password_resets FOR SELECT TO couchone_authentication USING (true);
CREATE POLICY insert_access_events ON private.access_events FOR INSERT TO couchone_authentication WITH CHECK (true);
CREATE POLICY select_access_events ON private.access_events FOR SELECT TO couchone_authentication USING (false);

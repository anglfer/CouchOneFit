-- Current identity/access schema; apply migrations for normal installations.
DO $roles$
BEGIN
  BEGIN
    CREATE ROLE couchone_registration NOLOGIN;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  BEGIN
    CREATE ROLE couchone_authentication NOLOGIN;
  EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('couchone_registration','couchone_authentication')
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
  OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE member.rolname IN ('couchone_registration','couchone_authentication')
    AND NOT (member.rolname='couchone_authentication' AND parent.rolname='couchone_registration')) THEN
    RAISE EXCEPTION 'CouchOneFit application roles have incompatible privileges';
  END IF;
END $roles$;
GRANT couchone_registration TO couchone_authentication;
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE private.users (
  id uuid CONSTRAINT pk_users PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL CONSTRAINT ck_users_username CHECK (username ~ '^[a-z0-9._]{3,30}$'),
  email text NOT NULL CONSTRAINT ck_users_email CHECK (email = lower(btrim(email)) AND length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  password_hash text NOT NULL CONSTRAINT ck_users_password_hash CHECK (password_hash LIKE '$argon2id$%'),
  role text NOT NULL CONSTRAINT ck_users_role CHECK (role IN ('professional', 'client', 'admin')),
  status text NOT NULL DEFAULT 'active' CONSTRAINT ck_users_status CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_users_id_role UNIQUE (id, role)
);
CREATE UNIQUE INDEX uk_users_username_normalized ON private.users (lower(btrim(username)));
CREATE UNIQUE INDEX uk_users_email_normalized ON private.users (lower(btrim(email)));
CREATE TABLE private.professionals (
  id uuid CONSTRAINT pk_professionals PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL CONSTRAINT uk_professionals_user_id UNIQUE,
  user_role text NOT NULL DEFAULT 'professional' CONSTRAINT ck_professionals_user_role CHECK (user_role = 'professional'),
  full_name text NOT NULL CONSTRAINT ck_professionals_full_name CHECK (char_length(btrim(full_name)) BETWEEN 3 AND 120),
  phone text CONSTRAINT ck_professionals_phone CHECK (phone ~ '^[0-9]{10,15}$'),
  plan_interest text CONSTRAINT ck_professionals_plan_interest CHECK (plan_interest IN ('basic', 'pro', 'elite')),
  CONSTRAINT fk_professionals_user_role FOREIGN KEY (user_id, user_role) REFERENCES private.users (id, role) ON DELETE RESTRICT
);
CREATE TABLE private.clients (
  id uuid CONSTRAINT pk_clients PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL CONSTRAINT fk_clients_professional REFERENCES private.professionals (id) ON DELETE RESTRICT,
  user_id uuid CONSTRAINT uk_clients_user_id UNIQUE,
  user_role text NOT NULL DEFAULT 'client' CONSTRAINT ck_clients_user_role CHECK (user_role = 'client'),
  full_name text NOT NULL CONSTRAINT ck_clients_full_name CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 150),
  goal text CONSTRAINT ck_clients_goal CHECK (goal IS NULL OR char_length(btrim(goal)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'active' CONSTRAINT ck_clients_status CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_clients_user_role FOREIGN KEY (user_id, user_role) REFERENCES private.users (id, role) ON DELETE RESTRICT
);
CREATE INDEX idx_clients_professional_id ON private.clients (professional_id);
CREATE TABLE private.notice_acceptances (
  id uuid CONSTRAINT pk_notice_acceptances PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL CONSTRAINT fk_notice_acceptances_user REFERENCES private.users (id) ON DELETE RESTRICT,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_notice_acceptances_user_version UNIQUE (user_id, version)
);
CREATE TABLE private.sessions (
  id uuid CONSTRAINT pk_sessions PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL CONSTRAINT fk_sessions_user REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  CONSTRAINT ck_sessions_lifetime CHECK (expires_at > created_at)
);
CREATE INDEX idx_sessions_user_id ON private.sessions(user_id);
CREATE TABLE private.refresh_tokens (
  id uuid CONSTRAINT pk_refresh_tokens PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL CONSTRAINT uk_refresh_tokens_token_hash UNIQUE CONSTRAINT ck_refresh_tokens_token_hash CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  session_id uuid NOT NULL CONSTRAINT fk_refresh_tokens_session REFERENCES private.sessions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX idx_refresh_tokens_session_id ON private.refresh_tokens(session_id);
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
ALTER TABLE private.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.notice_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.refresh_tokens ENABLE ROW LEVEL SECURITY;
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
  OR pg_has_role('couchone_authentication','couchone_provision','MEMBER')
  OR pg_has_role('couchone_registration','couchone_provision','MEMBER') THEN
    RAISE EXCEPTION 'The provisioning role has incompatible privileges or memberships';
  END IF;
END $roles$;
GRANT USAGE ON SCHEMA private TO couchone_provision;
GRANT USAGE ON SCHEMA private TO couchone_registration,couchone_authentication;
GRANT INSERT,SELECT ON private.users,private.professionals,private.notice_acceptances TO couchone_registration;
GRANT SELECT ON private.users,private.clients TO couchone_authentication;
GRANT SELECT,INSERT,UPDATE ON private.sessions,private.refresh_tokens TO couchone_authentication;
CREATE POLICY insert_professional_users ON private.users FOR INSERT TO couchone_registration WITH CHECK (role='professional' AND status='active');
CREATE POLICY select_professional_users ON private.users FOR SELECT TO couchone_registration USING (role='professional');
CREATE POLICY select_login_users ON private.users FOR SELECT TO couchone_authentication USING(true);
CREATE POLICY insert_professionals ON private.professionals FOR INSERT TO couchone_registration WITH CHECK(true);
CREATE POLICY select_professionals ON private.professionals FOR SELECT TO couchone_registration USING(true);
CREATE POLICY select_clients ON private.clients FOR SELECT TO couchone_authentication USING(true);
CREATE POLICY insert_notice_acceptances ON private.notice_acceptances FOR INSERT TO couchone_registration WITH CHECK(true);
CREATE POLICY select_notice_acceptances ON private.notice_acceptances FOR SELECT TO couchone_registration USING(true);
CREATE POLICY manage_sessions ON private.sessions FOR ALL TO couchone_authentication USING(true) WITH CHECK(true);
CREATE POLICY manage_refresh_tokens ON private.refresh_tokens FOR ALL TO couchone_authentication USING(true) WITH CHECK(true);
GRANT SELECT (id,username,email,role,status), INSERT (username,email,password_hash,role)
  ON private.users TO couchone_provision;
CREATE POLICY insert_controlled_admins ON private.users
  FOR INSERT TO couchone_provision WITH CHECK (role='admin' AND status='active');
CREATE POLICY select_controlled_admins ON private.users
  FOR SELECT TO couchone_provision USING (role='admin');
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

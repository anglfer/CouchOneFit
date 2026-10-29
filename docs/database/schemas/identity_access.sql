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
  birth_date date,
  height_cm numeric,
  base_weight_kg numeric,
  base_body_fat_percentage numeric,
  waist_cm numeric,
  hip_cm numeric,
  CONSTRAINT ck_clients_initial_measurements_complete CHECK (
    (birth_date IS NULL AND height_cm IS NULL AND base_weight_kg IS NULL)
    OR (birth_date IS NOT NULL AND height_cm IS NOT NULL AND base_weight_kg IS NOT NULL)
  ),
  CONSTRAINT ck_clients_height_cm CHECK (
    height_cm IS NULL OR (height_cm BETWEEN 100 AND 250 AND height_cm = round(height_cm, 1))
  ),
  CONSTRAINT ck_clients_base_weight_kg CHECK (
    base_weight_kg IS NULL OR (base_weight_kg BETWEEN 30 AND 300 AND base_weight_kg = round(base_weight_kg, 1))
  ),
  CONSTRAINT ck_clients_base_body_fat_percentage CHECK (
    base_body_fat_percentage IS NULL OR (base_body_fat_percentage BETWEEN 2 AND 60 AND base_body_fat_percentage = round(base_body_fat_percentage, 1))
  ),
  CONSTRAINT ck_clients_waist_cm CHECK (
    waist_cm IS NULL OR (waist_cm BETWEEN 40 AND 250 AND waist_cm = round(waist_cm, 1))
  ),
  CONSTRAINT ck_clients_hip_cm CHECK (
    hip_cm IS NULL OR (hip_cm BETWEEN 50 AND 250 AND hip_cm = round(hip_cm, 1))
  ),
  CONSTRAINT fk_clients_user_role FOREIGN KEY (user_id, user_role) REFERENCES private.users (id, role) ON DELETE RESTRICT
);
CREATE FUNCTION private.validate_client_birth_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date > CURRENT_DATE - INTERVAL '18 years' THEN
    RAISE EXCEPTION 'birth_date must identify an adult client'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_client_birth_date
  BEFORE INSERT OR UPDATE OF birth_date ON private.clients
  FOR EACH ROW EXECUTE FUNCTION private.validate_client_birth_date();
COMMENT ON COLUMN private.clients.birth_date IS
  'Required by the HU-015 API for new records; NULL is retained for pre-HU-015 records.';
COMMENT ON COLUMN private.clients.height_cm IS
  'Required by the HU-015 API for new records; centimetres with one decimal.';
COMMENT ON COLUMN private.clients.base_weight_kg IS
  'Required HU-015 base weight in kilograms with one decimal; never a historical weight event.';
COMMENT ON COLUMN private.clients.base_body_fat_percentage IS
  'Optional measured base body fat percentage, not a calculated evaluation result or historical measurement.';
COMMENT ON COLUMN private.clients.waist_cm IS
  'Optional base waist circumference in centimetres, not a historical measurement.';
COMMENT ON COLUMN private.clients.hip_cm IS
  'Optional base hip circumference in centimetres, not a historical measurement.';
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
CREATE POLICY select_access_subscriptions ON private.subscriptions FOR SELECT TO couchone_authentication USING (true);
CREATE POLICY lock_access_subscriptions ON private.subscriptions FOR UPDATE TO couchone_authentication USING (true) WITH CHECK (true);
-- Context is set by the trusted API connection within each transaction, never by a public client.
CREATE POLICY insert_activated_users ON private.users FOR INSERT TO couchone_authentication
  WITH CHECK (role='client' AND status='active' AND current_setting('app.access_operation',true)='activation');
CREATE POLICY update_own_credentials ON private.users FOR UPDATE TO couchone_authentication
  USING (id::text=current_setting('app.subject_id',true))
  WITH CHECK (id::text=current_setting('app.subject_id',true));
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

CREATE TABLE private.saas_plans (
  id UUID CONSTRAINT pk_saas_plans PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) CONSTRAINT uk_saas_plans_name UNIQUE NOT NULL,
  -- max_clients: NULL significa ilimitado. Rechaza valores 0 o negativos.
  max_clients INTEGER NULL CONSTRAINT chk_saas_plans_max_clients CHECK (max_clients > 0),
  price_mxn NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO private.saas_plans (name, max_clients, price_mxn) VALUES
('Básico 10', 10, 299.00),
('Pro 30', 30, 599.00),
('Élite ilimitado', NULL, 999.00);
ALTER TABLE private.subscriptions
  ADD COLUMN plan_id UUID REFERENCES private.saas_plans(id) ON DELETE RESTRICT;

UPDATE private.subscriptions s
SET plan_id = p.id
FROM private.saas_plans p
WHERE
  (s.plan = 'basic' AND p.name = 'Básico 10') OR
  (s.plan = 'pro' AND p.name = 'Pro 30') OR
  (s.plan = 'elite' AND p.name = 'Élite ilimitado');

UPDATE private.subscriptions
SET plan_id = (SELECT id FROM private.saas_plans WHERE name = 'Básico 10')
WHERE plan_id IS NULL;

ALTER TABLE private.subscriptions ALTER COLUMN plan_id SET NOT NULL;
ALTER TABLE private.subscriptions DROP COLUMN plan;

CREATE TABLE private.subscription_history (
  id UUID CONSTRAINT pk_subscription_history PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES private.professionals(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES private.users(id), -- Registra quién autorizó el cambio
  previous_plan_id UUID REFERENCES private.saas_plans(id),
  new_plan_id UUID NOT NULL REFERENCES private.saas_plans(id),
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);
-- HU-010..014: incremental correction; earlier migration checksums are preserved.
ALTER TABLE private.saas_plans ADD COLUMN is_unlimited boolean;
UPDATE private.saas_plans SET is_unlimited=(max_clients IS NULL);
ALTER TABLE private.saas_plans ALTER COLUMN is_unlimited SET NOT NULL;
ALTER TABLE private.saas_plans ADD CONSTRAINT ck_saas_plans_capacity CHECK
  ((is_unlimited AND max_clients IS NULL) OR (NOT is_unlimited AND max_clients IS NOT NULL AND max_clients>0));
ALTER TABLE private.saas_plans ADD CONSTRAINT ck_saas_plans_price CHECK (price_mxn>=0 AND price_mxn<100000000 AND price_mxn<>'NaN'::numeric);
ALTER TABLE private.saas_plans ADD CONSTRAINT ck_saas_plans_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 50);
CREATE UNIQUE INDEX uk_saas_plans_normalized_name ON private.saas_plans(lower(btrim(name)));
ALTER TABLE private.subscription_history ADD COLUMN previous_expires_at timestamptz;
ALTER TABLE private.subscription_history ADD COLUMN new_expires_at timestamptz;
ALTER TABLE private.subscription_history DROP CONSTRAINT subscription_history_professional_id_fkey;
ALTER TABLE private.subscription_history ADD CONSTRAINT fk_subscription_history_professional FOREIGN KEY (professional_id) REFERENCES private.professionals(id) ON DELETE RESTRICT;
CREATE TABLE private.plan_history (
  id uuid CONSTRAINT pk_plan_history PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES private.saas_plans(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  previous_value jsonb,
  new_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON private.saas_plans,private.subscription_history,private.plan_history FROM PUBLIC;
ALTER TABLE private.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.plan_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON private.saas_plans,private.subscriptions TO couchone_authentication;
GRANT SELECT,INSERT ON private.subscription_history,private.plan_history TO couchone_authentication;
GRANT UPDATE(id) ON private.professionals TO couchone_authentication;
GRANT INSERT ON private.clients TO couchone_authentication;
GRANT UPDATE(status) ON private.clients TO couchone_authentication;
CREATE POLICY lock_saas_professionals ON private.professionals FOR UPDATE TO couchone_authentication USING (true) WITH CHECK (true);
CREATE POLICY select_saas_plans ON private.saas_plans FOR SELECT TO couchone_authentication USING (true);
CREATE POLICY insert_saas_plans ON private.saas_plans FOR INSERT TO couchone_authentication WITH CHECK
  (EXISTS (SELECT 1 FROM private.users WHERE id::text=current_setting('app.subject_id',true) AND role='admin' AND status='active'));
CREATE POLICY update_saas_plans ON private.saas_plans FOR UPDATE TO couchone_authentication USING
  (EXISTS (SELECT 1 FROM private.users WHERE id::text=current_setting('app.subject_id',true) AND role='admin' AND status='active'));
CREATE POLICY insert_saas_subscriptions ON private.subscriptions FOR INSERT TO couchone_authentication WITH CHECK
  (EXISTS (SELECT 1 FROM private.users WHERE id::text=current_setting('app.subject_id',true) AND role='admin' AND status='active'));
-- Existing UPDATE policy permits row locks for activation. The private API role is never public.
CREATE POLICY insert_subscription_history ON private.subscription_history FOR INSERT TO couchone_authentication WITH CHECK
  (actor_id::text=current_setting('app.subject_id',true) AND EXISTS (SELECT 1 FROM private.users WHERE id=actor_id AND role='admin' AND status='active'));
CREATE POLICY insert_plan_history ON private.plan_history FOR INSERT TO couchone_authentication WITH CHECK
  (actor_id::text=current_setting('app.subject_id',true) AND EXISTS (SELECT 1 FROM private.users WHERE id=actor_id AND role='admin' AND status='active'));
CREATE POLICY insert_owned_clients ON private.clients FOR INSERT TO couchone_authentication WITH CHECK
  (user_id IS NULL AND EXISTS (SELECT 1 FROM private.professionals p JOIN private.users u ON u.id=p.user_id WHERE p.id=professional_id AND u.id::text=current_setting('app.subject_id',true) AND u.status='active'));
CREATE POLICY update_owned_client_status ON private.clients FOR UPDATE TO couchone_authentication USING
  (EXISTS (SELECT 1 FROM private.professionals p WHERE p.id=professional_id AND p.user_id::text=current_setting('app.subject_id',true))) WITH CHECK
  (EXISTS (SELECT 1 FROM private.professionals p WHERE p.id=professional_id AND p.user_id::text=current_setting('app.subject_id',true)));
-- Professional self-service simulation; no payment provider or financial credentials.
CREATE TABLE private.simulated_payments (
 id uuid CONSTRAINT pk_simulated_payments PRIMARY KEY DEFAULT gen_random_uuid(),
 professional_id uuid NOT NULL REFERENCES private.professionals(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
 plan_id uuid NOT NULL REFERENCES private.saas_plans(id) ON DELETE RESTRICT,
 idempotency_key uuid NOT NULL,
 plan_snapshot jsonb NOT NULL,
 expected_subscription jsonb,
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 9999999999),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','succeeded','failed','cancelled')),
 instrument text CHECK(instrument IN('test_approved','test_declined','test_error')),
 failure_code text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 quote_expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
 processing_after timestamptz,
 completed_at timestamptz,
 period_start timestamptz,
 period_end timestamptz,
 CONSTRAINT uk_simulated_payments_idempotency UNIQUE(professional_id,idempotency_key)
);
CREATE UNIQUE INDEX uk_simulated_payments_open ON private.simulated_payments(professional_id) WHERE status IN('pending','processing');
ALTER TABLE private.simulated_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.simulated_payments FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON private.simulated_payments TO couchone_authentication;
CREATE POLICY own_simulated_payments ON private.simulated_payments FOR ALL TO couchone_authentication
 USING(actor_id::text=current_setting('app.subject_id',true))
 WITH CHECK(actor_id::text=current_setting('app.subject_id',true) AND EXISTS(SELECT 1 FROM private.professionals p WHERE p.id=professional_id AND p.user_id=actor_id));
-- Admin subscription control is removed from both API and runtime privileges.
REVOKE INSERT,UPDATE ON private.subscriptions FROM couchone_authentication;
GRANT UPDATE(id) ON private.subscriptions TO couchone_authentication;
REVOKE INSERT ON private.subscription_history FROM couchone_authentication;
CREATE FUNCTION private.apply_simulated_payment(payment_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE payment private.simulated_payments%ROWTYPE; previous private.subscriptions%ROWTYPE;
 target_plan private.saas_plans%ROWTYPE; professional uuid; started timestamptz;
BEGIN
 SELECT professional_id INTO professional FROM private.simulated_payments WHERE id=payment_id AND actor_id::text=current_setting('app.subject_id',true);
 IF professional IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
 PERFORM id FROM private.professionals WHERE id=professional FOR UPDATE;
 SELECT * INTO payment FROM private.simulated_payments WHERE id=payment_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM private.users u JOIN private.professionals p ON p.user_id=u.id WHERE p.id=professional AND u.id=payment.actor_id AND u.role='professional' AND u.status='active') THEN RAISE EXCEPTION 'PAYMENT_FORBIDDEN'; END IF;
 IF payment.status='succeeded' THEN RETURN; END IF;
 IF payment.status<>'processing' OR payment.instrument IS DISTINCT FROM 'test_approved' OR payment.processing_after>clock_timestamp() OR payment.processing_after IS NULL THEN RAISE EXCEPTION 'PAYMENT_NOT_READY'; END IF;
 SELECT * INTO target_plan FROM private.saas_plans WHERE id=payment.plan_id FOR SHARE;
 SELECT * INTO previous FROM private.subscriptions WHERE professional_id=professional FOR UPDATE;
 IF to_jsonb(target_plan) IS DISTINCT FROM payment.plan_snapshot OR NOT target_plan.is_active OR
    (CASE WHEN previous.id IS NULL THEN NULL ELSE to_jsonb(previous) END) IS DISTINCT FROM payment.expected_subscription OR
    payment.amount_cents<>round(target_plan.price_mxn*100)::bigint THEN RAISE EXCEPTION 'CHECKOUT_STALE'; END IF;
 started:=clock_timestamp();
 UPDATE private.simulated_payments SET status='succeeded',completed_at=started,period_start=started,
   period_end=((started AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC' WHERE id=payment_id;
 INSERT INTO private.subscriptions(professional_id,plan_id,status,expires_at) VALUES(professional,payment.plan_id,'active',((started AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC')
 ON CONFLICT(professional_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',expires_at=EXCLUDED.expires_at;
 INSERT INTO private.subscription_history(professional_id,actor_id,previous_plan_id,new_plan_id,previous_status,new_status,previous_expires_at,new_expires_at)
 VALUES(professional,payment.actor_id,previous.plan_id,payment.plan_id,previous.status,'active',previous.expires_at,((started AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC');
END $$;
REVOKE ALL ON FUNCTION private.apply_simulated_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.apply_simulated_payment(uuid) TO couchone_authentication;
-- Preserve the selected catalog plan without changing the historical registration-interest enum.
ALTER TABLE private.professionals ADD COLUMN plan_interest_id uuid
  CONSTRAINT fk_professionals_plan_interest REFERENCES private.saas_plans(id) ON DELETE RESTRICT;
GRANT SELECT ON private.saas_plans TO couchone_registration;
CREATE POLICY select_registration_plans ON private.saas_plans FOR SELECT TO couchone_registration USING(is_active);


-- Anonymous redemption may lock one token-selected row and obtain identifiers,
-- never names, goals or physical measurements, nor a tenant-wide read context.
CREATE FUNCTION private.invited_client_record(digest text, checked_at timestamptz DEFAULT NULL)
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

-- Linking is a narrow capability operation, not a general runtime UPDATE grant.
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

CREATE INDEX idx_clients_portfolio_order ON private.clients (professional_id,created_at DESC,id DESC);

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

-- HU-018: record transitions are distinct from account activation or subscription changes.
-- Retain every previous action and event. No data rewrite or additional runtime grants.
ALTER TABLE private.access_events DROP CONSTRAINT ck_access_events_action;
ALTER TABLE private.access_events ADD CONSTRAINT ck_access_events_action CHECK (action IN (
  'credentials_changed','invitation_issued','invitation_revoked','account_activated',
  'reset_issued','password_reset','emergency_reset_issued',
  'client_record_activated','client_record_inactivated'
));

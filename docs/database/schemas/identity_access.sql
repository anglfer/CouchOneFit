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

-- DEC-017: the minimum client age is 16 years (it was 18). Existing rows are not rewritten;
-- every previously valid birth date remains valid.
CREATE OR REPLACE FUNCTION private.validate_client_birth_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date > CURRENT_DATE - INTERVAL '16 years' THEN
    RAISE EXCEPTION 'birth_date must identify a client of at least 16 years'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- DEC-017: simulated automatic renewal, 7-day grace, cancel at period end and plan downgrade.
-- No real payment provider: the renewal outcome is driven by a stored simulated method.
ALTER TABLE private.subscriptions
  ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN renewal_method text NOT NULL DEFAULT 'test_approved'
    CONSTRAINT ck_subscriptions_renewal_method CHECK (renewal_method IN ('test_approved','test_declined','test_error')),
  ADD COLUMN grace_until timestamptz,
  ADD CONSTRAINT ck_subscriptions_grace CHECK (grace_until IS NULL OR grace_until > expires_at);
ALTER TABLE private.simulated_payments
  ADD COLUMN kind text NOT NULL DEFAULT 'checkout' CONSTRAINT ck_simulated_payments_kind CHECK (kind IN ('checkout','renewal'));

-- A paid checkout starts a clean period: it clears cancellation and grace.
CREATE OR REPLACE FUNCTION private.apply_simulated_payment(payment_id uuid) RETURNS void
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
 ON CONFLICT(professional_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',expires_at=EXCLUDED.expires_at,
   cancel_at_period_end=false,grace_until=NULL,renewal_method='test_approved';
 INSERT INTO private.subscription_history(professional_id,actor_id,previous_plan_id,new_plan_id,previous_status,new_status,previous_expires_at,new_expires_at)
 VALUES(professional,payment.actor_id,previous.plan_id,payment.plan_id,previous.status,'active',previous.expires_at,((started AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC');
END $$;

-- Lazy renewal for the caller's own subscription. The API has no scheduler, so each
-- professional-facing read/write calls it. Returns none | renewed | grace | lapsed.
CREATE FUNCTION private.renew_subscription(checked_at timestamptz DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE t timestamptz:=COALESCE(checked_at,clock_timestamp()); prof private.professionals%ROWTYPE;
 sub private.subscriptions%ROWTYPE; pl private.saas_plans%ROWTYPE; newend timestamptz;
 renewed boolean:=false; guard int:=0; code text;
BEGIN
 SELECT p.* INTO prof FROM private.professionals p JOIN private.users u ON u.id=p.user_id
  WHERE u.id::text=current_setting('app.subject_id',true) AND u.role='professional' AND u.status='active';
 IF prof.id IS NULL THEN RETURN 'none'; END IF;
 PERFORM id FROM private.professionals WHERE id=prof.id FOR UPDATE;
 SELECT * INTO sub FROM private.subscriptions WHERE professional_id=prof.id FOR UPDATE;
 IF sub.id IS NULL OR sub.status<>'active' OR sub.cancel_at_period_end OR sub.expires_at>t THEN RETURN 'none'; END IF;
 SELECT * INTO pl FROM private.saas_plans WHERE id=sub.plan_id;
 IF sub.renewal_method='test_approved' THEN
  WHILE sub.expires_at<=t AND guard<24 LOOP
   guard:=guard+1;
   newend:=((sub.expires_at AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC';
   INSERT INTO private.simulated_payments(professional_id,actor_id,plan_id,idempotency_key,plan_snapshot,expected_subscription,
     amount_cents,status,instrument,created_at,quote_expires_at,completed_at,period_start,period_end,kind)
   VALUES(prof.id,prof.user_id,pl.id,gen_random_uuid(),to_jsonb(pl),to_jsonb(sub),round(pl.price_mxn*100)::bigint,
     'succeeded','test_approved',t,t,t,sub.expires_at,newend,'renewal');
   INSERT INTO private.subscription_history(professional_id,actor_id,previous_plan_id,new_plan_id,previous_status,new_status,previous_expires_at,new_expires_at)
   VALUES(prof.id,prof.user_id,sub.plan_id,sub.plan_id,sub.status,'active',sub.expires_at,newend);
   UPDATE private.subscriptions SET expires_at=newend,grace_until=NULL WHERE id=sub.id RETURNING * INTO sub;
   renewed:=true;
  END LOOP;
  RETURN CASE WHEN renewed THEN 'renewed' ELSE 'none' END;
 END IF;
 -- Failed charge: full access until expires_at + 7 days, then the plan lapses.
 IF sub.grace_until IS NULL THEN
  code:=CASE sub.renewal_method WHEN 'test_error' THEN 'PROCESSOR_ERROR' ELSE 'PAYMENT_DECLINED' END;
  INSERT INTO private.simulated_payments(professional_id,actor_id,plan_id,idempotency_key,plan_snapshot,expected_subscription,
    amount_cents,status,instrument,failure_code,created_at,quote_expires_at,completed_at,kind)
  VALUES(prof.id,prof.user_id,pl.id,gen_random_uuid(),to_jsonb(pl),to_jsonb(sub),round(pl.price_mxn*100)::bigint,
    'failed',sub.renewal_method,code,t,t,t,'renewal');
  UPDATE private.subscriptions SET grace_until=sub.expires_at+interval '7 days' WHERE id=sub.id RETURNING * INTO sub;
 END IF;
 RETURN CASE WHEN sub.grace_until>t THEN 'grace' ELSE 'lapsed' END;
END $$;
REVOKE ALL ON FUNCTION private.renew_subscription(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.renew_subscription(timestamptz) TO couchone_authentication;

-- Cancel at period end / choose the simulated renewal method. NULL leaves a value as is.
CREATE FUNCTION private.set_subscription_preferences(cancel boolean, method text, checked_at timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE t timestamptz:=COALESCE(checked_at,clock_timestamp()); prof uuid; sub private.subscriptions%ROWTYPE;
BEGIN
 SELECT p.id INTO prof FROM private.professionals p JOIN private.users u ON u.id=p.user_id
  WHERE u.id::text=current_setting('app.subject_id',true) AND u.role='professional' AND u.status='active';
 IF prof IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_FORBIDDEN'; END IF;
 PERFORM id FROM private.professionals WHERE id=prof FOR UPDATE;
 SELECT * INTO sub FROM private.subscriptions WHERE professional_id=prof FOR UPDATE;
 IF sub.id IS NULL OR sub.status<>'active' OR COALESCE(sub.grace_until,sub.expires_at)<=t THEN RAISE EXCEPTION 'PLAN_REQUIRED'; END IF;
 IF method IS NOT NULL AND method NOT IN ('test_approved','test_declined','test_error') THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 UPDATE private.subscriptions SET cancel_at_period_end=COALESCE(cancel,cancel_at_period_end),renewal_method=COALESCE(method,renewal_method)
  WHERE id=sub.id;
END $$;
REVOKE ALL ON FUNCTION private.set_subscription_preferences(boolean,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.set_subscription_preferences(boolean,text,timestamptz) TO couchone_authentication;

-- Downgrade to a plan with lower capacity. The caller inactivates the chosen records first
-- in the same transaction; the function refuses if active records still exceed the new limit.
-- The current period is kept, nothing is refunded and the lower price applies from the next renewal.
CREATE FUNCTION private.apply_plan_downgrade(target_plan_id uuid, checked_at timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE t timestamptz:=COALESCE(checked_at,clock_timestamp()); prof private.professionals%ROWTYPE;
 sub private.subscriptions%ROWTYPE; cur private.saas_plans%ROWTYPE; tgt private.saas_plans%ROWTYPE; used int;
BEGIN
 SELECT p.* INTO prof FROM private.professionals p JOIN private.users u ON u.id=p.user_id
  WHERE u.id::text=current_setting('app.subject_id',true) AND u.role='professional' AND u.status='active';
 IF prof.id IS NULL THEN RAISE EXCEPTION 'SUBSCRIPTION_FORBIDDEN'; END IF;
 PERFORM id FROM private.professionals WHERE id=prof.id FOR UPDATE;
 SELECT * INTO sub FROM private.subscriptions WHERE professional_id=prof.id FOR UPDATE;
 IF sub.id IS NULL OR sub.status<>'active' OR COALESCE(sub.grace_until,sub.expires_at)<=t THEN RAISE EXCEPTION 'PLAN_REQUIRED'; END IF;
 SELECT * INTO cur FROM private.saas_plans WHERE id=sub.plan_id;
 SELECT * INTO tgt FROM private.saas_plans WHERE id=target_plan_id AND is_active;
 IF tgt.id IS NULL THEN RAISE EXCEPTION 'PLAN_UNAVAILABLE'; END IF;
 IF tgt.is_unlimited OR (NOT cur.is_unlimited AND tgt.max_clients>=cur.max_clients) THEN RAISE EXCEPTION 'DOWNGRADE_NOT_LOWER'; END IF;
 SELECT count(*)::int INTO used FROM private.clients WHERE professional_id=prof.id AND status='active';
 IF used>tgt.max_clients THEN RAISE EXCEPTION 'DOWNGRADE_EXCESS'; END IF;
 UPDATE private.subscriptions SET plan_id=tgt.id WHERE id=sub.id;
 INSERT INTO private.subscription_history(professional_id,actor_id,previous_plan_id,new_plan_id,previous_status,new_status,previous_expires_at,new_expires_at)
 VALUES(prof.id,prof.user_id,sub.plan_id,tgt.id,sub.status,sub.status,sub.expires_at,sub.expires_at);
END $$;
REVOKE ALL ON FUNCTION private.apply_plan_downgrade(uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.apply_plan_downgrade(uuid,timestamptz) TO couchone_authentication;

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
-- DEC-018: replays of writes captured offline must not duplicate or reapply (docs/architecture/pwa-offline.md §4.4).
-- A client sends `Idempotency-Key` (uuid); the first request stores a claim, the finished 2xx response is kept,
-- and a repetition with the same key and body returns that response without writing again.
CREATE TABLE private.idempotency_keys (
  owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  key uuid NOT NULL,
  request_hash text NOT NULL,
  status_code integer CONSTRAINT ck_idempotency_keys_status CHECK (status_code IS NULL OR status_code BETWEEN 200 AND 299),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT pk_idempotency_keys PRIMARY KEY (owner_id, key),
  CONSTRAINT ck_idempotency_keys_complete CHECK ((status_code IS NULL) = (response IS NULL))
);
CREATE INDEX idx_idempotency_keys_created_at ON private.idempotency_keys (created_at);
ALTER TABLE private.idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.idempotency_keys FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.idempotency_keys TO couchone_authentication;
CREATE POLICY own_idempotency_keys ON private.idempotency_keys FOR ALL TO couchone_authentication
  USING (owner_id::text = current_setting('app.subject_id', true))
  WITH CHECK (owner_id::text = current_setting('app.subject_id', true));
-- EP-06: immutable prescriptions, a single active version, and separate execution.
ALTER TABLE private.clients ADD COLUMN time_zone text NOT NULL DEFAULT 'America/Mexico_City';
GRANT UPDATE(time_zone) ON private.clients TO couchone_authentication;

CREATE TABLE private.training_exercise_catalog (
  id text PRIMARY KEY, name text NOT NULL, body_part text NOT NULL,
  muscles jsonb NOT NULL, equipment jsonb NOT NULL, guidance jsonb NOT NULL,
  images jsonb NOT NULL, selectable boolean NOT NULL, source_revision text NOT NULL
);
REVOKE ALL ON private.training_exercise_catalog FROM PUBLIC;
GRANT SELECT ON private.training_exercise_catalog TO couchone_authentication;
ALTER TABLE private.training_exercise_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_catalog_read ON private.training_exercise_catalog FOR SELECT TO couchone_authentication
USING (EXISTS (SELECT 1 FROM private.users WHERE id::text=current_setting('app.subject_id',true) AND status='active' AND role IN ('professional','client')));

-- These helpers implement only the RLS boundary; HTTP services still authorize every action.
CREATE FUNCTION private.training_professional(owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT EXISTS(SELECT 1 FROM private.users u JOIN private.professionals p ON p.user_id=u.id
    JOIN private.subscriptions s ON s.professional_id=p.id
    WHERE u.id=owner AND u.id::text=current_setting('app.subject_id',true) AND u.role='professional' AND u.status='active'
      AND s.status='active' AND COALESCE(s.grace_until,s.expires_at)>CURRENT_TIMESTAMP)
$$;
CREATE FUNCTION private.training_client_access(target uuid, writable boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT EXISTS(SELECT 1 FROM private.clients c JOIN private.users u ON u.id=c.user_id
    JOIN private.professionals p ON p.id=c.professional_id JOIN private.users pu ON pu.id=p.user_id
    LEFT JOIN private.subscriptions s ON s.professional_id=p.id
    WHERE c.id=target AND u.id::text=current_setting('app.subject_id',true) AND u.status='active' AND u.role='client'
      AND (NOT writable OR (c.status='active' AND pu.status='active' AND s.status='active' AND COALESCE(s.grace_until,s.expires_at)>CURRENT_TIMESTAMP)))
$$;
REVOKE ALL ON FUNCTION private.training_professional(uuid),private.training_client_access(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.training_professional(uuid),private.training_client_access(uuid,boolean) TO couchone_authentication;

CREATE TABLE private.training_plans (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  client_id uuid UNIQUE REFERENCES private.clients(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(id,client_id)
);
CREATE TABLE private.training_versions (
  id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES private.training_plans(id) ON DELETE RESTRICT,
  number integer NOT NULL CHECK(number>0), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  published boolean NOT NULL DEFAULT false, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(plan_id,number), UNIQUE(id,plan_id)
);
CREATE UNIQUE INDEX uk_training_draft ON private.training_versions(plan_id) WHERE NOT published;
CREATE TABLE private.training_days (
  version_id uuid NOT NULL REFERENCES private.training_versions(id) ON DELETE RESTRICT,
  id uuid NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0), kind text NOT NULL CHECK(kind IN ('training','rest')),
  PRIMARY KEY(version_id,id), UNIQUE(version_id,ordinal)
);
CREATE TABLE private.training_exercises (
  version_id uuid NOT NULL, day_id uuid NOT NULL, id uuid NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0),
  load_mode text NOT NULL CHECK(load_mode IN ('external','bodyweight')),
  PRIMARY KEY(version_id,id), UNIQUE(version_id,day_id,ordinal), UNIQUE(version_id,day_id,id),
  FOREIGN KEY(version_id,day_id) REFERENCES private.training_days(version_id,id) ON DELETE RESTRICT
);
CREATE TABLE private.training_sets (
  version_id uuid NOT NULL, exercise_id uuid NOT NULL, id uuid NOT NULL, ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 19),
  reps integer NOT NULL CHECK(reps BETWEEN 1 AND 100), rpe numeric(3,1) NOT NULL CHECK(rpe BETWEEN 1 AND 10 AND mod(rpe,0.5)=0),
  target_load_kg numeric(5,1) CHECK(target_load_kg BETWEEN 0 AND 1000),
  PRIMARY KEY(version_id,id), UNIQUE(version_id,exercise_id,ordinal),
  FOREIGN KEY(version_id,exercise_id) REFERENCES private.training_exercises(version_id,id) ON DELETE RESTRICT
);
CREATE TABLE private.training_active (
  client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL, version_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
  FOREIGN KEY(plan_id,client_id) REFERENCES private.training_plans(id,client_id) ON DELETE RESTRICT,
  FOREIGN KEY(version_id,plan_id) REFERENCES private.training_versions(id,plan_id) ON DELETE RESTRICT
);
CREATE TABLE private.training_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL, version_id uuid NOT NULL, activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  local_date date NOT NULL, time_zone text NOT NULL, revision integer NOT NULL,
  UNIQUE(client_id,revision), FOREIGN KEY(plan_id,client_id) REFERENCES private.training_plans(id,client_id) ON DELETE RESTRICT,
  FOREIGN KEY(version_id,plan_id) REFERENCES private.training_versions(id,plan_id) ON DELETE RESTRICT
);
CREATE INDEX idx_training_activations_date ON private.training_activations(client_id,local_date,revision DESC);
CREATE TABLE private.training_sessions (
  id uuid PRIMARY KEY, client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL, day_id uuid NOT NULL, local_date date NOT NULL, time_zone text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0), status text NOT NULL CHECK(status IN ('draft','finalized')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(client_id,local_date), UNIQUE(id,version_id),
  FOREIGN KEY(version_id,day_id) REFERENCES private.training_days(version_id,id) ON DELETE RESTRICT
);
CREATE TABLE private.training_results (
  session_id uuid NOT NULL, version_id uuid NOT NULL, set_id uuid NOT NULL,
  state text NOT NULL CHECK(state IN ('performed','not_performed')),
  reps integer NOT NULL, load_kg numeric(5,1), PRIMARY KEY(session_id,set_id),
  CHECK((state='not_performed' AND reps=0 AND load_kg IS NULL) OR (state='performed' AND reps BETWEEN 1 AND 1000 AND load_kg BETWEEN 0 AND 1000)),
  FOREIGN KEY(session_id,version_id) REFERENCES private.training_sessions(id,version_id) ON DELETE RESTRICT,
  FOREIGN KEY(version_id,set_id) REFERENCES private.training_sets(version_id,id) ON DELETE RESTRICT
);
CREATE TABLE private.training_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES private.clients(id) ON DELETE RESTRICT,
  action text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE private.training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY training_plans_read ON private.training_plans FOR SELECT TO couchone_authentication USING(private.training_professional(owner_id) OR private.training_client_access(client_id));
CREATE POLICY training_plans_write ON private.training_plans FOR INSERT TO couchone_authentication WITH CHECK(private.training_professional(owner_id) AND (client_id IS NULL OR EXISTS(SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=client_id AND p.user_id=owner_id)));

ALTER TABLE private.training_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.training_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.training_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.training_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.training_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_active_read ON private.training_active FOR SELECT TO couchone_authentication USING(private.training_client_access(client_id) OR EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id)));
CREATE POLICY training_active_write ON private.training_active FOR ALL TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id))) WITH CHECK(EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id)));
CREATE POLICY training_activations_read ON private.training_activations FOR SELECT TO couchone_authentication USING(private.training_client_access(client_id) OR EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id)));
CREATE POLICY training_activations_write ON private.training_activations FOR INSERT TO couchone_authentication WITH CHECK(EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id)));
CREATE POLICY training_session_read ON private.training_sessions FOR SELECT TO couchone_authentication USING(
 (private.training_client_access(client_id) AND local_date BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date-2 AND (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date)
 OR EXISTS(SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=client_id AND private.training_professional(p.user_id)));
CREATE POLICY training_session_write ON private.training_sessions FOR ALL TO couchone_authentication USING(private.training_client_access(client_id,true) AND local_date BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date-2 AND (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date)
 WITH CHECK(private.training_client_access(client_id,true) AND local_date BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date-2 AND (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date);
CREATE POLICY training_version_read ON private.training_versions FOR SELECT TO couchone_authentication USING(
 EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id))
 OR (published AND (EXISTS(SELECT 1 FROM private.training_active a WHERE a.version_id=training_versions.id AND private.training_client_access(a.client_id))
 OR EXISTS(SELECT 1 FROM private.training_sessions s WHERE s.version_id=training_versions.id AND private.training_client_access(s.client_id))
 OR EXISTS(SELECT 1 FROM private.training_activations a WHERE a.version_id=training_versions.id AND private.training_client_access(a.client_id) AND a.local_date >= (CURRENT_TIMESTAMP AT TIME ZONE a.time_zone)::date-2))));
CREATE POLICY training_version_write ON private.training_versions FOR ALL TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id))) WITH CHECK(EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id)));

DO $$ DECLARE item text; BEGIN
 FOREACH item IN ARRAY ARRAY['training_days','training_exercises','training_sets'] LOOP
  EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',item);
  EXECUTE format('CREATE POLICY training_structure_read ON private.%I FOR SELECT TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.training_versions v WHERE v.id=version_id))',item);
  EXECUTE format('CREATE POLICY training_structure_write ON private.%I FOR ALL TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.training_versions v JOIN private.training_plans p ON p.id=v.plan_id WHERE v.id=version_id AND NOT v.published AND private.training_professional(p.owner_id))) WITH CHECK(EXISTS(SELECT 1 FROM private.training_versions v JOIN private.training_plans p ON p.id=v.plan_id WHERE v.id=version_id AND NOT v.published AND private.training_professional(p.owner_id)))',item);
 END LOOP;
END $$;
CREATE POLICY training_result_read ON private.training_results FOR SELECT TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.training_sessions s WHERE s.id=session_id));
CREATE POLICY training_result_write ON private.training_results FOR ALL TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.training_sessions s WHERE s.id=session_id AND private.training_client_access(s.client_id,true))) WITH CHECK(EXISTS(SELECT 1 FROM private.training_sessions s WHERE s.id=session_id AND private.training_client_access(s.client_id,true)));
CREATE POLICY training_audit_read ON private.training_audit FOR SELECT TO couchone_authentication USING(private.training_professional(owner_id) OR EXISTS(SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id WHERE c.id=client_id AND private.training_professional(p.user_id)));
CREATE POLICY training_audit_insert ON private.training_audit FOR INSERT TO couchone_authentication WITH CHECK(owner_id::text=current_setting('app.subject_id',true) AND (private.training_professional(owner_id) OR private.training_client_access(client_id,true)));

GRANT SELECT,INSERT ON private.training_plans,private.training_activations,private.training_audit TO couchone_authentication;
GRANT SELECT,INSERT,UPDATE ON private.training_versions,private.training_active,private.training_sessions TO couchone_authentication;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.training_days,private.training_exercises,private.training_sets,private.training_results TO couchone_authentication;

CREATE FUNCTION private.guard_training_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.published OR NEW.id<>OLD.id OR NEW.plan_id<>OLD.plan_id OR NEW.number<>OLD.number OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Published training version is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Invalid training revision' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_version BEFORE UPDATE ON private.training_versions FOR EACH ROW EXECUTE FUNCTION private.guard_training_version();
CREATE FUNCTION private.guard_training_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.training_versions WHERE id=NEW.version_id AND published) THEN RAISE EXCEPTION 'Only published versions can be active' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_active BEFORE INSERT OR UPDATE ON private.training_active FOR EACH ROW EXECUTE FUNCTION private.guard_training_active();
CREATE FUNCTION private.guard_training_result() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mode text; BEGIN
 SELECT e.load_mode INTO mode FROM private.training_sessions s JOIN private.training_sets ps ON ps.version_id=s.version_id AND ps.id=NEW.set_id
 JOIN private.training_exercises e ON e.version_id=ps.version_id AND e.id=ps.exercise_id AND e.day_id=s.day_id WHERE s.id=NEW.session_id;
 IF mode IS NULL OR (NEW.state='performed' AND (NEW.load_kg IS NULL OR (mode='bodyweight' AND NEW.load_kg<>0) OR (mode='external' AND NEW.load_kg<=0))) THEN RAISE EXCEPTION 'Invalid prescribed set result' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_result BEFORE INSERT OR UPDATE ON private.training_results FOR EACH ROW EXECUTE FUNCTION private.guard_training_result();


-- Historical visibility covers the version in force at the beginning of the correction window.
DROP POLICY training_version_read ON private.training_versions;
CREATE POLICY training_version_read ON private.training_versions FOR SELECT TO couchone_authentication USING (
 EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id))
 OR (published AND (
 EXISTS(SELECT 1 FROM private.training_active a WHERE a.version_id=training_versions.id AND private.training_client_access(a.client_id))
 OR EXISTS(SELECT 1 FROM private.training_sessions s WHERE s.version_id=training_versions.id AND private.training_client_access(s.client_id))
 OR EXISTS(SELECT 1 FROM private.training_activations a WHERE a.version_id=training_versions.id AND private.training_client_access(a.client_id)
   AND (a.local_date >= (CURRENT_TIMESTAMP AT TIME ZONE a.time_zone)::date-2 OR NOT EXISTS(
     SELECT 1 FROM private.training_activations newer WHERE newer.client_id=a.client_id AND newer.revision>a.revision
     AND newer.local_date <= (CURRENT_TIMESTAMP AT TIME ZONE a.time_zone)::date-2))))));

CREATE FUNCTION private.guard_training_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE zone text; BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.client_id,NEW.version_id,NEW.day_id,NEW.local_date,NEW.time_zone,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.client_id,OLD.version_id,OLD.day_id,OLD.local_date,OLD.time_zone,OLD.created_at)
     OR NEW.revision<>OLD.revision+1 OR (OLD.status='finalized' AND NEW.status<>'finalized') THEN
   RAISE EXCEPTION 'Training session identity is immutable' USING ERRCODE='23514';
  END IF;
 ELSE
  SELECT time_zone INTO zone FROM private.clients WHERE id=NEW.client_id;
  IF NEW.time_zone IS DISTINCT FROM zone OR NEW.revision<>1 OR NOT EXISTS(
   SELECT 1 FROM private.training_versions v JOIN private.training_plans p ON p.id=v.plan_id
   JOIN private.training_days d ON d.version_id=v.id WHERE v.id=NEW.version_id AND p.client_id=NEW.client_id
   AND v.published AND d.id=NEW.day_id AND d.kind='training') THEN
   RAISE EXCEPTION 'Invalid training session prescription' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_session BEFORE INSERT OR UPDATE ON private.training_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_training_session();

-- Deferred: the session and its full result set are written together in one transaction.
CREATE FUNCTION private.check_training_finalization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; expected integer; actual integer; s private.training_sessions%ROWTYPE; BEGIN
 IF TG_TABLE_NAME='training_sessions' THEN target:=NEW.id;
 ELSIF TG_OP='DELETE' THEN target:=OLD.session_id; ELSE target:=NEW.session_id; END IF;
 SELECT * INTO s FROM private.training_sessions WHERE id=target;
 IF s.status='finalized' THEN
  SELECT count(*) INTO expected FROM private.training_sets ps JOIN private.training_exercises e ON e.version_id=ps.version_id AND e.id=ps.exercise_id WHERE e.version_id=s.version_id AND e.day_id=s.day_id;
  SELECT count(*) INTO actual FROM private.training_results WHERE session_id=target;
  IF expected=0 OR expected<>actual THEN RAISE EXCEPTION 'Finalized training session requires every prescribed set' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_training_finalization AFTER INSERT OR UPDATE ON private.training_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_training_finalization();
CREATE CONSTRAINT TRIGGER check_training_results_finalization AFTER INSERT OR UPDATE OR DELETE ON private.training_results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_training_finalization();

CREATE FUNCTION private.guard_training_target_load() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mode text; BEGIN
 SELECT load_mode INTO mode FROM private.training_exercises WHERE version_id=NEW.version_id AND id=NEW.exercise_id;
 IF NEW.target_load_kg IS NOT NULL AND ((mode='bodyweight' AND NEW.target_load_kg<>0) OR (mode='external' AND NEW.target_load_kg<=0)) THEN
  RAISE EXCEPTION 'Invalid prescribed target load' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_target_load BEFORE INSERT OR UPDATE ON private.training_sets FOR EACH ROW EXECUTE FUNCTION private.guard_training_target_load();

-- EP-06: rep ranges, optional RPE/RIR, prescribed rest, and real effort per performed set.
ALTER TABLE private.training_exercises ADD COLUMN rest_seconds integer CONSTRAINT ck_training_exercises_rest CHECK(rest_seconds BETWEEN 0 AND 900);
ALTER TABLE private.training_sets ALTER COLUMN rpe DROP NOT NULL;
ALTER TABLE private.training_sets ADD COLUMN reps_max integer, ADD COLUMN rir smallint CONSTRAINT ck_training_sets_rir CHECK(rir BETWEEN 0 AND 10),
  ADD CONSTRAINT ck_training_sets_reps_range CHECK(reps_max IS NULL OR reps_max BETWEEN reps AND 100);
ALTER TABLE private.training_results ADD COLUMN rpe numeric(3,1) CONSTRAINT ck_training_results_rpe CHECK(rpe BETWEEN 1 AND 10 AND mod(rpe,0.5)=0),
  ADD COLUMN rir smallint CONSTRAINT ck_training_results_rir CHECK(rir BETWEEN 0 AND 10),
  ADD CONSTRAINT ck_training_results_effort CHECK(state='performed' OR (rpe IS NULL AND rir IS NULL));

-- EP-06: prescribed set type (warm-up, working, top set, back-off, drop set, to failure).
ALTER TABLE private.training_sets ADD COLUMN kind text NOT NULL DEFAULT 'working'
  CONSTRAINT ck_training_sets_kind CHECK(kind IN ('warmup','working','top','backoff','drop','failure'));

-- EP-04 HU-021: append-only historical anthropometric evaluations.
CREATE TABLE private.client_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  evaluation_date date NOT NULL DEFAULT (timezone('UTC', clock_timestamp())::date),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  weight_kg numeric,
  waist_cm numeric,
  hip_cm numeric,
  measured_body_fat_percentage numeric,
  pectoral_skinfold_mm numeric,
  abdominal_skinfold_mm numeric,
  triceps_skinfold_mm numeric,
  suprailiac_skinfold_mm numeric,
  thigh_skinfold_mm numeric,
  CONSTRAINT ck_client_evaluations_nonempty CHECK (num_nonnulls(
    weight_kg, waist_cm, hip_cm, measured_body_fat_percentage,
    pectoral_skinfold_mm, abdominal_skinfold_mm, triceps_skinfold_mm,
    suprailiac_skinfold_mm, thigh_skinfold_mm
  ) >= 1),
  CONSTRAINT ck_client_evaluations_weight CHECK (
    weight_kg IS NULL OR (weight_kg BETWEEN 30 AND 300 AND weight_kg = round(weight_kg, 1))
  ),
  CONSTRAINT ck_client_evaluations_waist CHECK (
    waist_cm IS NULL OR (waist_cm BETWEEN 40 AND 250 AND waist_cm = round(waist_cm, 1))
  ),
  CONSTRAINT ck_client_evaluations_hip CHECK (
    hip_cm IS NULL OR (hip_cm BETWEEN 50 AND 250 AND hip_cm = round(hip_cm, 1))
  ),
  CONSTRAINT ck_client_evaluations_measured_body_fat CHECK (
    measured_body_fat_percentage IS NULL OR (measured_body_fat_percentage BETWEEN 2 AND 60 AND measured_body_fat_percentage = round(measured_body_fat_percentage, 1))
  ),
  CONSTRAINT ck_client_evaluations_pectoral_skinfold CHECK (
    pectoral_skinfold_mm IS NULL OR (pectoral_skinfold_mm BETWEEN 1 AND 80 AND pectoral_skinfold_mm = round(pectoral_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_abdominal_skinfold CHECK (
    abdominal_skinfold_mm IS NULL OR (abdominal_skinfold_mm BETWEEN 1 AND 80 AND abdominal_skinfold_mm = round(abdominal_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_triceps_skinfold CHECK (
    triceps_skinfold_mm IS NULL OR (triceps_skinfold_mm BETWEEN 1 AND 80 AND triceps_skinfold_mm = round(triceps_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_suprailiac_skinfold CHECK (
    suprailiac_skinfold_mm IS NULL OR (suprailiac_skinfold_mm BETWEEN 1 AND 80 AND suprailiac_skinfold_mm = round(suprailiac_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_thigh_skinfold CHECK (
    thigh_skinfold_mm IS NULL OR (thigh_skinfold_mm BETWEEN 1 AND 80 AND thigh_skinfold_mm = round(thigh_skinfold_mm, 1))
  )
);
CREATE INDEX ix_client_evaluations_client_date
  ON private.client_evaluations(client_id, evaluation_date DESC, created_at DESC, id DESC);
REVOKE ALL ON TABLE private.client_evaluations FROM PUBLIC, couchone_authentication;
GRANT SELECT ON TABLE private.client_evaluations TO couchone_authentication;
GRANT INSERT(
  client_id, weight_kg, waist_cm, hip_cm, measured_body_fat_percentage,
  pectoral_skinfold_mm, abdominal_skinfold_mm, triceps_skinfold_mm,
  suprailiac_skinfold_mm, thigh_skinfold_mm
) ON TABLE private.client_evaluations TO couchone_authentication;
ALTER TABLE private.client_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_evaluations_read ON private.client_evaluations
  FOR SELECT TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    WHERE c.id=client_evaluations.client_id AND private.training_professional(p.user_id)
  ));
CREATE POLICY client_evaluations_insert ON private.client_evaluations
  FOR INSERT TO couchone_authentication
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    WHERE c.id=client_evaluations.client_id AND c.status='active' AND private.training_professional(p.user_id)
  ));
-- HU-021 scope extension. Existing columns and historical rows retain their meaning.
-- NULL assessment means legacy/unknown method; never infer provenance or recalculate it.
ALTER TABLE private.client_evaluations ADD COLUMN assessment jsonb;
ALTER TABLE private.client_evaluations DROP CONSTRAINT ck_client_evaluations_nonempty;
ALTER TABLE private.client_evaluations ADD CONSTRAINT ck_client_evaluations_nonempty CHECK (
  num_nonnulls(weight_kg,waist_cm,hip_cm,measured_body_fat_percentage,pectoral_skinfold_mm,
    abdominal_skinfold_mm,triceps_skinfold_mm,suprailiac_skinfold_mm,thigh_skinfold_mm)>=1
  OR assessment IS NOT NULL
);
ALTER TABLE private.client_evaluations ADD CONSTRAINT ck_client_evaluations_assessment CHECK (
  assessment IS NULL OR COALESCE((
    jsonb_typeof(assessment)='object'
    AND assessment ?& ARRAY['protocol','method','effectiveDate','ownerId','version','calculationStatus','provenance','measurements','results','equation','birthDate','ageYears']
    AND assessment->>'method' IN ('circumference','skinfolds','bioimpedance')
    AND assessment->>'equation' IN ('male','female','not_applicable')
    AND assessment->>'version' IN ('composition-arithmetic-v1','composition-estimation-v1','composition-candidate-v1')
    AND assessment->>'calculationStatus' IN ('available','partial','pending_verification')
    AND assessment->>'provenance' IN ('device_reported','manual_measurements')
    AND jsonb_typeof(assessment->'ownerId')='string'
    AND jsonb_typeof(assessment->'protocol')='string'
    AND assessment->>'protocol'<>''
    AND jsonb_typeof(assessment->'measurements')='object'
    AND assessment->'measurements'<>'{}'::jsonb
    AND jsonb_typeof(assessment->'results')='object'
    AND NOT jsonb_path_exists(assessment, '$.measurements.* ? (@.type() != "number" || @ <= 0)')
    AND NOT jsonb_path_exists(assessment, '$.results.* ? (@.type() != "number")')
    AND jsonb_typeof(assessment->'effectiveDate')='string'
    AND (assessment->>'effectiveDate')::date <= timezone('UTC',clock_timestamp())::date
    AND (assessment->>'method'='bioimpedance' OR (
      assessment->>'calculationStatus'='pending_verification'
      AND NOT (assessment->'results' ?| ARRAY['bodyFatPercentage','density','fatMassKg','fatFreeMassKg'])
    ))
  ), false)
);
GRANT INSERT(assessment) ON private.client_evaluations TO couchone_authentication;
-- Restrictive policies complement the existing ownership/elegibility policies.
CREATE POLICY client_evaluations_snapshot_owner ON private.client_evaluations AS RESTRICTIVE
  FOR INSERT TO couchone_authentication
  WITH CHECK (assessment IS NULL OR assessment->>'ownerId'=current_setting('app.subject_id',true));
-- No UPDATE/DELETE grant. Original rows, date defaults, indices and read RLS preserved.

-- HU-021: align snapshot measurement invariants with the authorized API contract.
-- No data rewrite, formula execution, grants or policy changes. NULL remains legacy.
-- Existing inconsistent snapshots cause migration rollback; never normalize history.
ALTER TABLE private.client_evaluations
  ADD CONSTRAINT ck_client_evaluations_snapshot_measurements CHECK (
    assessment IS NULL OR COALESCE((
      CASE assessment->>'method'
      WHEN 'circumference' THEN (assessment->'measurements') - ARRAY['weightKg','heightCm','neckCm','waistCm','abdomenUmbilicalCm','hipCm'] = '{}'::jsonb
      WHEN 'skinfolds' THEN (assessment->'measurements') - ARRAY['weightKg','heightCm','tricepsSkinfoldMm','bicepsSkinfoldMm','subscapularSkinfoldMm','suprailiacSkinfoldMm','pectoralSkinfoldMm','abdominalSkinfoldMm','thighSkinfoldMm'] = '{}'::jsonb
      WHEN 'bioimpedance' THEN (assessment->'measurements') - ARRAY['weightKg','heightCm','measuredBodyFatPercentage','muscleMassKg','waterLitres','visceralFatIndex'] = '{}'::jsonb
      ELSE false END
      AND (assessment->'measurements') - ARRAY['weightKg','heightCm'] <> '{}'::jsonb
      AND (NOT ((assessment->'measurements') ? 'abdomenUmbilicalCm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'abdomenUmbilicalCm')='number' THEN ((assessment->'measurements')->>'abdomenUmbilicalCm')::numeric > 0 AND ((assessment->'measurements')->>'abdomenUmbilicalCm')::numeric=round(((assessment->'measurements')->>'abdomenUmbilicalCm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'abdominalSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'abdominalSkinfoldMm')='number' THEN ((assessment->'measurements')->>'abdominalSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'abdominalSkinfoldMm')::numeric=round(((assessment->'measurements')->>'abdominalSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'bicepsSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'bicepsSkinfoldMm')='number' THEN ((assessment->'measurements')->>'bicepsSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'bicepsSkinfoldMm')::numeric=round(((assessment->'measurements')->>'bicepsSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'heightCm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'heightCm')='number' THEN ((assessment->'measurements')->>'heightCm')::numeric BETWEEN 100 AND 250 AND ((assessment->'measurements')->>'heightCm')::numeric=round(((assessment->'measurements')->>'heightCm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'hipCm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'hipCm')='number' THEN ((assessment->'measurements')->>'hipCm')::numeric BETWEEN 50 AND 250 AND ((assessment->'measurements')->>'hipCm')::numeric=round(((assessment->'measurements')->>'hipCm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'measuredBodyFatPercentage') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'measuredBodyFatPercentage')='number' THEN ((assessment->'measurements')->>'measuredBodyFatPercentage')::numeric BETWEEN 2 AND 60 AND ((assessment->'measurements')->>'measuredBodyFatPercentage')::numeric=round(((assessment->'measurements')->>'measuredBodyFatPercentage')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'muscleMassKg') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'muscleMassKg')='number' THEN ((assessment->'measurements')->>'muscleMassKg')::numeric > 0 AND ((assessment->'measurements')->>'muscleMassKg')::numeric=round(((assessment->'measurements')->>'muscleMassKg')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'neckCm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'neckCm')='number' THEN ((assessment->'measurements')->>'neckCm')::numeric > 0 AND ((assessment->'measurements')->>'neckCm')::numeric=round(((assessment->'measurements')->>'neckCm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'pectoralSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'pectoralSkinfoldMm')='number' THEN ((assessment->'measurements')->>'pectoralSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'pectoralSkinfoldMm')::numeric=round(((assessment->'measurements')->>'pectoralSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'subscapularSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'subscapularSkinfoldMm')='number' THEN ((assessment->'measurements')->>'subscapularSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'subscapularSkinfoldMm')::numeric=round(((assessment->'measurements')->>'subscapularSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'suprailiacSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'suprailiacSkinfoldMm')='number' THEN ((assessment->'measurements')->>'suprailiacSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'suprailiacSkinfoldMm')::numeric=round(((assessment->'measurements')->>'suprailiacSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'thighSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'thighSkinfoldMm')='number' THEN ((assessment->'measurements')->>'thighSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'thighSkinfoldMm')::numeric=round(((assessment->'measurements')->>'thighSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'tricepsSkinfoldMm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'tricepsSkinfoldMm')='number' THEN ((assessment->'measurements')->>'tricepsSkinfoldMm')::numeric BETWEEN 1 AND 80 AND ((assessment->'measurements')->>'tricepsSkinfoldMm')::numeric=round(((assessment->'measurements')->>'tricepsSkinfoldMm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'visceralFatIndex') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'visceralFatIndex')='number' THEN ((assessment->'measurements')->>'visceralFatIndex')::numeric > 0 AND ((assessment->'measurements')->>'visceralFatIndex')::numeric=round(((assessment->'measurements')->>'visceralFatIndex')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'waistCm') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'waistCm')='number' THEN ((assessment->'measurements')->>'waistCm')::numeric BETWEEN 40 AND 250 AND ((assessment->'measurements')->>'waistCm')::numeric=round(((assessment->'measurements')->>'waistCm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'waterLitres') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'waterLitres')='number' THEN ((assessment->'measurements')->>'waterLitres')::numeric > 0 AND ((assessment->'measurements')->>'waterLitres')::numeric=round(((assessment->'measurements')->>'waterLitres')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR CASE WHEN jsonb_typeof((assessment->'measurements')->'weightKg')='number' THEN ((assessment->'measurements')->>'weightKg')::numeric BETWEEN 30 AND 300 AND ((assessment->'measurements')->>'weightKg')::numeric=round(((assessment->'measurements')->>'weightKg')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT ((assessment->'measurements') ? 'muscleMassKg') OR ((assessment->'measurements')->>'muscleMassKg')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT ((assessment->'measurements') ? 'waterLitres') OR ((assessment->'measurements')->>'waterLitres')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
      AND (NOT (assessment ? 'segmental') OR COALESCE((
      assessment->>'method'='bioimpedance'
      AND jsonb_typeof((assessment->'segmental'))='object'
      AND (assessment->'segmental') - ARRAY['type','unit','values'] = '{}'::jsonb
      AND (assessment->'segmental')->>'type' IN ('muscle_mass','fat_mass')
      AND (assessment->'segmental')->>'unit'='kg'
      AND jsonb_typeof(((assessment->'segmental')->'values'))='object'
      AND ((assessment->'segmental')->'values') - ARRAY['leftArm','rightArm','trunk','leftLeg','rightLeg'] = '{}'::jsonb
      AND (NOT (((assessment->'segmental')->'values') ? 'leftArm') OR CASE WHEN jsonb_typeof(((assessment->'segmental')->'values')->'leftArm')='number' THEN (((assessment->'segmental')->'values')->>'leftArm')::numeric > 0 AND (((assessment->'segmental')->'values')->>'leftArm')::numeric=round((((assessment->'segmental')->'values')->>'leftArm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT (((assessment->'segmental')->'values') ? 'leftArm') OR (((assessment->'segmental')->'values')->>'leftArm')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
      AND (NOT (((assessment->'segmental')->'values') ? 'rightArm') OR CASE WHEN jsonb_typeof(((assessment->'segmental')->'values')->'rightArm')='number' THEN (((assessment->'segmental')->'values')->>'rightArm')::numeric > 0 AND (((assessment->'segmental')->'values')->>'rightArm')::numeric=round((((assessment->'segmental')->'values')->>'rightArm')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT (((assessment->'segmental')->'values') ? 'rightArm') OR (((assessment->'segmental')->'values')->>'rightArm')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
      AND (NOT (((assessment->'segmental')->'values') ? 'trunk') OR CASE WHEN jsonb_typeof(((assessment->'segmental')->'values')->'trunk')='number' THEN (((assessment->'segmental')->'values')->>'trunk')::numeric > 0 AND (((assessment->'segmental')->'values')->>'trunk')::numeric=round((((assessment->'segmental')->'values')->>'trunk')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT (((assessment->'segmental')->'values') ? 'trunk') OR (((assessment->'segmental')->'values')->>'trunk')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
      AND (NOT (((assessment->'segmental')->'values') ? 'leftLeg') OR CASE WHEN jsonb_typeof(((assessment->'segmental')->'values')->'leftLeg')='number' THEN (((assessment->'segmental')->'values')->>'leftLeg')::numeric > 0 AND (((assessment->'segmental')->'values')->>'leftLeg')::numeric=round((((assessment->'segmental')->'values')->>'leftLeg')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT (((assessment->'segmental')->'values') ? 'leftLeg') OR (((assessment->'segmental')->'values')->>'leftLeg')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
      AND (NOT (((assessment->'segmental')->'values') ? 'rightLeg') OR CASE WHEN jsonb_typeof(((assessment->'segmental')->'values')->'rightLeg')='number' THEN (((assessment->'segmental')->'values')->>'rightLeg')::numeric > 0 AND (((assessment->'segmental')->'values')->>'rightLeg')::numeric=round((((assessment->'segmental')->'values')->>'rightLeg')::numeric,1) ELSE false END)
      AND (NOT ((assessment->'measurements') ? 'weightKg') OR NOT (((assessment->'segmental')->'values') ? 'rightLeg') OR (((assessment->'segmental')->'values')->>'rightLeg')::numeric <= ((assessment->'measurements')->>'weightKg')::numeric)
    ),false))
      AND (((assessment->'measurements')->>'weightKg')::numeric IS NOT DISTINCT FROM weight_kg)
      AND (((assessment->'measurements')->>'waistCm')::numeric IS NOT DISTINCT FROM waist_cm)
      AND (((assessment->'measurements')->>'hipCm')::numeric IS NOT DISTINCT FROM hip_cm)
      AND (((assessment->'measurements')->>'measuredBodyFatPercentage')::numeric IS NOT DISTINCT FROM measured_body_fat_percentage)
      AND (((assessment->'measurements')->>'pectoralSkinfoldMm')::numeric IS NOT DISTINCT FROM pectoral_skinfold_mm)
      AND (((assessment->'measurements')->>'abdominalSkinfoldMm')::numeric IS NOT DISTINCT FROM abdominal_skinfold_mm)
      AND (((assessment->'measurements')->>'tricepsSkinfoldMm')::numeric IS NOT DISTINCT FROM triceps_skinfold_mm)
      AND (((assessment->'measurements')->>'suprailiacSkinfoldMm')::numeric IS NOT DISTINCT FROM suprailiac_skinfold_mm)
      AND (((assessment->'measurements')->>'thighSkinfoldMm')::numeric IS NOT DISTINCT FROM thigh_skinfold_mm)
    ),false)
  );

-- HU-023: pending technical references only.

ALTER TABLE private.client_evaluations
  ADD CONSTRAINT ck_client_evaluations_pending_estimation CHECK (
    assessment IS NULL OR assessment->>'version' IN ('composition-arithmetic-v1','composition-candidate-v1') OR COALESCE((
      assessment->>'version'='composition-estimation-v1'
      AND assessment->>'method'='skinfolds'
      AND assessment->>'protocol'='jp3-sites-pending@technical-reference-v1'
      AND assessment->>'calculationStatus'='pending_verification'
      AND assessment->>'provenance'='manual_measurements'
      AND assessment->'results'='{}'::jsonb
      AND assessment->'estimation'=jsonb_build_object(
        'schemaVersion',1,
        'methodId','jackson-pollock-3-siri',
        'variant',NULLIF(assessment->>'equation','not_applicable'),
        'formulaVersion',NULL,'domainPolicyVersion',NULL,
        'protocol',jsonb_build_object('id','jp3-sites-pending','version','technical-reference-v1'),
        'provenance','server_estimation',
        'inputs',jsonb_build_object(
          'effectiveDate',assessment->>'effectiveDate',
          'ageYears',assessment->'ageYears',
          'unit','mm',
          'skinfolds',CASE WHEN assessment->>'equation'='not_applicable' THEN '{}'::jsonb
                          ELSE (assessment->'measurements') - ARRAY['weightKg','heightCm'] END),
        'status','unavailable','result',NULL,
        'reasons',jsonb_build_array(jsonb_build_object('code','scientific_verification_pending','fields','[]'::jsonb))
      )
    ),false)
  );

-- Local technical candidates remain distinct from scientifically available results.
ALTER TABLE private.client_evaluations
  ADD CONSTRAINT ck_client_evaluations_candidate_estimation CHECK (
    assessment IS NULL OR assessment->>'version'<>'composition-candidate-v1' OR COALESCE((
      assessment->>'method'='skinfolds'
      AND assessment->>'protocol' IN ('jp3-male-candidate@technical-candidate-v1','jp3-female-candidate@technical-candidate-v1')
      AND (assessment->>'equation'='not_applicable' OR assessment->>'protocol'=CASE assessment->>'equation' WHEN 'male' THEN 'jp3-male-candidate@technical-candidate-v1' ELSE 'jp3-female-candidate@technical-candidate-v1' END)
      AND assessment->>'calculationStatus'='pending_verification'
      AND assessment->>'provenance'='manual_measurements'
      AND assessment->'results'='{}'::jsonb
      AND (assessment->'estimation') - ARRAY['status','inputs','result','reasons'] = jsonb_build_object(
        'schemaVersion',1,'methodId','jackson-pollock-3-siri',
        'variant',NULLIF(assessment->>'equation','not_applicable'),
        'formulaVersion',NULL,'domainPolicyVersion',NULL,
        'technicalFormulaVersion','jp3-siri-arithmetic-candidate-v1',
        'technicalDomainVersion','jp3-reference-ranges-candidate-v1',
        'scientificStatus','not_validated','activationAllowed',false,
        'protocol',jsonb_build_object('id',split_part(assessment->>'protocol','@',1),'version','technical-candidate-v1'),
        'provenance','server_estimation',
        'blockers',to_jsonb(ARRAY['scientific_verification_pending','domain_approval_pending','protocol_approval_pending','independent_reference_cases_pending']::text[]
          || CASE WHEN assessment->>'equation'='female' THEN ARRAY['female_equation_original_pending']::text[] ELSE ARRAY[]::text[] END
          || CASE WHEN assessment->>'equation'='female' AND (assessment->>'ageYears')::numeric>40 THEN ARRAY['female_over_40_caution_pending']::text[] ELSE ARRAY[]::text[] END)
      )
      AND (assessment->'estimation')->'inputs' = jsonb_build_object(
        'effectiveDate',assessment->>'effectiveDate','ageYears',assessment->'ageYears','unit','mm',
        'skinfolds',CASE
          WHEN assessment->>'equation'='not_applicable' THEN '{}'::jsonb
          WHEN (assessment->'estimation')->>'status'='candidate_only' AND assessment->>'equation'='male' THEN jsonb_build_object(
            'pectoralSkinfoldMm',(assessment->'measurements')->'pectoralSkinfoldMm',
            'abdominalSkinfoldMm',(assessment->'measurements')->'abdominalSkinfoldMm',
            'thighSkinfoldMm',(assessment->'measurements')->'thighSkinfoldMm')
          WHEN (assessment->'estimation')->>'status'='candidate_only' THEN jsonb_build_object(
            'tricepsSkinfoldMm',(assessment->'measurements')->'tricepsSkinfoldMm',
            'suprailiacSkinfoldMm',(assessment->'measurements')->'suprailiacSkinfoldMm',
            'thighSkinfoldMm',(assessment->'measurements')->'thighSkinfoldMm')
          ELSE (assessment->'measurements') - ARRAY['weightKg','heightCm'] END)
      AND (
        ((assessment->'estimation')->>'status'='unavailable'
          AND (assessment->'estimation')->'result'='null'::jsonb
          AND jsonb_typeof((assessment->'estimation')->'reasons')='array'
          AND jsonb_array_length((assessment->'estimation')->'reasons')=1
          AND ((assessment->'estimation')->'reasons'->0) - ARRAY['code','fields']='{}'::jsonb
          AND (assessment->'estimation')->'reasons'->0->>'code' IN ('candidate_execution_disabled','invalid_input','equation_not_selected','invalid_effective_date','invalid_birth_date','age_unavailable','outside_reference_age_range','invalid_measurements','missing_measurements','non_finite_calculation','invalid_density','invalid_estimated_percentage')
          AND jsonb_typeof((assessment->'estimation')->'reasons'->0->'fields')='array'
          AND NOT jsonb_path_exists((assessment->'estimation')->'reasons'->0->'fields','$[*] ? (@.type() != "string")'))
        OR ((assessment->'estimation')->>'status'='candidate_only'
          AND assessment->>'equation' IN ('male','female')
          AND CASE WHEN jsonb_typeof(assessment->'ageYears')='number' THEN (assessment->>'ageYears')::numeric BETWEEN 18 AND CASE WHEN assessment->>'equation'='male' THEN 61 ELSE 55 END ELSE false END
          AND NOT jsonb_path_exists((assessment->'estimation')->'inputs'->'skinfolds','$.* ? (@.type() != "number")')
          AND (assessment->'estimation')->'reasons'='[]'::jsonb
          AND jsonb_typeof((assessment->'estimation')->'result')='object'
          AND (assessment->'estimation')->'result' ?& ARRAY['sumSkinfoldMm','bodyDensityGPerMl','estimatedBodyFatPercentage']
          AND ((assessment->'estimation')->'result') - ARRAY['sumSkinfoldMm','bodyDensityGPerMl','estimatedBodyFatPercentage']='{}'::jsonb
          AND NOT jsonb_path_exists((assessment->'estimation')->'result','$.* ? (@.type() != "number" || @ <= 0)')
          AND CASE WHEN jsonb_typeof((assessment->'estimation')->'result'->'estimatedBodyFatPercentage')='number' THEN ((assessment->'estimation')->'result'->>'estimatedBodyFatPercentage')::numeric < 100 ELSE false END)
      )
    ),false)
  );

-- Migration: Nutrition Plans & Activations (HU-024, HU-026, HU-027)
CREATE FUNCTION private.nutrition_professional(owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT EXISTS(SELECT 1 FROM private.users u JOIN private.professionals p ON p.user_id=u.id
    JOIN private.subscriptions s ON s.professional_id=p.id
    WHERE u.id=owner AND u.id::text=current_setting('app.subject_id',true) AND u.role='professional' AND u.status='active'
      AND s.status='active' AND COALESCE(s.grace_until,s.expires_at)>CURRENT_TIMESTAMP)
$$;

CREATE FUNCTION private.nutrition_client_access(target uuid, writable boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
  SELECT EXISTS(SELECT 1 FROM private.clients c JOIN private.users u ON u.id=c.user_id
    JOIN private.professionals p ON p.id=c.professional_id JOIN private.users pu ON pu.id=p.user_id
    LEFT JOIN private.subscriptions s ON s.professional_id=p.id
    WHERE c.id=target AND u.id::text=current_setting('app.subject_id',true) AND u.status='active' AND u.role='client'
      AND (NOT writable OR (c.status='active' AND pu.status='active' AND s.status='active' AND COALESCE(s.grace_until,s.expires_at)>CURRENT_TIMESTAMP)))
$$;

REVOKE ALL ON FUNCTION private.nutrition_professional(uuid),private.nutrition_client_access(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.nutrition_professional(uuid),private.nutrition_client_access(uuid,boolean) TO couchone_authentication;

CREATE TABLE private.nutrition_plans (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  client_id uuid UNIQUE REFERENCES private.clients(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id, client_id)
);

CREATE TABLE private.nutrition_versions (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES private.nutrition_plans(id) ON DELETE RESTRICT,
  number integer NOT NULL CHECK(number > 0),
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  published boolean NOT NULL DEFAULT false,
  document jsonb NOT NULL CHECK(jsonb_typeof(document) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(plan_id, number),
  UNIQUE(id, plan_id)
);

CREATE UNIQUE INDEX uk_nutrition_draft ON private.nutrition_versions(plan_id) WHERE NOT published;

CREATE TABLE private.nutrition_meals (
  version_id uuid NOT NULL REFERENCES private.nutrition_versions(id) ON DELETE RESTRICT,
  id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal >= 0),
  name text NOT NULL,
  instructions text,
  PRIMARY KEY(version_id, id),
  UNIQUE(version_id, ordinal)
);

CREATE TABLE private.nutrition_items (
  version_id uuid NOT NULL,
  meal_id uuid NOT NULL,
  id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal >= 0),
  name text NOT NULL,
  quantity numeric NOT NULL CHECK(quantity >= 0),
  unit text NOT NULL,
  instructions text,
  PRIMARY KEY(version_id, id),
  UNIQUE(version_id, meal_id, ordinal),
  FOREIGN KEY(version_id, meal_id) REFERENCES private.nutrition_meals(version_id, id) ON DELETE RESTRICT
);

CREATE TABLE private.nutrition_active (
  client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL,
  version_id uuid NOT NULL,
  revision integer NOT NULL CHECK(revision > 0),
  FOREIGN KEY(plan_id, client_id) REFERENCES private.nutrition_plans(id, client_id) ON DELETE RESTRICT,
  FOREIGN KEY(version_id, plan_id) REFERENCES private.nutrition_versions(id, plan_id) ON DELETE RESTRICT
);

CREATE TABLE private.nutrition_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL,
  version_id uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  local_date date NOT NULL,
  time_zone text NOT NULL,
  revision integer NOT NULL,
  UNIQUE(client_id, revision),
  FOREIGN KEY(plan_id, client_id) REFERENCES private.nutrition_plans(id, client_id) ON DELETE RESTRICT,
  FOREIGN KEY(version_id, plan_id) REFERENCES private.nutrition_versions(id, plan_id) ON DELETE RESTRICT
);

CREATE INDEX idx_nutrition_activations_date ON private.nutrition_activations(client_id, local_date, revision DESC);

ALTER TABLE private.nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_plans_read ON private.nutrition_plans FOR SELECT TO couchone_authentication USING(private.nutrition_professional(owner_id) OR private.nutrition_client_access(client_id));

ALTER TABLE private.nutrition_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_versions_read ON private.nutrition_versions FOR SELECT TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.nutrition_plans p WHERE p.id=plan_id AND (private.nutrition_professional(p.owner_id) OR (private.nutrition_client_access(p.client_id) AND published))));

ALTER TABLE private.nutrition_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_meals_read ON private.nutrition_meals FOR SELECT TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.nutrition_versions v JOIN private.nutrition_plans p ON p.id=v.plan_id WHERE v.id=version_id AND (private.nutrition_professional(p.owner_id) OR (private.nutrition_client_access(p.client_id) AND published))));

ALTER TABLE private.nutrition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_items_read ON private.nutrition_items FOR SELECT TO couchone_authentication USING(EXISTS(SELECT 1 FROM private.nutrition_versions v JOIN private.nutrition_plans p ON p.id=v.plan_id WHERE v.id=version_id AND (private.nutrition_professional(p.owner_id) OR (private.nutrition_client_access(p.client_id) AND published))));

ALTER TABLE private.nutrition_active ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_active_read ON private.nutrition_active FOR SELECT TO couchone_authentication
  USING(EXISTS(SELECT 1 FROM private.nutrition_plans p WHERE p.client_id=nutrition_active.client_id AND (private.nutrition_professional(p.owner_id) OR private.nutrition_client_access(p.client_id))));

ALTER TABLE private.nutrition_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrition_activations_read ON private.nutrition_activations FOR SELECT TO couchone_authentication
  USING(EXISTS(SELECT 1 FROM private.nutrition_plans p WHERE p.client_id=nutrition_activations.client_id AND (private.nutrition_professional(p.owner_id) OR private.nutrition_client_access(p.client_id))));

-- Restore the restricted API role's access to client nutrition plans.
CREATE FUNCTION private.nutrition_can_write(owner uuid, target uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, private
AS $$
  SELECT private.nutrition_professional(owner) AND EXISTS (
    SELECT 1 FROM private.clients c
    JOIN private.professionals p ON p.id = c.professional_id
    WHERE c.id = target AND p.user_id = owner AND c.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION private.nutrition_can_write(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.nutrition_can_write(uuid, uuid) TO couchone_authentication;

GRANT SELECT ON private.nutrition_plans, private.nutrition_versions,
  private.nutrition_meals, private.nutrition_items, private.nutrition_active
  TO couchone_authentication;
GRANT INSERT (id, owner_id, client_id) ON private.nutrition_plans TO couchone_authentication;
GRANT INSERT (id, plan_id, number, document), UPDATE (document, revision, published)
  ON private.nutrition_versions TO couchone_authentication;
GRANT INSERT, DELETE ON private.nutrition_meals, private.nutrition_items TO couchone_authentication;
GRANT INSERT, UPDATE (plan_id, version_id, revision) ON private.nutrition_active TO couchone_authentication;
GRANT INSERT (client_id, plan_id, version_id, activated_at, local_date, time_zone, revision)
  ON private.nutrition_activations TO couchone_authentication;

CREATE POLICY nutrition_plans_insert ON private.nutrition_plans
  FOR INSERT TO couchone_authentication
  WITH CHECK (private.nutrition_can_write(owner_id, client_id));

ALTER POLICY nutrition_versions_read ON private.nutrition_versions
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id
      AND (private.nutrition_professional(p.owner_id)
        OR (nutrition_versions.published AND private.nutrition_client_access(p.client_id)
          AND EXISTS (
            SELECT 1 FROM private.nutrition_active a
            WHERE a.client_id = p.client_id AND a.version_id = nutrition_versions.id
          )))
  ));

CREATE POLICY nutrition_versions_insert ON private.nutrition_versions
  FOR INSERT TO couchone_authentication
  WITH CHECK (NOT published AND EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_versions_update ON private.nutrition_versions
  FOR UPDATE TO couchone_authentication
  USING (NOT published AND EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id AND private.nutrition_can_write(p.owner_id, p.client_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_versions.plan_id AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_meals_write ON private.nutrition_meals
  FOR ALL TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_versions v
    JOIN private.nutrition_plans p ON p.id = v.plan_id
    WHERE v.id = nutrition_meals.version_id AND NOT v.published
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_items_write ON private.nutrition_items
  FOR ALL TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_versions v
    JOIN private.nutrition_plans p ON p.id = v.plan_id
    WHERE v.id = nutrition_items.version_id AND NOT v.published
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_active_write ON private.nutrition_active
  FOR ALL TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    WHERE p.id = nutrition_active.plan_id AND p.client_id = nutrition_active.client_id
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

CREATE POLICY nutrition_activations_insert ON private.nutrition_activations
  FOR INSERT TO couchone_authentication
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.nutrition_plans p
    JOIN private.nutrition_active a ON a.plan_id = p.id AND a.client_id = p.client_id
    WHERE a.client_id = nutrition_activations.client_id AND a.plan_id = nutrition_activations.plan_id
      AND a.version_id = nutrition_activations.version_id AND a.revision = nutrition_activations.revision
      AND private.nutrition_can_write(p.owner_id, p.client_id)
  ));

-- EP-07: one daily check-in per client and local date. Its body weight is the
-- single HU-037 event (origin check_in, unit kg); there is no second weight table.
CREATE TABLE private.check_ins (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  local_date date NOT NULL,
  time_zone text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  body_weight_kg numeric(4,1) CHECK (body_weight_kg BETWEEN 30 AND 300),
  sleep_hours numeric(3,1) CHECK (sleep_hours BETWEEN 0 AND 24 AND mod(sleep_hours, 0.5) = 0),
  stress smallint CHECK (stress BETWEEN 1 AND 5),
  energy smallint CHECK (energy BETWEEN 1 AND 5),
  hunger smallint CHECK (hunger BETWEEN 1 AND 5),
  nutrition_compliance text CHECK (nutrition_compliance IN ('completed', 'partial', 'not_completed', 'not_applicable')),
  nutrition_version_id uuid REFERENCES private.nutrition_versions(id) ON DELETE RESTRICT,
  comment text CHECK (char_length(comment) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (client_id, local_date),
  -- A check-in carries at least one real value, never an empty record.
  CHECK (
    num_nonnulls(body_weight_kg, sleep_hours, stress, energy, hunger, comment) >= 1
    OR nutrition_compliance IN ('completed', 'partial', 'not_completed')
  ),
  -- Explicit compliance states point to the nutrition version in force; not_applicable never does.
  CHECK ((nutrition_version_id IS NOT NULL) = COALESCE(nutrition_compliance IN ('completed', 'partial', 'not_completed'), false))
);
CREATE TABLE private.check_in_revisions (
  check_in_id uuid NOT NULL REFERENCES private.check_ins(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  recorded_at timestamptz NOT NULL,
  PRIMARY KEY (check_in_id, revision)
);
-- Absent row means every category stays hidden (DEC-009 default off).
CREATE TABLE private.client_visibility (
  client_id uuid PRIMARY KEY REFERENCES private.clients(id) ON DELETE RESTRICT,
  measurements boolean NOT NULL DEFAULT false,
  adherence boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE private.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.check_in_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.client_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY check_ins_read ON private.check_ins FOR SELECT TO couchone_authentication USING (
  private.training_client_access(client_id)
  OR EXISTS (SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id = c.professional_id
    WHERE c.id = check_ins.client_id AND private.training_professional(p.user_id)));
CREATE POLICY check_ins_write ON private.check_ins FOR ALL TO couchone_authentication
  USING (private.training_client_access(client_id, true)
    AND local_date BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date - 2 AND (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date)
  WITH CHECK (private.training_client_access(client_id, true)
    AND local_date BETWEEN (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date - 2 AND (CURRENT_TIMESTAMP AT TIME ZONE time_zone)::date);
CREATE POLICY check_in_revisions_read ON private.check_in_revisions FOR SELECT TO couchone_authentication
  USING (EXISTS (SELECT 1 FROM private.check_ins s WHERE s.id = check_in_id));
CREATE POLICY check_in_revisions_insert ON private.check_in_revisions FOR INSERT TO couchone_authentication
  WITH CHECK (EXISTS (SELECT 1 FROM private.check_ins s WHERE s.id = check_in_id AND private.training_client_access(s.client_id, true)));
CREATE POLICY client_visibility_read ON private.client_visibility FOR SELECT TO couchone_authentication USING (
  private.training_client_access(client_id)
  OR EXISTS (SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id = c.professional_id
    WHERE c.id = client_visibility.client_id AND private.training_professional(p.user_id)));
CREATE POLICY client_visibility_write ON private.client_visibility FOR ALL TO couchone_authentication
  USING (EXISTS (SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id = c.professional_id
    WHERE c.id = client_visibility.client_id AND private.training_professional(p.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id = c.professional_id
    WHERE c.id = client_visibility.client_id AND private.training_professional(p.user_id)));
-- HU-036: the client reads its own evaluations only while its professional shares measurements.
CREATE POLICY client_evaluations_client_read ON private.client_evaluations FOR SELECT TO couchone_authentication USING (
  private.training_client_access(client_id)
  AND EXISTS (SELECT 1 FROM private.client_visibility v WHERE v.client_id = client_evaluations.client_id AND v.measurements));
-- Adherence needs the routine that applied each day; shared only while adherence is visible.
CREATE POLICY training_versions_adherence_read ON private.training_versions FOR SELECT TO couchone_authentication USING (
  published AND EXISTS (SELECT 1 FROM private.training_activations a JOIN private.client_visibility v ON v.client_id = a.client_id
    WHERE a.version_id = training_versions.id AND v.adherence AND private.training_client_access(a.client_id)));
-- Fix EP-06: the client reads its whole own training history (GET /api/me/training-history);
-- writes stay limited to the correction window by training_session_write.
CREATE POLICY training_sessions_own_history ON private.training_sessions FOR SELECT TO couchone_authentication USING (private.training_client_access(client_id));

GRANT SELECT, INSERT, UPDATE ON private.check_ins, private.client_visibility TO couchone_authentication;
GRANT SELECT, INSERT ON private.check_in_revisions TO couchone_authentication;
-- Applicability needs the nutrition plan in force per date; its read policy already limits the rows.
GRANT SELECT ON private.nutrition_activations TO couchone_authentication;

-- Definer: the version in force may be an older one the client can no longer read.
CREATE FUNCTION private.guard_check_in() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND ((NEW.id, NEW.client_id, NEW.local_date, NEW.time_zone, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.client_id, OLD.local_date, OLD.time_zone, OLD.created_at)
     OR NEW.revision <> OLD.revision + 1) THEN
  RAISE EXCEPTION 'Check-in identity is immutable' USING ERRCODE = '23514';
 END IF;
 IF TG_OP = 'INSERT' AND (NEW.revision <> 1
     OR NEW.time_zone IS DISTINCT FROM (SELECT time_zone FROM private.clients WHERE id = NEW.client_id)) THEN
  RAISE EXCEPTION 'Invalid check-in snapshot' USING ERRCODE = '23514';
 END IF;
 IF NEW.nutrition_version_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM private.nutrition_versions v JOIN private.nutrition_plans p ON p.id = v.plan_id
     WHERE v.id = NEW.nutrition_version_id AND p.client_id = NEW.client_id AND v.published) THEN
  RAISE EXCEPTION 'Nutrition version does not belong to the client' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_check_in BEFORE INSERT OR UPDATE ON private.check_ins FOR EACH ROW EXECUTE FUNCTION private.guard_check_in();

-- EP-05: the professional's own food and recipe library. A plan copies each food's
-- name, portion and macros into its items, so editing or archiving a food here
-- never changes a saved or published plan.
CREATE TABLE private.professional_foods (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  food_group text NOT NULL CHECK (food_group IN ('Proteínas', 'Carbohidratos', 'Grasas saludables', 'Verduras', 'Frutas', 'Lácteos', 'Legumbres', 'Bebidas y suplementos')),
  kind text NOT NULL CHECK (kind IN ('food', 'recipe')),
  basis text NOT NULL CHECK (basis IN ('per_100', 'per_unit')),
  default_unit text NOT NULL CHECK (char_length(default_unit) BETWEEN 1 AND 20),
  default_quantity numeric(6,1) NOT NULL CHECK (default_quantity > 0 AND default_quantity <= 5000),
  calories numeric(6,1) NOT NULL CHECK (calories BETWEEN 0 AND 5000),
  protein_g numeric(5,1) NOT NULL CHECK (protein_g BETWEEN 0 AND 500),
  carbs_g numeric(5,1) NOT NULL CHECK (carbs_g BETWEEN 0 AND 500),
  fat_g numeric(5,1) NOT NULL CHECK (fat_g BETWEEN 0 AND 500),
  preparation text CHECK (char_length(preparation) BETWEEN 1 AND 2000),
  substitutes text CHECK (char_length(substitutes) BETWEEN 1 AND 300),
  ingredients jsonb CHECK (jsonb_typeof(ingredients) = 'array'),
  servings smallint CHECK (servings BETWEEN 1 AND 50),
  suitable_for text[] NOT NULL DEFAULT '{}' CHECK (suitable_for <@ ARRAY['vegan', 'vegetarian', 'dairy_free', 'fish_free', 'gluten_free']),
  meal_categories text[] NOT NULL DEFAULT '{}' CHECK (meal_categories <@ ARRAY['breakfast', 'morning_snack', 'lunch', 'pre_workout', 'post_workout', 'afternoon_snack', 'dinner', 'pre_bed', 'other']),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- A recipe always lists its ingredients and the portions it yields; a food never does.
  CHECK ((kind = 'recipe') = (ingredients IS NOT NULL AND servings IS NOT NULL)),
  CHECK (kind = 'food' OR (basis = 'per_unit' AND ingredients IS NOT NULL))
);
-- One active food per name and professional; archived names can be reused.
CREATE UNIQUE INDEX professional_foods_active_name ON private.professional_foods (owner_id, lower(name)) WHERE archived_at IS NULL;

ALTER TABLE private.professional_foods ENABLE ROW LEVEL SECURITY;
-- Only the owner, while active with a current subscription, reads or writes the library.
CREATE POLICY professional_foods_owner ON private.professional_foods FOR ALL TO couchone_authentication
  USING (private.nutrition_professional(owner_id))
  WITH CHECK (private.nutrition_professional(owner_id));

GRANT SELECT, INSERT ON private.professional_foods TO couchone_authentication;
GRANT UPDATE (name, food_group, kind, basis, default_unit, default_quantity, calories, protein_g, carbs_g, fat_g,
  preparation, substitutes, ingredients, servings, suitable_for, meal_categories, revision, archived_at, updated_at)
  ON private.professional_foods TO couchone_authentication;

-- DEC-017: a client is at most 120 years old. The bound applies to new rows and to
-- changed birth dates only; existing rows are not rewritten and stay editable.
CREATE OR REPLACE FUNCTION private.validate_client_birth_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date > CURRENT_DATE - INTERVAL '16 years' THEN
    RAISE EXCEPTION 'birth_date must identify a client of at least 16 years'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date < CURRENT_DATE - INTERVAL '120 years' THEN
    IF TG_OP = 'INSERT' OR NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
      RAISE EXCEPTION 'birth_date must identify a client of at most 120 years'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Observability, automated checks, SLI/SLO/SLA management, incidents, and retention.
-- Follows private.* conventions, parameterized API access, and strict admin-only RLS.

CREATE TABLE private.observability_logs (
  id uuid CONSTRAINT pk_observability_logs PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL CONSTRAINT ck_obs_logs_corr CHECK (char_length(correlation_id) BETWEEN 1 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  environment text NOT NULL CONSTRAINT ck_obs_logs_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  service text NOT NULL CONSTRAINT ck_obs_logs_service CHECK (char_length(service) BETWEEN 1 AND 60),
  module text NOT NULL CONSTRAINT ck_obs_logs_module CHECK (char_length(module) BETWEEN 1 AND 60),
  source text NOT NULL CONSTRAINT ck_obs_logs_source CHECK (source IN ('operational', 'error', 'client_telemetry', 'system')),
  event_type text NOT NULL CONSTRAINT ck_obs_logs_event CHECK (char_length(event_type) BETWEEN 1 AND 80),
  severity text NOT NULL CONSTRAINT ck_obs_logs_severity CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
  operation text NOT NULL CONSTRAINT ck_obs_logs_op CHECK (char_length(operation) BETWEEN 1 AND 160),
  normalized_path text,
  http_method text CONSTRAINT ck_obs_logs_method CHECK (http_method IS NULL OR http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
  status_code integer CONSTRAINT ck_obs_logs_status CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  duration_ms numeric(10,1) CONSTRAINT ck_obs_logs_duration CHECK (duration_ms IS NULL OR duration_ms >= 0),
  outcome text NOT NULL CONSTRAINT ck_obs_logs_outcome CHECK (outcome IN ('success', 'client_error', 'server_error', 'aborted', 'timeout', 'recovered', 'info')),
  error_code text,
  error_message text,
  system_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_logs_env_occurred ON private.observability_logs (environment, occurred_at DESC, id DESC);
CREATE INDEX idx_obs_logs_correlation ON private.observability_logs (correlation_id, occurred_at DESC);
CREATE INDEX idx_obs_logs_service_occurred ON private.observability_logs (environment, service, occurred_at DESC);
CREATE INDEX idx_obs_logs_severity_occurred ON private.observability_logs (environment, severity, occurred_at DESC);
CREATE INDEX idx_obs_logs_event_occurred ON private.observability_logs (environment, event_type, occurred_at DESC);

CREATE TABLE private.observability_test_runs (
  id uuid CONSTRAINT pk_observability_test_runs PRIMARY KEY DEFAULT gen_random_uuid(),
  external_run_id text CONSTRAINT uk_obs_test_runs_external UNIQUE,
  category text NOT NULL CONSTRAINT ck_obs_test_runs_cat CHECK (category IN ('synthetic_periodic', 'functional_automated', 'manual_admin', 'load_controlled', 'ci_suite')),
  environment text NOT NULL CONSTRAINT ck_obs_test_runs_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  trigger_source text NOT NULL CONSTRAINT ck_obs_test_runs_trigger CHECK (trigger_source IN ('github_actions', 'external_cli', 'admin_manual', 'local_runner', 'ci')),
  triggered_by uuid CONSTRAINT fk_obs_test_runs_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  status text NOT NULL CONSTRAINT ck_obs_test_runs_status CHECK (status IN ('passed', 'failed', 'partial', 'not_executed', 'blocked')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  duration_ms numeric(10,1) NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_dur CHECK (duration_ms >= 0),
  total_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_total CHECK (total_checks >= 0),
  passed_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_passed CHECK (passed_checks >= 0),
  failed_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_failed CHECK (failed_checks >= 0),
  not_executed_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_not_exec CHECK (not_executed_checks >= 0),
  skipped_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_skipped CHECK (skipped_checks >= 0),
  commit_sha text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_test_runs_env_started ON private.observability_test_runs (environment, started_at DESC, id DESC);

CREATE TABLE private.observability_check_results (
  id uuid CONSTRAINT pk_observability_check_results PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL CONSTRAINT fk_obs_checks_run REFERENCES private.observability_test_runs(id) ON DELETE RESTRICT,
  external_event_id text CONSTRAINT uk_obs_checks_external UNIQUE,
  correlation_id text NOT NULL,
  check_key text NOT NULL,
  check_name text NOT NULL,
  check_kind text NOT NULL CONSTRAINT ck_obs_checks_kind CHECK (check_kind IN ('synthetic_availability', 'synthetic_functional', 'automated_test', 'load_scenario')),
  service text NOT NULL,
  module text NOT NULL,
  environment text NOT NULL CONSTRAINT ck_obs_checks_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  target text,
  phase text NOT NULL DEFAULT 'regular',
  executed_at timestamptz NOT NULL,
  expected_result text NOT NULL,
  actual_result text NOT NULL,
  status text NOT NULL CONSTRAINT ck_obs_checks_status CHECK (status IN ('passed', 'failed', 'not_executed', 'skipped', 'blocked')),
  duration_ms numeric(10,1) CONSTRAINT ck_obs_checks_dur CHECK (duration_ms IS NULL OR duration_ms >= 0),
  http_status integer CONSTRAINT ck_obs_checks_http CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  error_code text,
  error_message text,
  assertions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_checks_env_executed ON private.observability_check_results (environment, executed_at DESC, id DESC);
CREATE INDEX idx_obs_checks_service_executed ON private.observability_check_results (environment, service, executed_at DESC);
CREATE INDEX idx_obs_checks_key_executed ON private.observability_check_results (environment, check_key, executed_at DESC);
CREATE INDEX idx_obs_checks_run ON private.observability_check_results (run_id, executed_at DESC);
CREATE INDEX idx_obs_checks_corr ON private.observability_check_results (correlation_id);

CREATE TABLE private.observability_sli_definitions (
  id uuid CONSTRAINT pk_observability_sli_definitions PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CONSTRAINT uk_obs_sli_code UNIQUE,
  current_version integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_sli_ver CHECK (current_version > 0),
  name text NOT NULL CONSTRAINT ck_obs_sli_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 120),
  description text NOT NULL CONSTRAINT ck_obs_sli_desc CHECK (char_length(btrim(description)) BETWEEN 3 AND 500),
  service text NOT NULL,
  characteristic text NOT NULL,
  data_source text NOT NULL CONSTRAINT ck_obs_sli_source CHECK (data_source IN ('operational_http', 'synthetic_availability', 'synthetic_functional', 'automated_tests', 'client_telemetry')),
  indicator_type text NOT NULL CONSTRAINT ck_obs_sli_type CHECK (indicator_type IN ('availability', 'latency_mean', 'latency_percentile', 'latency_threshold_pct', 'error_rate', 'operation_success_rate', 'reliability', 'recovery_time', 'functional_test_success')),
  unit text NOT NULL CONSTRAINT ck_obs_sli_unit CHECK (unit IN ('%', 'ms', 's', 'rps')),
  calculation_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  inclusion_criteria text NOT NULL,
  exclusion_criteria text NOT NULL,
  evaluation_period text NOT NULL CONSTRAINT ck_obs_sli_period CHECK (evaluation_period IN ('1h', '24h', '7d', '30d')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid CONSTRAINT fk_obs_sli_created_by REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_by uuid CONSTRAINT fk_obs_sli_updated_by REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_sli_versions (
  id uuid CONSTRAINT pk_observability_sli_versions PRIMARY KEY DEFAULT gen_random_uuid(),
  sli_id uuid NOT NULL CONSTRAINT fk_obs_sli_versions_sli REFERENCES private.observability_sli_definitions(id) ON DELETE RESTRICT,
  version integer NOT NULL CONSTRAINT ck_obs_sli_versions_num CHECK (version > 0),
  snapshot jsonb NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  changed_by uuid CONSTRAINT fk_obs_sli_versions_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uk_obs_sli_versions_num UNIQUE (sli_id, version)
);

CREATE TABLE private.observability_slo_definitions (
  id uuid CONSTRAINT pk_observability_slo_definitions PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CONSTRAINT uk_obs_slo_code UNIQUE,
  sli_id uuid NOT NULL CONSTRAINT fk_obs_slo_sli REFERENCES private.observability_sli_definitions(id) ON DELETE RESTRICT,
  current_version integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_slo_ver CHECK (current_version > 0),
  name text NOT NULL CONSTRAINT ck_obs_slo_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 140),
  description text NOT NULL CONSTRAINT ck_obs_slo_desc CHECK (char_length(btrim(description)) BETWEEN 3 AND 600),
  target_value numeric(12,3) NOT NULL,
  comparison_operator text NOT NULL CONSTRAINT ck_obs_slo_op CHECK (comparison_operator IN ('>=', '<=', '>', '<')),
  unit text NOT NULL CONSTRAINT ck_obs_slo_unit CHECK (unit IN ('%', 'ms', 's', 'rps')),
  evaluation_period text NOT NULL CONSTRAINT ck_obs_slo_period CHECK (evaluation_period IN ('1h', '24h', '7d', '30d')),
  min_samples integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_slo_min CHECK (min_samples >= 1),
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'active' CONSTRAINT ck_obs_slo_status CHECK (status IN ('active', 'inactive', 'archived')),
  is_contractual boolean NOT NULL DEFAULT false,
  created_by uuid CONSTRAINT fk_obs_slo_created_by REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_by uuid CONSTRAINT fk_obs_slo_updated_by REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_slo_versions (
  id uuid CONSTRAINT pk_observability_slo_versions PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_id uuid NOT NULL CONSTRAINT fk_obs_slo_versions_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  version integer NOT NULL CONSTRAINT ck_obs_slo_versions_num CHECK (version > 0),
  sli_version integer NOT NULL CONSTRAINT ck_obs_slo_versions_sli_ver CHECK (sli_version > 0),
  target_value numeric(12,3) NOT NULL,
  comparison_operator text NOT NULL CONSTRAINT ck_obs_slo_ver_op CHECK (comparison_operator IN ('>=', '<=', '>', '<')),
  unit text NOT NULL,
  evaluation_period text NOT NULL,
  min_samples integer NOT NULL CONSTRAINT ck_obs_slo_ver_min CHECK (min_samples >= 1),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  snapshot jsonb NOT NULL,
  changed_by uuid CONSTRAINT fk_obs_slo_versions_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uk_obs_slo_versions_num UNIQUE (slo_id, version)
);

CREATE TABLE private.observability_slo_evaluations (
  id uuid CONSTRAINT pk_observability_slo_evaluations PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_id uuid NOT NULL CONSTRAINT fk_obs_slo_evals_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  slo_version integer NOT NULL CONSTRAINT ck_obs_slo_evals_ver CHECK (slo_version > 0),
  environment text NOT NULL CONSTRAINT ck_obs_slo_evals_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  target_value numeric(12,3) NOT NULL,
  observed_value numeric(12,3),
  delta_value numeric(12,3),
  samples integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_slo_evals_samples CHECK (samples >= 0),
  not_executed_count integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_slo_evals_not_exec CHECK (not_executed_count >= 0),
  compliance_status text NOT NULL CONSTRAINT ck_obs_slo_evals_status CHECK (compliance_status IN ('met', 'unmet', 'insufficient_data')),
  error_budget_total numeric(12,3),
  error_budget_consumed numeric(12,3),
  error_budget_remaining_pct numeric(8,2),
  notes text,
  evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_slo_evals_slo_env_time ON private.observability_slo_evaluations (slo_id, environment, evaluated_at DESC);

CREATE TABLE private.observability_slas (
  id uuid CONSTRAINT pk_observability_slas PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CONSTRAINT ck_obs_sla_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 160),
  covered_service text NOT NULL CONSTRAINT ck_obs_sla_service CHECK (char_length(btrim(covered_service)) BETWEEN 2 AND 120),
  commitments text NOT NULL CONSTRAINT ck_obs_sla_commit CHECK (char_length(btrim(commitments)) BETWEEN 3 AND 2000),
  approval_status text NOT NULL DEFAULT 'draft' CONSTRAINT ck_obs_sla_approval CHECK (approval_status IN ('draft', 'internal_reference', 'formally_approved', 'expired')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  responsibilities text NOT NULL,
  exclusions text NOT NULL,
  breach_consequences text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid CONSTRAINT fk_obs_sla_created_by REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_by uuid CONSTRAINT fk_obs_sla_updated_by REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_sla_slos (
  sla_id uuid NOT NULL CONSTRAINT fk_obs_sla_slos_sla REFERENCES private.observability_slas(id) ON DELETE CASCADE,
  slo_id uuid NOT NULL CONSTRAINT fk_obs_sla_slos_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  CONSTRAINT pk_observability_sla_slos PRIMARY KEY (sla_id, slo_id)
);

CREATE TABLE private.observability_incidents (
  id uuid CONSTRAINT pk_observability_incidents PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL,
  environment text NOT NULL CONSTRAINT ck_obs_inc_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  service text NOT NULL,
  incident_type text NOT NULL CONSTRAINT ck_obs_inc_type CHECK (incident_type IN ('service_outage', 'latency_spike', 'high_error_rate', 'consecutive_check_failure', 'slo_breach')),
  severity text NOT NULL CONSTRAINT ck_obs_inc_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CONSTRAINT ck_obs_inc_status CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title text NOT NULL,
  summary text NOT NULL,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  resolved_at timestamptz,
  recovery_duration_s numeric(12,1),
  occurrence_count integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_inc_count CHECK (occurrence_count >= 1),
  correlation_id text,
  slo_id uuid CONSTRAINT fk_obs_inc_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  acknowledged_by uuid CONSTRAINT fk_obs_inc_ack_by REFERENCES private.users(id) ON DELETE RESTRICT,
  resolution_notes text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uk_obs_incidents_open_dedupe ON private.observability_incidents (dedupe_key) WHERE status IN ('open', 'acknowledged');
CREATE INDEX idx_obs_incidents_env_status_started ON private.observability_incidents (environment, status, started_at DESC);

CREATE TABLE private.observability_settings (
  key text CONSTRAINT pk_observability_settings PRIMARY KEY CONSTRAINT ck_obs_settings_key CHECK (key = 'default'),
  monitor_enabled boolean NOT NULL DEFAULT true,
  check_interval_minutes integer NOT NULL DEFAULT 5 CONSTRAINT ck_obs_settings_interval CHECK (check_interval_minutes IN (5, 10, 15, 30, 60)),
  log_retention_days integer NOT NULL DEFAULT 30 CONSTRAINT ck_obs_settings_log_ret CHECK (log_retention_days BETWEEN 7 AND 365),
  check_retention_days integer NOT NULL DEFAULT 90 CONSTRAINT ck_obs_settings_chk_ret CHECK (check_retention_days BETWEEN 14 AND 365),
  evaluation_retention_days integer NOT NULL DEFAULT 365 CONSTRAINT ck_obs_settings_eval_ret CHECK (evaluation_retention_days BETWEEN 30 AND 1095),
  incident_error_rate_threshold_pct numeric(5,2) NOT NULL DEFAULT 5.00 CONSTRAINT ck_obs_settings_err_pct CHECK (incident_error_rate_threshold_pct > 0 AND incident_error_rate_threshold_pct <= 100),
  incident_latency_p95_threshold_ms integer NOT NULL DEFAULT 2000 CONSTRAINT ck_obs_settings_lat CHECK (incident_latency_p95_threshold_ms BETWEEN 100 AND 60000),
  incident_consecutive_failures integer NOT NULL DEFAULT 2 CONSTRAINT ck_obs_settings_fail CHECK (incident_consecutive_failures BETWEEN 1 AND 20),
  updated_by uuid CONSTRAINT fk_obs_settings_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_audit_log (
  id uuid CONSTRAINT pk_observability_audit_log PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL CONSTRAINT fk_obs_audit_admin REFERENCES private.users(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CONSTRAINT ck_obs_audit_entity CHECK (entity_type IN ('sli', 'slo', 'sla', 'settings', 'incident', 'check_run', 'maintenance')),
  entity_id text NOT NULL,
  action text NOT NULL CONSTRAINT ck_obs_audit_action CHECK (action IN ('created', 'updated', 'status_changed', 'evaluated', 'acknowledged', 'resolved', 'manual_run', 'pruned')),
  summary text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_audit_created ON private.observability_audit_log (created_at DESC, id DESC);

CREATE TABLE private.observability_hourly_rollups (
  environment text NOT NULL CONSTRAINT ck_obs_rollup_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  service text NOT NULL,
  module text NOT NULL,
  bucket_hour timestamptz NOT NULL,
  requests_total integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  client_error_count integer NOT NULL DEFAULT 0,
  server_error_count integer NOT NULL DEFAULT 0,
  aborted_count integer NOT NULL DEFAULT 0,
  duration_avg_ms numeric(10,1),
  duration_p50_ms numeric(10,1),
  duration_p95_ms numeric(10,1),
  duration_p99_ms numeric(10,1),
  synthetic_total integer NOT NULL DEFAULT 0,
  synthetic_passed integer NOT NULL DEFAULT 0,
  synthetic_failed integer NOT NULL DEFAULT 0,
  synthetic_not_executed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_observability_hourly_rollups PRIMARY KEY (environment, service, module, bucket_hour)
);

-- RLS and minimum privileges: only active administrators read or manage observability tables directly.
REVOKE ALL ON
  private.observability_logs,
  private.observability_test_runs,
  private.observability_check_results,
  private.observability_sli_definitions,
  private.observability_sli_versions,
  private.observability_slo_definitions,
  private.observability_slo_versions,
  private.observability_slo_evaluations,
  private.observability_slas,
  private.observability_sla_slos,
  private.observability_incidents,
  private.observability_settings,
  private.observability_audit_log,
  private.observability_hourly_rollups
FROM PUBLIC;

ALTER TABLE private.observability_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_sli_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_sli_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slo_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slo_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slo_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_sla_slos ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_hourly_rollups ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON private.observability_logs, private.observability_hourly_rollups TO couchone_authentication;
GRANT SELECT, INSERT ON private.observability_test_runs, private.observability_check_results, private.observability_slo_evaluations, private.observability_audit_log TO couchone_authentication;
GRANT SELECT, INSERT, UPDATE (effective_to) ON private.observability_sli_versions, private.observability_slo_versions TO couchone_authentication;
GRANT SELECT, INSERT, UPDATE ON
  private.observability_sli_definitions,
  private.observability_slo_definitions,
  private.observability_slas,
  private.observability_incidents,
  private.observability_settings
TO couchone_authentication;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.observability_sla_slos TO couchone_authentication;

CREATE POLICY admin_observability_logs ON private.observability_logs FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_test_runs ON private.observability_test_runs FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_check_results ON private.observability_check_results FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_sli_definitions ON private.observability_sli_definitions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_sli_versions ON private.observability_sli_versions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slo_definitions ON private.observability_slo_definitions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slo_versions ON private.observability_slo_versions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slo_evaluations ON private.observability_slo_evaluations FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slas ON private.observability_slas FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_sla_slos ON private.observability_sla_slos FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_incidents ON private.observability_incidents FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_settings ON private.observability_settings FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_audit_log ON private.observability_audit_log FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_hourly_rollups ON private.observability_hourly_rollups FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);

-- Narrow SECURITY DEFINER functions for sanitized batch log insertion, idempotent ingest, and admin audit reads.
CREATE FUNCTION private.insert_observability_logs(entries jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE inserted_count integer := 0;
BEGIN
  IF jsonb_typeof(entries) <> 'array' THEN
    RAISE EXCEPTION 'OBSERVABILITY_INVALID_ENTRIES';
  END IF;
  WITH rows_in AS (
    SELECT
      left(COALESCE(NULLIF(btrim(item->>'correlationId'), ''), gen_random_uuid()::text), 128) AS correlation_id,
      COALESCE((item->>'occurredAt')::timestamptz, clock_timestamp()) AS occurred_at,
      CASE
        WHEN item->>'environment' IN ('production', 'staging', 'development', 'local', 'ci', 'test') THEN item->>'environment'
        ELSE 'development'
      END AS environment,
      left(COALESCE(NULLIF(btrim(item->>'service'), ''), 'api'), 60) AS service,
      left(COALESCE(NULLIF(btrim(item->>'module'), ''), 'system'), 60) AS module,
      CASE
        WHEN item->>'source' IN ('operational', 'error', 'client_telemetry', 'system') THEN item->>'source'
        ELSE 'operational'
      END AS source,
      left(COALESCE(NULLIF(btrim(item->>'eventType'), ''), 'http.request'), 80) AS event_type,
      CASE
        WHEN item->>'severity' IN ('debug', 'info', 'warn', 'error', 'critical') THEN item->>'severity'
        ELSE 'info'
      END AS severity,
      left(COALESCE(NULLIF(btrim(item->>'operation'), ''), 'unknown'), 160) AS operation,
      NULLIF(left(btrim(COALESCE(item->>'normalizedPath', '')), 200), '') AS normalized_path,
      CASE
        WHEN item->>'httpMethod' IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD') THEN item->>'httpMethod'
        ELSE NULL
      END AS http_method,
      CASE
        WHEN (item->>'statusCode') ~ '^\d{3}$' AND (item->>'statusCode')::integer BETWEEN 100 AND 599
          THEN (item->>'statusCode')::integer
        ELSE NULL
      END AS status_code,
      CASE
        WHEN (item->>'durationMs') ~ '^\d+(\.\d+)?$' THEN round((item->>'durationMs')::numeric, 1)
        ELSE NULL
      END AS duration_ms,
      CASE
        WHEN item->>'outcome' IN ('success', 'client_error', 'server_error', 'aborted', 'timeout', 'recovered', 'info') THEN item->>'outcome'
        ELSE 'info'
      END AS outcome,
      NULLIF(left(btrim(COALESCE(item->>'errorCode', '')), 120), '') AS error_code,
      NULLIF(left(btrim(COALESCE(item->>'errorMessage', '')), 500), '') AS error_message,
      NULLIF(left(btrim(COALESCE(item->>'systemVersion', '')), 60), '') AS system_version,
      CASE
        WHEN jsonb_typeof(item->'metadata') = 'object' THEN item->'metadata'
        ELSE '{}'::jsonb
      END AS metadata
    FROM jsonb_array_elements(entries) AS item
  ),
  inserted AS (
    INSERT INTO private.observability_logs (
      correlation_id, occurred_at, environment, service, module, source, event_type,
      severity, operation, normalized_path, http_method, status_code, duration_ms,
      outcome, error_code, error_message, system_version, metadata
    )
    SELECT * FROM rows_in
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted_count FROM inserted;
  RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION private.insert_observability_logs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.insert_observability_logs(jsonb) TO couchone_authentication;

CREATE FUNCTION private.read_observability_runtime_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
  SELECT jsonb_build_object(
    'monitorEnabled', s.monitor_enabled,
    'checkIntervalMinutes', s.check_interval_minutes,
    'logRetentionDays', s.log_retention_days,
    'checkRetentionDays', s.check_retention_days,
    'evaluationRetentionDays', s.evaluation_retention_days,
    'incidentErrorRateThresholdPct', s.incident_error_rate_threshold_pct::float8,
    'incidentLatencyP95ThresholdMs', s.incident_latency_p95_threshold_ms,
    'incidentConsecutiveFailures', s.incident_consecutive_failures,
    'updatedAt', s.updated_at
  )
  FROM private.observability_settings s
  WHERE s.key = 'default'
$$;
REVOKE ALL ON FUNCTION private.read_observability_runtime_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.read_observability_runtime_config() TO couchone_authentication;

CREATE FUNCTION private.ingest_observability_run(run_payload jsonb, checks_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE
  v_run_id uuid;
  v_external_run_id text := NULLIF(btrim(COALESCE(run_payload->>'externalRunId', '')), '');
  v_inserted integer := 0;
  v_total integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  IF jsonb_typeof(checks_payload) <> 'array' THEN
    RAISE EXCEPTION 'OBSERVABILITY_INVALID_CHECKS';
  END IF;

  IF v_external_run_id IS NOT NULL THEN
    INSERT INTO private.observability_test_runs (
      external_run_id, category, environment, trigger_source, triggered_by, status,
      started_at, finished_at, duration_ms, total_checks, passed_checks, failed_checks,
      not_executed_checks, skipped_checks, commit_sha, notes
    )
    VALUES (
      v_external_run_id,
      run_payload->>'category',
      run_payload->>'environment',
      run_payload->>'triggerSource',
      NULLIF(run_payload->>'triggeredBy', '')::uuid,
      run_payload->>'status',
      (run_payload->>'startedAt')::timestamptz,
      (run_payload->>'finishedAt')::timestamptz,
      COALESCE((run_payload->>'durationMs')::numeric, 0),
      COALESCE((run_payload->>'totalChecks')::integer, 0),
      COALESCE((run_payload->>'passedChecks')::integer, 0),
      COALESCE((run_payload->>'failedChecks')::integer, 0),
      COALESCE((run_payload->>'notExecutedChecks')::integer, 0),
      COALESCE((run_payload->>'skippedChecks')::integer, 0),
      NULLIF(btrim(COALESCE(run_payload->>'commitSha', '')), ''),
      NULLIF(btrim(COALESCE(run_payload->>'notes', '')), '')
    )
    ON CONFLICT (external_run_id) DO NOTHING
    RETURNING id INTO v_run_id;

    IF v_run_id IS NULL THEN
      SELECT id INTO v_run_id FROM private.observability_test_runs WHERE external_run_id = v_external_run_id;
    END IF;
  ELSE
    INSERT INTO private.observability_test_runs (
      category, environment, trigger_source, triggered_by, status,
      started_at, finished_at, duration_ms, total_checks, passed_checks, failed_checks,
      not_executed_checks, skipped_checks, commit_sha, notes
    )
    VALUES (
      run_payload->>'category',
      run_payload->>'environment',
      run_payload->>'triggerSource',
      NULLIF(run_payload->>'triggeredBy', '')::uuid,
      run_payload->>'status',
      (run_payload->>'startedAt')::timestamptz,
      (run_payload->>'finishedAt')::timestamptz,
      COALESCE((run_payload->>'durationMs')::numeric, 0),
      COALESCE((run_payload->>'totalChecks')::integer, 0),
      COALESCE((run_payload->>'passedChecks')::integer, 0),
      COALESCE((run_payload->>'failedChecks')::integer, 0),
      COALESCE((run_payload->>'notExecutedChecks')::integer, 0),
      COALESCE((run_payload->>'skippedChecks')::integer, 0),
      NULLIF(btrim(COALESCE(run_payload->>'commitSha', '')), ''),
      NULLIF(btrim(COALESCE(run_payload->>'notes', '')), '')
    )
    RETURNING id INTO v_run_id;
  END IF;

  v_total := jsonb_array_length(checks_payload);

  WITH inserted_checks AS (
    INSERT INTO private.observability_check_results (
      run_id, external_event_id, correlation_id, check_key, check_name, check_kind,
      service, module, environment, target, phase, executed_at, expected_result,
      actual_result, status, duration_ms, http_status, error_code, error_message, assertions
    )
    SELECT
      v_run_id,
      NULLIF(btrim(COALESCE(item->>'externalEventId', '')), ''),
      left(COALESCE(NULLIF(btrim(item->>'correlationId'), ''), v_run_id::text), 128),
      item->>'checkKey',
      item->>'checkName',
      item->>'checkKind',
      item->>'service',
      item->>'module',
      item->>'environment',
      NULLIF(btrim(COALESCE(item->>'target', '')), ''),
      COALESCE(NULLIF(btrim(item->>'phase'), ''), 'regular'),
      (item->>'executedAt')::timestamptz,
      item->>'expectedResult',
      item->>'actualResult',
      item->>'status',
      CASE WHEN (item->>'durationMs') ~ '^\d+(\.\d+)?$' THEN round((item->>'durationMs')::numeric, 1) ELSE NULL END,
      CASE WHEN (item->>'httpStatus') ~ '^\d{3}$' THEN (item->>'httpStatus')::integer ELSE NULL END,
      NULLIF(left(btrim(COALESCE(item->>'errorCode', '')), 120), ''),
      NULLIF(left(btrim(COALESCE(item->>'errorMessage', '')), 500), ''),
      CASE WHEN jsonb_typeof(item->'assertions') = 'array' THEN item->'assertions' ELSE '[]'::jsonb END
    FROM jsonb_array_elements(checks_payload) AS item
    ON CONFLICT (external_event_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM inserted_checks;

  RETURN jsonb_build_object(
    'runId', v_run_id,
    'insertedChecks', v_inserted,
    'duplicateChecks', GREATEST(v_total - v_inserted, 0)
  );
END $$;
REVOKE ALL ON FUNCTION private.ingest_observability_run(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ingest_observability_run(jsonb, jsonb) TO couchone_authentication;

CREATE FUNCTION private.upsert_observability_incident(
  p_dedupe_key text,
  p_env text,
  p_service text,
  p_type text,
  p_severity text,
  p_title text,
  p_summary text,
  p_seen_at timestamptz,
  p_correlation_id text,
  p_slo_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  INSERT INTO private.observability_incidents (
    dedupe_key, environment, service, incident_type, severity, status,
    title, summary, started_at, last_seen_at, occurrence_count, correlation_id, slo_id, updated_at
  )
  VALUES (
    p_dedupe_key, p_env, p_service, p_type, p_severity, 'open',
    p_title, p_summary, p_seen_at, p_seen_at, 1, p_correlation_id, p_slo_id, clock_timestamp()
  )
  ON CONFLICT (dedupe_key) WHERE status IN ('open', 'acknowledged')
  DO UPDATE SET
    severity = CASE
      WHEN private.observability_incidents.severity = 'critical' OR EXCLUDED.severity = 'critical' THEN 'critical'
      WHEN private.observability_incidents.severity = 'high' OR EXCLUDED.severity = 'high' THEN 'high'
      WHEN private.observability_incidents.severity = 'medium' OR EXCLUDED.severity = 'medium' THEN 'medium'
      ELSE 'low'
    END,
    summary = EXCLUDED.summary,
    last_seen_at = GREATEST(private.observability_incidents.last_seen_at, EXCLUDED.last_seen_at),
    occurrence_count = private.observability_incidents.occurrence_count + 1,
    correlation_id = COALESCE(EXCLUDED.correlation_id, private.observability_incidents.correlation_id),
    updated_at = clock_timestamp()
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.upsert_observability_incident(text, text, text, text, text, text, text, timestamptz, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.upsert_observability_incident(text, text, text, text, text, text, text, timestamptz, text, uuid) TO couchone_authentication;

CREATE FUNCTION private.resolve_observability_incident(
  p_dedupe_key text,
  p_resolved_at timestamptz,
  p_notes text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_updated integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  UPDATE private.observability_incidents
  SET
    status = 'resolved',
    resolved_at = p_resolved_at,
    recovery_duration_s = round(GREATEST(EXTRACT(EPOCH FROM (p_resolved_at - started_at)), 0)::numeric, 1),
    resolution_notes = COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), resolution_notes),
    updated_at = clock_timestamp()
  WHERE dedupe_key = p_dedupe_key
    AND status IN ('open', 'acknowledged');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $$;
REVOKE ALL ON FUNCTION private.resolve_observability_incident(text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.resolve_observability_incident(text, timestamptz, text) TO couchone_authentication;

CREATE FUNCTION private.record_observability_slo_evaluation(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  INSERT INTO private.observability_slo_evaluations (
    slo_id, slo_version, environment, period_start, period_end, target_value,
    observed_value, delta_value, samples, not_executed_count, compliance_status,
    error_budget_total, error_budget_consumed, error_budget_remaining_pct, notes, evaluated_at
  )
  VALUES (
    (payload->>'sloId')::uuid,
    (payload->>'sloVersion')::integer,
    payload->>'environment',
    (payload->>'periodStart')::timestamptz,
    (payload->>'periodEnd')::timestamptz,
    (payload->>'targetValue')::numeric,
    CASE WHEN payload->>'observedValue' IS NULL THEN NULL ELSE (payload->>'observedValue')::numeric END,
    CASE WHEN payload->>'deltaValue' IS NULL THEN NULL ELSE (payload->>'deltaValue')::numeric END,
    COALESCE((payload->>'samples')::integer, 0),
    COALESCE((payload->>'notExecutedCount')::integer, 0),
    payload->>'complianceStatus',
    CASE WHEN payload->>'errorBudgetTotal' IS NULL THEN NULL ELSE (payload->>'errorBudgetTotal')::numeric END,
    CASE WHEN payload->>'errorBudgetConsumed' IS NULL THEN NULL ELSE (payload->>'errorBudgetConsumed')::numeric END,
    CASE WHEN payload->>'errorBudgetRemainingPct' IS NULL THEN NULL ELSE (payload->>'errorBudgetRemainingPct')::numeric END,
    NULLIF(btrim(COALESCE(payload->>'notes', '')), ''),
    COALESCE((payload->>'evaluatedAt')::timestamptz, clock_timestamp())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.record_observability_slo_evaluation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_observability_slo_evaluation(jsonb) TO couchone_authentication;

CREATE FUNCTION private.observability_ingest_snapshot(p_env text, p_since timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  RETURN jsonb_build_object(
    'settings', private.read_observability_runtime_config(),
    'logs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'occurredAt', l.occurred_at,
        'service', l.service,
        'module', l.module,
        'source', l.source,
        'eventType', l.event_type,
        'severity', l.severity,
        'normalizedPath', l.normalized_path,
        'httpMethod', l.http_method,
        'statusCode', l.status_code,
        'durationMs', l.duration_ms::float8,
        'outcome', l.outcome
      ) ORDER BY l.occurred_at DESC)
      FROM private.observability_logs l
      WHERE l.environment = p_env AND l.occurred_at >= p_since
    ), '[]'::jsonb),
    'checks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'checkKey', c.check_key,
        'checkName', c.check_name,
        'checkKind', c.check_kind,
        'service', c.service,
        'module', c.module,
        'target', c.target,
        'phase', c.phase,
        'executedAt', c.executed_at,
        'status', c.status,
        'durationMs', c.duration_ms::float8,
        'httpStatus', c.http_status,
        'correlationId', c.correlation_id,
        'errorMessage', c.error_message
      ) ORDER BY c.executed_at DESC)
      FROM private.observability_check_results c
      WHERE c.environment = p_env AND c.executed_at >= p_since
    ), '[]'::jsonb),
    'slis', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'currentVersion', s.current_version,
        'name', s.name,
        'description', s.description,
        'service', s.service,
        'characteristic', s.characteristic,
        'dataSource', s.data_source,
        'indicatorType', s.indicator_type,
        'unit', s.unit,
        'calculationMethod', s.calculation_method,
        'inclusionCriteria', s.inclusion_criteria,
        'exclusionCriteria', s.exclusion_criteria,
        'evaluationPeriod', s.evaluation_period,
        'isActive', s.is_active
      ))
      FROM private.observability_sli_definitions s
      WHERE s.is_active = true
    ), '[]'::jsonb),
    'slos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'code', o.code,
        'sliId', o.sli_id,
        'currentVersion', o.current_version,
        'name', o.name,
        'description', o.description,
        'targetValue', o.target_value::float8,
        'comparisonOperator', o.comparison_operator,
        'unit', o.unit,
        'evaluationPeriod', o.evaluation_period,
        'minSamples', o.min_samples,
        'effectiveFrom', o.effective_from,
        'effectiveTo', o.effective_to,
        'status', o.status,
        'isContractual', o.is_contractual
      ))
      FROM private.observability_slo_definitions o
      WHERE o.status = 'active'
    ), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION private.observability_ingest_snapshot(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_ingest_snapshot(text, timestamptz) TO couchone_authentication;

CREATE FUNCTION private.admin_access_events_page(
  p_from timestamptz,
  p_to timestamptz,
  p_search text,
  p_limit integer,
  p_offset integer
) RETURNS TABLE(
  total bigint,
  id uuid,
  action text,
  actor_username text,
  subject_username text,
  client_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  RETURN QUERY
  WITH filtered AS (
    SELECT
      e.id,
      e.action,
      actor.username AS actor_username,
      subj.username AS subject_username,
      e.client_id,
      e.created_at
    FROM private.access_events e
    LEFT JOIN private.users actor ON actor.id = e.actor_id
    LEFT JOIN private.users subj ON subj.id = e.subject_id
    WHERE (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to IS NULL OR e.created_at <= p_to)
      AND (
        COALESCE(btrim(p_search), '') = ''
        OR position(lower(btrim(p_search) COLLATE pg_catalog.pg_c_utf8) IN lower((e.action || ' ' || COALESCE(actor.username, '') || ' ' || COALESCE(subj.username, '')) COLLATE pg_catalog.pg_c_utf8)) > 0
      )
  )
  SELECT
    (SELECT count(*) FROM filtered),
    f.id,
    f.action,
    f.actor_username,
    f.subject_username,
    f.client_id,
    f.created_at
  FROM filtered f
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
END $$;
REVOKE ALL ON FUNCTION private.admin_access_events_page(timestamptz, timestamptz, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_access_events_page(timestamptz, timestamptz, text, integer, integer) TO couchone_authentication;

CREATE FUNCTION private.prune_observability_data() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE
  v_log_days integer;
  v_check_days integer;
  v_eval_days integer;
  v_log_cutoff timestamptz;
  v_check_cutoff timestamptz;
  v_eval_cutoff timestamptz;
  v_deleted_logs integer := 0;
  v_deleted_checks integer := 0;
  v_deleted_evals integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  SELECT log_retention_days, check_retention_days, evaluation_retention_days
  INTO v_log_days, v_check_days, v_eval_days
  FROM private.observability_settings
  WHERE key = 'default';

  v_log_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_log_days, 30));
  v_check_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_check_days, 90));
  v_eval_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_eval_days, 365));

  -- Aggregate hourly HTTP rollups before deleting expired raw logs.
  INSERT INTO private.observability_hourly_rollups (
    environment, service, module, bucket_hour, requests_total, success_count,
    client_error_count, server_error_count, aborted_count, duration_avg_ms,
    duration_p50_ms, duration_p95_ms, duration_p99_ms, updated_at
  )
  SELECT
    l.environment,
    l.service,
    l.module,
    date_trunc('hour', l.occurred_at) AS bucket_hour,
    count(*)::integer,
    count(*) FILTER (WHERE l.outcome = 'success')::integer,
    count(*) FILTER (WHERE l.outcome = 'client_error')::integer,
    count(*) FILTER (WHERE l.outcome = 'server_error')::integer,
    count(*) FILTER (WHERE l.outcome = 'aborted')::integer,
    round(avg(l.duration_ms)::numeric, 1),
    round((percentile_disc(0.50) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    round((percentile_disc(0.95) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    round((percentile_disc(0.99) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    clock_timestamp()
  FROM private.observability_logs l
  WHERE l.occurred_at < v_log_cutoff
    AND l.event_type IN ('http.request', 'http.aborted')
  GROUP BY l.environment, l.service, l.module, date_trunc('hour', l.occurred_at)
  ON CONFLICT (environment, service, module, bucket_hour)
  DO UPDATE SET
    requests_total = GREATEST(private.observability_hourly_rollups.requests_total, EXCLUDED.requests_total),
    success_count = GREATEST(private.observability_hourly_rollups.success_count, EXCLUDED.success_count),
    client_error_count = GREATEST(private.observability_hourly_rollups.client_error_count, EXCLUDED.client_error_count),
    server_error_count = GREATEST(private.observability_hourly_rollups.server_error_count, EXCLUDED.server_error_count),
    aborted_count = GREATEST(private.observability_hourly_rollups.aborted_count, EXCLUDED.aborted_count),
    duration_avg_ms = COALESCE(EXCLUDED.duration_avg_ms, private.observability_hourly_rollups.duration_avg_ms),
    duration_p50_ms = COALESCE(EXCLUDED.duration_p50_ms, private.observability_hourly_rollups.duration_p50_ms),
    duration_p95_ms = COALESCE(EXCLUDED.duration_p95_ms, private.observability_hourly_rollups.duration_p95_ms),
    duration_p99_ms = COALESCE(EXCLUDED.duration_p99_ms, private.observability_hourly_rollups.duration_p99_ms),
    updated_at = clock_timestamp();

  INSERT INTO private.observability_hourly_rollups (
    environment, service, module, bucket_hour, synthetic_total, synthetic_passed,
    synthetic_failed, synthetic_not_executed, updated_at
  )
  SELECT
    c.environment,
    c.service,
    c.module,
    date_trunc('hour', c.executed_at) AS bucket_hour,
    count(*)::integer,
    count(*) FILTER (WHERE c.status = 'passed')::integer,
    count(*) FILTER (WHERE c.status = 'failed')::integer,
    count(*) FILTER (WHERE c.status = 'not_executed')::integer,
    clock_timestamp()
  FROM private.observability_check_results c
  WHERE c.executed_at < v_check_cutoff
    AND c.phase <> 'recovery-drill'
  GROUP BY c.environment, c.service, c.module, date_trunc('hour', c.executed_at)
  ON CONFLICT (environment, service, module, bucket_hour)
  DO UPDATE SET
    synthetic_total = GREATEST(private.observability_hourly_rollups.synthetic_total, EXCLUDED.synthetic_total),
    synthetic_passed = GREATEST(private.observability_hourly_rollups.synthetic_passed, EXCLUDED.synthetic_passed),
    synthetic_failed = GREATEST(private.observability_hourly_rollups.synthetic_failed, EXCLUDED.synthetic_failed),
    synthetic_not_executed = GREATEST(private.observability_hourly_rollups.synthetic_not_executed, EXCLUDED.synthetic_not_executed),
    updated_at = clock_timestamp();

  DELETE FROM private.observability_logs WHERE occurred_at < v_log_cutoff;
  GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

  DELETE FROM private.observability_check_results WHERE executed_at < v_check_cutoff;
  GET DIAGNOSTICS v_deleted_checks = ROW_COUNT;

  DELETE FROM private.observability_slo_evaluations WHERE evaluated_at < v_eval_cutoff;
  GET DIAGNOSTICS v_deleted_evals = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletedLogs', v_deleted_logs,
    'deletedChecks', v_deleted_checks,
    'deletedEvaluations', v_deleted_evals
  );
END $$;
REVOKE ALL ON FUNCTION private.prune_observability_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.prune_observability_data() TO couchone_authentication;

-- Default runtime settings and initial internal SLI/SLO catalog (never contractual SLAs).
INSERT INTO private.observability_settings (key) VALUES ('default') ON CONFLICT (key) DO NOTHING;

WITH seed_slis (code, name, description, service, characteristic, data_source, indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria, evaluation_period) AS (
  VALUES
    ('synthetic_availability', 'Disponibilidad sintética global', 'Porcentaje de comprobaciones sintéticas de disponibilidad respondidas con éxito.', 'platform', 'Disponibilidad externa', 'synthetic_availability', 'availability', '%', '{"includeNotExecuted":false}'::jsonb, 'Sondeos sintéticos regulares de Web, API y PostgreSQL.', 'Simulacros (recovery-drill) y comprobaciones no ejecutadas.', '7d'),
    ('synthetic_latency_p95', 'Latencia externa P95 en sondas', 'Percentil 95 de latencia de extremo a extremo en sondeos sintéticos exitosos.', 'platform', 'Latencia percibida', 'synthetic_availability', 'latency_percentile', 'ms', '{"percentile":95}'::jsonb, 'Sondeos sintéticos exitosos (HTTP 2xx).', 'Sondeos fallidos o simulacros de recuperación.', '7d'),
    ('api_error_rate_5xx', 'Tasa de errores 5xx de la API', 'Porcentaje de solicitudes HTTP reales respondidas con código de servidor >= 500.', 'api', 'Confiabilidad HTTP', 'operational_http', 'error_rate', '%', '{"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Eventos http.request reales en la API.', 'Rutas de salud (/api/health*) e ingesta interna.', '7d'),
    ('api_write_success_rate', 'Éxito de operaciones de escritura', 'Porcentaje de mutaciones (POST/PUT/PATCH/DELETE) completadas sin error 5xx ni aborto.', 'api', 'Integridad operativa', 'operational_http', 'operation_success_rate', '%', '{"methods":["POST","PUT","PATCH","DELETE"],"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Mutaciones HTTP exitosas (2xx/3xx), fallidas (>=500) y abortadas.', 'Errores de validación 4xx y endpoints de salud.', '7d'),
    ('api_latency_p50', 'Latencia API P50', 'Mediana del tiempo de procesamiento en servidor de solicitudes reales.', 'api', 'Velocidad de respuesta típica', 'operational_http', 'latency_percentile', 'ms', '{"percentile":50,"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Solicitudes http.request medidas en el servidor.', 'Endpoints /api/health* y /api/observability*.', '7d'),
    ('api_latency_p95', 'Latencia API P95', 'Percentil 95 del tiempo de procesamiento en servidor de solicitudes reales.', 'api', 'Latencia en percentil alto', 'operational_http', 'latency_percentile', 'ms', '{"percentile":95,"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Solicitudes http.request medidas en el servidor.', 'Endpoints /api/health* y /api/observability*.', '7d'),
    ('api_latency_p99', 'Latencia API P99', 'Percentil 99 de cola larga en el servidor de la API.', 'api', 'Cola larga de latencia', 'operational_http', 'latency_percentile', 'ms', '{"percentile":99,"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Solicitudes http.request medidas en el servidor.', 'Endpoints /api/health* y /api/observability*.', '7d'),
    ('synthetic_recovery_time', 'Tiempo máximo de recuperación', 'Duración máxima entre el primer sondeo fallido de una interrupción y el siguiente sondeo exitoso.', 'platform', 'Recuperación ante fallos', 'synthetic_availability', 'recovery_time', 's', '{}'::jsonb, 'Interrupciones detectadas por sondas sintéticas con recuperación observada.', 'Sondeos sin interrupciones abiertas ni simulacros.', '7d'),
    ('synthetic_functional_success', 'Éxito de pruebas funcionales sintéticas', 'Porcentaje de comprobaciones funcionales representativas aprobadas sobre las ejecutadas.', 'platform', 'Integridad funcional', 'synthetic_functional', 'functional_test_success', '%', '{"includeNotExecuted":false}'::jsonb, 'Pruebas funcionales sintéticas ejecutadas con validación de contenido.', 'Pruebas marcadas como no ejecutadas por falta de credenciales o configuración.', '7d')
),
inserted_slis AS (
  INSERT INTO private.observability_sli_definitions (
    code, current_version, name, description, service, characteristic, data_source,
    indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria, evaluation_period, is_active
  )
  SELECT code, 1, name, description, service, characteristic, data_source,
    indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria, evaluation_period, true
  FROM seed_slis
  ON CONFLICT (code) DO NOTHING
  RETURNING *
)
INSERT INTO private.observability_sli_versions (sli_id, version, snapshot, change_reason)
SELECT id, 1, to_jsonb(inserted_slis), 'Definición inicial del catálogo interno de observabilidad'
FROM inserted_slis
ON CONFLICT (sli_id, version) DO NOTHING;

WITH seed_slos (code, sli_code, name, description, target_value, comparison_operator, unit, evaluation_period, min_samples) AS (
  VALUES
    ('slo_availability', 'synthetic_availability', 'Disponibilidad sintética >= 99.0 %', 'Objetivo interno de disponibilidad observada de la plataforma (no contractual, sujeto a Render Free).', 99.000, '>=', '%', '7d', 1),
    ('slo_synthetic_latency_p95', 'synthetic_latency_p95', 'Latencia externa P95 <= 1000 ms', 'Objetivo interno de latencia percibida desde el exterior en sondas exitosas (DEC-013).', 1000.000, '<=', 'ms', '7d', 20),
    ('slo_error_rate_5xx', 'api_error_rate_5xx', 'Tasa de errores 5xx <= 0.5 %', 'Objetivo interno de confiabilidad del backend frente a fallos de servidor.', 0.500, '<=', '%', '7d', 1),
    ('slo_write_success', 'api_write_success_rate', 'Éxito de escrituras >= 99.5 %', 'Objetivo interno de integridad en operaciones de escritura.', 99.500, '>=', '%', '7d', 1),
    ('slo_api_latency_p50', 'api_latency_p50', 'Latencia servidor P50 <= 300 ms', 'Objetivo interno de mediana de respuesta del backend.', 300.000, '<=', 'ms', '7d', 20),
    ('slo_api_latency_p95', 'api_latency_p95', 'Latencia servidor P95 <= 1000 ms', 'Objetivo interno de lectura/escritura P95 en servidor (DEC-013).', 1000.000, '<=', 'ms', '7d', 20),
    ('slo_api_latency_p99', 'api_latency_p99', 'Latencia servidor P99 <= 2000 ms', 'Objetivo interno de cola larga por debajo del timeout del servidor.', 2000.000, '<=', 'ms', '7d', 100),
    ('slo_recovery_time', 'synthetic_recovery_time', 'Tiempo máximo de recuperación <= 65 s', 'Objetivo interno de recuperación ante interrupciones o arranque en frío (DEC-013).', 65.000, '<=', 's', '7d', 1),
    ('slo_functional_success', 'synthetic_functional_success', 'Éxito de pruebas funcionales >= 95.0 %', 'Objetivo interno para comprobaciones funcionales sintéticas ejecutadas.', 95.000, '>=', '%', '7d', 1)
),
inserted_slos AS (
  INSERT INTO private.observability_slo_definitions (
    code, sli_id, current_version, name, description, target_value, comparison_operator,
    unit, evaluation_period, min_samples, status, is_contractual
  )
  SELECT
    o.code, s.id, 1, o.name, o.description, o.target_value, o.comparison_operator,
    o.unit, o.evaluation_period, o.min_samples, 'active', false
  FROM seed_slos o
  JOIN private.observability_sli_definitions s ON s.code = o.sli_code
  ON CONFLICT (code) DO NOTHING
  RETURNING *
)
INSERT INTO private.observability_slo_versions (
  slo_id, version, sli_version, target_value, comparison_operator, unit,
  evaluation_period, min_samples, effective_from, snapshot, change_reason
)
SELECT
  id, 1, 1, target_value, comparison_operator, unit,
  evaluation_period, min_samples, effective_from, to_jsonb(inserted_slos),
  'Objetivo interno inicial alineado con slo.config.json (DEC-013)'
FROM inserted_slos
ON CONFLICT (slo_id, version) DO NOTHING;

-- Bound sampling and read the configuration version in force at the observation.
CREATE FUNCTION private.observability_ingest_snapshot(
  p_env text,
  p_since timestamptz,
  p_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  RETURN (
    WITH logs AS (
      SELECT l.occurred_at AS "occurredAt", l.service, l.module, l.source,
        l.event_type AS "eventType", l.severity, l.normalized_path AS "normalizedPath",
        l.http_method AS "httpMethod", l.status_code AS "statusCode",
        l.duration_ms::float8 AS "durationMs", l.outcome
      FROM private.observability_logs l
      WHERE l.environment = p_env AND l.occurred_at BETWEEN p_since AND p_until
        AND l.metadata->'synthetic' IS DISTINCT FROM 'true'::jsonb
      ORDER BY l.occurred_at DESC, l.id DESC
      LIMIT 50001
    ), checks AS (
      SELECT c.check_key AS "checkKey", c.check_name AS "checkName",
        c.check_kind AS "checkKind", c.service, c.module, c.target, c.phase,
        c.executed_at AS "executedAt", c.status, c.duration_ms::float8 AS "durationMs",
        c.http_status AS "httpStatus", c.correlation_id AS "correlationId",
        c.error_message AS "errorMessage", r.category AS "runCategory"
      FROM private.observability_check_results c
      JOIN private.observability_test_runs r ON r.id = c.run_id
      WHERE c.environment = p_env AND c.executed_at BETWEEN p_since AND p_until
      ORDER BY c.executed_at DESC, c.id DESC
      LIMIT 25001
    ), slis AS (
      SELECT jsonb_build_object(
        'id', d.id, 'code', d.code, 'currentVersion', v.version,
        'name', v.snapshot->>'name', 'description', v.snapshot->>'description',
        'service', v.snapshot->>'service', 'characteristic', v.snapshot->>'characteristic',
        'dataSource', COALESCE(v.snapshot->>'dataSource', v.snapshot->>'data_source'),
        'indicatorType', COALESCE(v.snapshot->>'indicatorType', v.snapshot->>'indicator_type'),
        'unit', v.snapshot->>'unit',
        'calculationMethod', COALESCE(v.snapshot->'calculationMethod', v.snapshot->'calculation_method', '{}'::jsonb),
        'inclusionCriteria', COALESCE(v.snapshot->>'inclusionCriteria', v.snapshot->>'inclusion_criteria'),
        'exclusionCriteria', COALESCE(v.snapshot->>'exclusionCriteria', v.snapshot->>'exclusion_criteria'),
        'evaluationPeriod', COALESCE(v.snapshot->>'evaluationPeriod', v.snapshot->>'evaluation_period'),
        'isActive', COALESCE(v.snapshot->'isActive', v.snapshot->'is_active'),
        'createdAt', d.created_at, 'updatedAt', v.created_at, 'versionFrom', v.effective_from
      ) AS item
      FROM private.observability_sli_definitions d
      JOIN LATERAL (
        SELECT svi.*
        FROM private.observability_sli_versions svi
        WHERE svi.sli_id = d.id
          AND svi.effective_from <= p_until
          AND (svi.effective_to IS NULL OR svi.effective_to > p_until)
        ORDER BY svi.version DESC
        LIMIT 1
      ) v ON true
      ORDER BY d.code
    ), slos AS (
      SELECT jsonb_build_object(
        'id', d.id, 'code', d.code, 'sliId', COALESCE(v.snapshot->>'sliId', v.snapshot->>'sli_id'),
        'currentVersion', v.version, 'name', v.snapshot->>'name',
        'description', v.snapshot->>'description', 'targetValue', v.target_value::float8,
        'comparisonOperator', v.comparison_operator, 'unit', v.unit,
        'evaluationPeriod', v.evaluation_period, 'minSamples', v.min_samples,
        'effectiveFrom', v.effective_from, 'effectiveTo', v.effective_to,
        'status', v.snapshot->>'status',
        'isContractual', COALESCE(v.snapshot->'isContractual', v.snapshot->'is_contractual', 'false'::jsonb),
        'createdAt', d.created_at, 'updatedAt', v.created_at,
        'versionFrom', GREATEST(v.effective_from, v.created_at)
      ) AS item
      FROM private.observability_slo_definitions d
      JOIN LATERAL (
        SELECT svo.*
        FROM private.observability_slo_versions svo
        WHERE svo.slo_id = d.id
          AND GREATEST(svo.created_at, svo.effective_from) <= p_until
          AND (svo.effective_to IS NULL OR svo.effective_to > p_until)
        ORDER BY svo.version DESC
        LIMIT 1
      ) v ON true
      ORDER BY d.code
    )
    SELECT jsonb_build_object(
      'settings', private.read_observability_runtime_config(),
      'logs', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM (SELECT * FROM logs LIMIT 50000) l), '[]'::jsonb),
      'checks', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT * FROM checks LIMIT 25000) c), '[]'::jsonb),
      'logsTruncated', (SELECT count(*) > 50000 FROM logs),
      'checksTruncated', (SELECT count(*) > 25000 FROM checks),
      'slis', COALESCE((SELECT jsonb_agg(item) FROM slis), '[]'::jsonb),
      'slos', COALESCE((SELECT jsonb_agg(item) FROM slos), '[]'::jsonb)
    )
  );
END $$;
REVOKE ALL ON FUNCTION private.observability_ingest_snapshot(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_ingest_snapshot(text, timestamptz, timestamptz) TO couchone_authentication;

-- Feed the unified admin log query without exposing access subject details.
CREATE FUNCTION private.observability_access_event_logs(
  p_from timestamptz,
  p_to timestamptz,
  p_id uuid
) RETURNS TABLE(id uuid, action text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT e.id, e.action, e.created_at
  FROM private.access_events e
  WHERE (p_from IS NULL OR e.created_at >= p_from)
    AND (p_to IS NULL OR e.created_at <= p_to)
    AND (p_id IS NULL OR e.id = p_id);
END $$;
REVOKE ALL ON FUNCTION private.observability_access_event_logs(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_access_event_logs(timestamptz, timestamptz, uuid) TO couchone_authentication;

-- Prevent old observations and repeat analyses from reopening or counting incidents again.
CREATE OR REPLACE FUNCTION private.upsert_observability_incident(
  p_dedupe_key text,
  p_env text,
  p_service text,
  p_type text,
  p_severity text,
  p_title text,
  p_summary text,
  p_seen_at timestamptz,
  p_correlation_id text,
  p_slo_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  IF EXISTS (
    SELECT 1 FROM private.observability_incidents
    WHERE dedupe_key = p_dedupe_key AND resolved_at >= p_seen_at
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO private.observability_incidents (
    dedupe_key, environment, service, incident_type, severity, status,
    title, summary, started_at, last_seen_at, occurrence_count, correlation_id, slo_id, updated_at
  )
  VALUES (
    p_dedupe_key, p_env, p_service, p_type, p_severity, 'open',
    p_title, p_summary, p_seen_at, p_seen_at, 1, p_correlation_id, p_slo_id, clock_timestamp()
  )
  ON CONFLICT (dedupe_key) WHERE status IN ('open', 'acknowledged')
  DO UPDATE SET
    severity = CASE
      WHEN private.observability_incidents.severity = 'critical' OR EXCLUDED.severity = 'critical' THEN 'critical'
      WHEN private.observability_incidents.severity = 'high' OR EXCLUDED.severity = 'high' THEN 'high'
      WHEN private.observability_incidents.severity = 'medium' OR EXCLUDED.severity = 'medium' THEN 'medium'
      ELSE 'low'
    END,
    summary = EXCLUDED.summary,
    last_seen_at = GREATEST(private.observability_incidents.last_seen_at, EXCLUDED.last_seen_at),
    occurrence_count = private.observability_incidents.occurrence_count + 1,
    correlation_id = COALESCE(EXCLUDED.correlation_id, private.observability_incidents.correlation_id),
    updated_at = clock_timestamp()
  WHERE private.observability_incidents.last_seen_at < EXCLUDED.last_seen_at
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION private.resolve_observability_incident(
  p_dedupe_key text,
  p_resolved_at timestamptz,
  p_notes text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_updated integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  UPDATE private.observability_incidents
  SET
    status = 'resolved',
    resolved_at = p_resolved_at,
    recovery_duration_s = round(GREATEST(EXTRACT(EPOCH FROM (p_resolved_at - started_at)), 0)::numeric, 1),
    resolution_notes = COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), resolution_notes),
    updated_at = clock_timestamp()
  WHERE dedupe_key = p_dedupe_key
    AND status IN ('open', 'acknowledged')
    AND last_seen_at <= p_resolved_at;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $$;

-- Limit automatic snapshots to one evaluation batch per environment and UTC hour.
ALTER TABLE private.observability_slo_evaluations ADD COLUMN automatic boolean NOT NULL DEFAULT false;
CREATE INDEX idx_obs_slo_evals_automatic_hour
  ON private.observability_slo_evaluations (environment, evaluated_at) WHERE automatic;

CREATE FUNCTION private.observability_needs_hourly_evaluation(p_env text, p_at timestamptz) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_start timestamptz := date_trunc('hour', p_at, 'UTC');
BEGIN
  IF current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM private.observability_slo_evaluations
    WHERE automatic AND environment = p_env
      AND evaluated_at >= v_start AND evaluated_at < v_start + interval '1 hour'
  );
END $$;
REVOKE ALL ON FUNCTION private.observability_needs_hourly_evaluation(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_needs_hourly_evaluation(text, timestamptz) TO couchone_authentication;

CREATE OR REPLACE FUNCTION private.record_observability_slo_evaluation(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  INSERT INTO private.observability_slo_evaluations (
    slo_id, slo_version, environment, period_start, period_end, target_value,
    observed_value, delta_value, samples, not_executed_count, compliance_status,
    error_budget_total, error_budget_consumed, error_budget_remaining_pct, notes, evaluated_at, automatic
  )
  VALUES (
    (payload->>'sloId')::uuid,
    (payload->>'sloVersion')::integer,
    payload->>'environment',
    (payload->>'periodStart')::timestamptz,
    (payload->>'periodEnd')::timestamptz,
    (payload->>'targetValue')::numeric,
    CASE WHEN payload->>'observedValue' IS NULL THEN NULL ELSE (payload->>'observedValue')::numeric END,
    CASE WHEN payload->>'deltaValue' IS NULL THEN NULL ELSE (payload->>'deltaValue')::numeric END,
    COALESCE((payload->>'samples')::integer, 0),
    COALESCE((payload->>'notExecutedCount')::integer, 0),
    payload->>'complianceStatus',
    CASE WHEN payload->>'errorBudgetTotal' IS NULL THEN NULL ELSE (payload->>'errorBudgetTotal')::numeric END,
    CASE WHEN payload->>'errorBudgetConsumed' IS NULL THEN NULL ELSE (payload->>'errorBudgetConsumed')::numeric END,
    CASE WHEN payload->>'errorBudgetRemainingPct' IS NULL THEN NULL ELSE (payload->>'errorBudgetRemainingPct')::numeric END,
    NULLIF(btrim(COALESCE(payload->>'notes', '')), ''),
    COALESCE((payload->>'evaluatedAt')::timestamptz, clock_timestamp()),
    COALESCE((payload->>'automatic')::boolean, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Keep history sizes bounded and operational rollups free of monitor traffic.
CREATE OR REPLACE FUNCTION private.prune_observability_data() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE
  v_log_days integer;
  v_check_days integer;
  v_eval_days integer;
  v_log_cutoff timestamptz;
  v_check_cutoff timestamptz;
  v_eval_cutoff timestamptz;
  v_deleted_logs integer := 0;
  v_deleted_checks integer := 0;
  v_deleted_evals integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  SELECT log_retention_days, check_retention_days, evaluation_retention_days
  INTO v_log_days, v_check_days, v_eval_days
  FROM private.observability_settings
  WHERE key = 'default';

  v_log_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_log_days, 30));
  v_check_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_check_days, 90));
  v_eval_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_eval_days, 365));

  -- Aggregate hourly HTTP rollups before deleting expired raw logs.
  INSERT INTO private.observability_hourly_rollups (
    environment, service, module, bucket_hour, requests_total, success_count,
    client_error_count, server_error_count, aborted_count, duration_avg_ms,
    duration_p50_ms, duration_p95_ms, duration_p99_ms, updated_at
  )
  SELECT
    l.environment,
    l.service,
    l.module,
    date_trunc('hour', l.occurred_at) AS bucket_hour,
    count(*)::integer,
    count(*) FILTER (WHERE l.outcome = 'success')::integer,
    count(*) FILTER (WHERE l.outcome = 'client_error')::integer,
    count(*) FILTER (WHERE l.outcome = 'server_error')::integer,
    count(*) FILTER (WHERE l.outcome = 'aborted')::integer,
    round(avg(l.duration_ms)::numeric, 1),
    round((percentile_disc(0.50) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    round((percentile_disc(0.95) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    round((percentile_disc(0.99) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    clock_timestamp()
  FROM private.observability_logs l
  WHERE l.occurred_at < v_log_cutoff
    AND l.event_type IN ('http.request', 'http.aborted')
    AND l.metadata->'synthetic' IS DISTINCT FROM 'true'::jsonb
  GROUP BY l.environment, l.service, l.module, date_trunc('hour', l.occurred_at)
  ON CONFLICT (environment, service, module, bucket_hour)
  DO UPDATE SET
    requests_total = GREATEST(private.observability_hourly_rollups.requests_total, EXCLUDED.requests_total),
    success_count = GREATEST(private.observability_hourly_rollups.success_count, EXCLUDED.success_count),
    client_error_count = GREATEST(private.observability_hourly_rollups.client_error_count, EXCLUDED.client_error_count),
    server_error_count = GREATEST(private.observability_hourly_rollups.server_error_count, EXCLUDED.server_error_count),
    aborted_count = GREATEST(private.observability_hourly_rollups.aborted_count, EXCLUDED.aborted_count),
    duration_avg_ms = COALESCE(EXCLUDED.duration_avg_ms, private.observability_hourly_rollups.duration_avg_ms),
    duration_p50_ms = COALESCE(EXCLUDED.duration_p50_ms, private.observability_hourly_rollups.duration_p50_ms),
    duration_p95_ms = COALESCE(EXCLUDED.duration_p95_ms, private.observability_hourly_rollups.duration_p95_ms),
    duration_p99_ms = COALESCE(EXCLUDED.duration_p99_ms, private.observability_hourly_rollups.duration_p99_ms),
    updated_at = clock_timestamp();

  INSERT INTO private.observability_hourly_rollups (
    environment, service, module, bucket_hour, synthetic_total, synthetic_passed,
    synthetic_failed, synthetic_not_executed, updated_at
  )
  SELECT
    c.environment,
    c.service,
    c.module,
    date_trunc('hour', c.executed_at) AS bucket_hour,
    count(*)::integer,
    count(*) FILTER (WHERE c.status = 'passed')::integer,
    count(*) FILTER (WHERE c.status = 'failed')::integer,
    count(*) FILTER (WHERE c.status = 'not_executed')::integer,
    clock_timestamp()
  FROM private.observability_check_results c
  WHERE c.executed_at < v_check_cutoff
    AND c.phase <> 'recovery-drill'
  GROUP BY c.environment, c.service, c.module, date_trunc('hour', c.executed_at)
  ON CONFLICT (environment, service, module, bucket_hour)
  DO UPDATE SET
    synthetic_total = GREATEST(private.observability_hourly_rollups.synthetic_total, EXCLUDED.synthetic_total),
    synthetic_passed = GREATEST(private.observability_hourly_rollups.synthetic_passed, EXCLUDED.synthetic_passed),
    synthetic_failed = GREATEST(private.observability_hourly_rollups.synthetic_failed, EXCLUDED.synthetic_failed),
    synthetic_not_executed = GREATEST(private.observability_hourly_rollups.synthetic_not_executed, EXCLUDED.synthetic_not_executed),
    updated_at = clock_timestamp();

  DELETE FROM private.observability_logs WHERE occurred_at < v_log_cutoff;
  GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

  DELETE FROM private.observability_check_results WHERE executed_at < v_check_cutoff;
  GET DIAGNOSTICS v_deleted_checks = ROW_COUNT;

  DELETE FROM private.observability_test_runs r
  WHERE r.finished_at < v_check_cutoff
    AND NOT EXISTS (SELECT 1 FROM private.observability_check_results c WHERE c.run_id = r.id);
  DELETE FROM private.observability_hourly_rollups WHERE bucket_hour < v_eval_cutoff;
  DELETE FROM private.observability_slo_evaluations WHERE evaluated_at < v_eval_cutoff;
  GET DIAGNOSTICS v_deleted_evals = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletedLogs', v_deleted_logs,
    'deletedChecks', v_deleted_checks,
    'deletedEvaluations', v_deleted_evals
  );
END $$;

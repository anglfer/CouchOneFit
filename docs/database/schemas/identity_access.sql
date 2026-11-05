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

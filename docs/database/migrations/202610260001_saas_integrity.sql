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

-- Preserve the selected catalog plan without changing the historical registration-interest enum.
ALTER TABLE private.professionals ADD COLUMN plan_interest_id uuid
  CONSTRAINT fk_professionals_plan_interest REFERENCES private.saas_plans(id) ON DELETE RESTRICT;
GRANT SELECT ON private.saas_plans TO couchone_registration;
CREATE POLICY select_registration_plans ON private.saas_plans FOR SELECT TO couchone_registration USING(is_active);

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

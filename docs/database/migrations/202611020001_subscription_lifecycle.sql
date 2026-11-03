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

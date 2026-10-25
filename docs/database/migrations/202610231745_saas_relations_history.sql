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
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
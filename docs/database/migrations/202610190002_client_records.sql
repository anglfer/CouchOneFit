-- Client records and account linkage for post-activation mobile access (HU-004 / HU-008 / HU-015).
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
REVOKE ALL ON TABLE private.clients FROM PUBLIC;
ALTER TABLE private.clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON private.clients TO couchone_authentication;
CREATE POLICY select_clients ON private.clients FOR SELECT TO couchone_authentication USING (true);


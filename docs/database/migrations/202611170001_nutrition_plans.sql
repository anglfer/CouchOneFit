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
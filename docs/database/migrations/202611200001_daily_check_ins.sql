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

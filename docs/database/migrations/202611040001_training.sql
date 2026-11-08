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

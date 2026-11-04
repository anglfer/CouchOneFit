-- Historical visibility covers the version in force at the beginning of the correction window.
DROP POLICY training_version_read ON private.training_versions;
CREATE POLICY training_version_read ON private.training_versions FOR SELECT TO couchone_authentication USING (
 EXISTS(SELECT 1 FROM private.training_plans p WHERE p.id=plan_id AND private.training_professional(p.owner_id))
 OR (published AND (
 EXISTS(SELECT 1 FROM private.training_active a WHERE a.version_id=training_versions.id AND private.training_client_access(a.client_id))
 OR EXISTS(SELECT 1 FROM private.training_sessions s WHERE s.version_id=training_versions.id AND private.training_client_access(s.client_id))
 OR EXISTS(SELECT 1 FROM private.training_activations a WHERE a.version_id=training_versions.id AND private.training_client_access(a.client_id)
   AND (a.local_date >= (CURRENT_TIMESTAMP AT TIME ZONE a.time_zone)::date-2 OR NOT EXISTS(
     SELECT 1 FROM private.training_activations newer WHERE newer.client_id=a.client_id AND newer.revision>a.revision
     AND newer.local_date <= (CURRENT_TIMESTAMP AT TIME ZONE a.time_zone)::date-2))))));

CREATE FUNCTION private.guard_training_session() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE zone text; BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.client_id,NEW.version_id,NEW.day_id,NEW.local_date,NEW.time_zone,NEW.created_at)
     IS DISTINCT FROM (OLD.id,OLD.client_id,OLD.version_id,OLD.day_id,OLD.local_date,OLD.time_zone,OLD.created_at)
     OR NEW.revision<>OLD.revision+1 OR (OLD.status='finalized' AND NEW.status<>'finalized') THEN
   RAISE EXCEPTION 'Training session identity is immutable' USING ERRCODE='23514';
  END IF;
 ELSE
  SELECT time_zone INTO zone FROM private.clients WHERE id=NEW.client_id;
  IF NEW.time_zone IS DISTINCT FROM zone OR NEW.revision<>1 OR NOT EXISTS(
   SELECT 1 FROM private.training_versions v JOIN private.training_plans p ON p.id=v.plan_id
   JOIN private.training_days d ON d.version_id=v.id WHERE v.id=NEW.version_id AND p.client_id=NEW.client_id
   AND v.published AND d.id=NEW.day_id AND d.kind='training') THEN
   RAISE EXCEPTION 'Invalid training session prescription' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_session BEFORE INSERT OR UPDATE ON private.training_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_training_session();

-- Deferred: the session and its full result set are written together in one transaction.
CREATE FUNCTION private.check_training_finalization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; expected integer; actual integer; s private.training_sessions%ROWTYPE; BEGIN
 IF TG_TABLE_NAME='training_sessions' THEN target:=NEW.id;
 ELSIF TG_OP='DELETE' THEN target:=OLD.session_id; ELSE target:=NEW.session_id; END IF;
 SELECT * INTO s FROM private.training_sessions WHERE id=target;
 IF s.status='finalized' THEN
  SELECT count(*) INTO expected FROM private.training_sets ps JOIN private.training_exercises e ON e.version_id=ps.version_id AND e.id=ps.exercise_id WHERE e.version_id=s.version_id AND e.day_id=s.day_id;
  SELECT count(*) INTO actual FROM private.training_results WHERE session_id=target;
  IF expected=0 OR expected<>actual THEN RAISE EXCEPTION 'Finalized training session requires every prescribed set' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_training_finalization AFTER INSERT OR UPDATE ON private.training_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_training_finalization();
CREATE CONSTRAINT TRIGGER check_training_results_finalization AFTER INSERT OR UPDATE OR DELETE ON private.training_results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.check_training_finalization();

CREATE FUNCTION private.guard_training_target_load() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mode text; BEGIN
 SELECT load_mode INTO mode FROM private.training_exercises WHERE version_id=NEW.version_id AND id=NEW.exercise_id;
 IF NEW.target_load_kg IS NOT NULL AND ((mode='bodyweight' AND NEW.target_load_kg<>0) OR (mode='external' AND NEW.target_load_kg<=0)) THEN
  RAISE EXCEPTION 'Invalid prescribed target load' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_training_target_load BEFORE INSERT OR UPDATE ON private.training_sets FOR EACH ROW EXECUTE FUNCTION private.guard_training_target_load();

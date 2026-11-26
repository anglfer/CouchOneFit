-- SLA v3.0 compliance: operations log (backups, drills, incidents, windows),
-- audit vocabulary, and measurement defaults aligned with the agreement.

CREATE TABLE private.observability_sla_records (
  id uuid CONSTRAINT pk_observability_sla_records PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CONSTRAINT ck_obs_sla_records_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  kind text NOT NULL CONSTRAINT ck_obs_sla_records_kind CHECK (kind IN ('maintenance_window', 'provider_incident', 'support_incident', 'backup', 'restore_drill', 'access_cleanup', 'storage_measurement', 'load_test', 'monthly_report', 'deployment')),
  occurred_at timestamptz NOT NULL,
  ended_at timestamptz CONSTRAINT ck_obs_sla_records_range CHECK (ended_at IS NULL OR ended_at >= occurred_at),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT ck_obs_sla_records_details CHECK (jsonb_typeof(details) = 'object'),
  source text NOT NULL CONSTRAINT ck_obs_sla_records_source CHECK (source IN ('admin', 'automation')),
  external_id text CONSTRAINT uk_obs_sla_records_external UNIQUE CONSTRAINT ck_obs_sla_records_external CHECK (external_id IS NULL OR char_length(external_id) BETWEEN 1 AND 160),
  created_by uuid CONSTRAINT fk_obs_sla_records_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_sla_records_env_occurred ON private.observability_sla_records (environment, occurred_at);

REVOKE ALL ON private.observability_sla_records FROM PUBLIC;
ALTER TABLE private.observability_sla_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON private.observability_sla_records TO couchone_authentication;
CREATE POLICY admin_observability_sla_records ON private.observability_sla_records FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);

-- Token-scoped, idempotent insert for automation (backups, cleanups, deployments, load tests, storage).
CREATE FUNCTION private.record_observability_sla_operation(
  p_environment text,
  p_kind text,
  p_occurred_at timestamptz,
  p_details jsonb,
  p_external_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE
  v_row private.observability_sla_records;
  v_duplicate boolean := false;
BEGIN
  IF current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  IF p_kind NOT IN ('backup', 'access_cleanup', 'deployment', 'load_test', 'storage_measurement') THEN
    RAISE EXCEPTION 'OBSERVABILITY_INVALID_KIND';
  END IF;
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RAISE EXCEPTION 'OBSERVABILITY_EXTERNAL_ID_REQUIRED';
  END IF;

  INSERT INTO private.observability_sla_records (environment, kind, occurred_at, details, source, external_id)
  VALUES (p_environment, p_kind, p_occurred_at, COALESCE(p_details, '{}'::jsonb), 'automation', p_external_id)
  ON CONFLICT (external_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM private.observability_sla_records WHERE external_id = p_external_id;
    v_duplicate := true;
  END IF;

  RETURN jsonb_build_object(
    'duplicate', v_duplicate,
    'record', jsonb_build_object(
      'id', v_row.id,
      'environment', v_row.environment,
      'kind', v_row.kind,
      'occurredAt', v_row.occurred_at,
      'endedAt', v_row.ended_at,
      'details', v_row.details,
      'source', v_row.source
    )
  );
END $$;
REVOKE ALL ON FUNCTION private.record_observability_sla_operation(text, text, timestamptz, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_observability_sla_operation(text, text, timestamptz, jsonb, text) TO couchone_authentication;

-- Audit vocabulary for administrator writes on the SLA log.
ALTER TABLE private.observability_audit_log DROP CONSTRAINT ck_obs_audit_entity;
ALTER TABLE private.observability_audit_log ADD CONSTRAINT ck_obs_audit_entity CHECK (entity_type IN ('sli', 'slo', 'sla', 'settings', 'incident', 'check_run', 'maintenance', 'sla_record'));
ALTER TABLE private.observability_audit_log DROP CONSTRAINT ck_obs_audit_action;
ALTER TABLE private.observability_audit_log ADD CONSTRAINT ck_obs_audit_action CHECK (action IN ('created', 'updated', 'status_changed', 'evaluated', 'acknowledged', 'resolved', 'manual_run', 'pruned', 'deleted'));

-- SLA 8.6: probes every 30 minutes; the monthly report needs the whole previous month of logs (62 days).
ALTER TABLE private.observability_settings ALTER COLUMN check_interval_minutes SET DEFAULT 30;
ALTER TABLE private.observability_settings ALTER COLUMN log_retention_days SET DEFAULT 62;
UPDATE private.observability_settings SET check_interval_minutes = 30 WHERE check_interval_minutes = 5;
UPDATE private.observability_settings SET log_retention_days = 62 WHERE log_retention_days < 62;

-- Observability, automated checks, SLI/SLO/SLA management, incidents, and retention.
-- Follows private.* conventions, parameterized API access, and strict admin-only RLS.

CREATE TABLE private.observability_logs (
  id uuid CONSTRAINT pk_observability_logs PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL CONSTRAINT ck_obs_logs_corr CHECK (char_length(correlation_id) BETWEEN 1 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  environment text NOT NULL CONSTRAINT ck_obs_logs_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  service text NOT NULL CONSTRAINT ck_obs_logs_service CHECK (char_length(service) BETWEEN 1 AND 60),
  module text NOT NULL CONSTRAINT ck_obs_logs_module CHECK (char_length(module) BETWEEN 1 AND 60),
  source text NOT NULL CONSTRAINT ck_obs_logs_source CHECK (source IN ('operational', 'error', 'client_telemetry', 'system')),
  event_type text NOT NULL CONSTRAINT ck_obs_logs_event CHECK (char_length(event_type) BETWEEN 1 AND 80),
  severity text NOT NULL CONSTRAINT ck_obs_logs_severity CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
  operation text NOT NULL CONSTRAINT ck_obs_logs_op CHECK (char_length(operation) BETWEEN 1 AND 160),
  normalized_path text,
  http_method text CONSTRAINT ck_obs_logs_method CHECK (http_method IS NULL OR http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
  status_code integer CONSTRAINT ck_obs_logs_status CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  duration_ms numeric(10,1) CONSTRAINT ck_obs_logs_duration CHECK (duration_ms IS NULL OR duration_ms >= 0),
  outcome text NOT NULL CONSTRAINT ck_obs_logs_outcome CHECK (outcome IN ('success', 'client_error', 'server_error', 'aborted', 'timeout', 'recovered', 'info')),
  error_code text,
  error_message text,
  system_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_logs_env_occurred ON private.observability_logs (environment, occurred_at DESC, id DESC);
CREATE INDEX idx_obs_logs_correlation ON private.observability_logs (correlation_id, occurred_at DESC);
CREATE INDEX idx_obs_logs_service_occurred ON private.observability_logs (environment, service, occurred_at DESC);
CREATE INDEX idx_obs_logs_severity_occurred ON private.observability_logs (environment, severity, occurred_at DESC);
CREATE INDEX idx_obs_logs_event_occurred ON private.observability_logs (environment, event_type, occurred_at DESC);

CREATE TABLE private.observability_test_runs (
  id uuid CONSTRAINT pk_observability_test_runs PRIMARY KEY DEFAULT gen_random_uuid(),
  external_run_id text CONSTRAINT uk_obs_test_runs_external UNIQUE,
  category text NOT NULL CONSTRAINT ck_obs_test_runs_cat CHECK (category IN ('synthetic_periodic', 'functional_automated', 'manual_admin', 'load_controlled', 'ci_suite')),
  environment text NOT NULL CONSTRAINT ck_obs_test_runs_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  trigger_source text NOT NULL CONSTRAINT ck_obs_test_runs_trigger CHECK (trigger_source IN ('github_actions', 'external_cli', 'admin_manual', 'local_runner', 'ci')),
  triggered_by uuid CONSTRAINT fk_obs_test_runs_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  status text NOT NULL CONSTRAINT ck_obs_test_runs_status CHECK (status IN ('passed', 'failed', 'partial', 'not_executed', 'blocked')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  duration_ms numeric(10,1) NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_dur CHECK (duration_ms >= 0),
  total_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_total CHECK (total_checks >= 0),
  passed_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_passed CHECK (passed_checks >= 0),
  failed_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_failed CHECK (failed_checks >= 0),
  not_executed_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_not_exec CHECK (not_executed_checks >= 0),
  skipped_checks integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_test_runs_skipped CHECK (skipped_checks >= 0),
  commit_sha text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_test_runs_env_started ON private.observability_test_runs (environment, started_at DESC, id DESC);

CREATE TABLE private.observability_check_results (
  id uuid CONSTRAINT pk_observability_check_results PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL CONSTRAINT fk_obs_checks_run REFERENCES private.observability_test_runs(id) ON DELETE RESTRICT,
  external_event_id text CONSTRAINT uk_obs_checks_external UNIQUE,
  correlation_id text NOT NULL,
  check_key text NOT NULL,
  check_name text NOT NULL,
  check_kind text NOT NULL CONSTRAINT ck_obs_checks_kind CHECK (check_kind IN ('synthetic_availability', 'synthetic_functional', 'automated_test', 'load_scenario')),
  service text NOT NULL,
  module text NOT NULL,
  environment text NOT NULL CONSTRAINT ck_obs_checks_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  target text,
  phase text NOT NULL DEFAULT 'regular',
  executed_at timestamptz NOT NULL,
  expected_result text NOT NULL,
  actual_result text NOT NULL,
  status text NOT NULL CONSTRAINT ck_obs_checks_status CHECK (status IN ('passed', 'failed', 'not_executed', 'skipped', 'blocked')),
  duration_ms numeric(10,1) CONSTRAINT ck_obs_checks_dur CHECK (duration_ms IS NULL OR duration_ms >= 0),
  http_status integer CONSTRAINT ck_obs_checks_http CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  error_code text,
  error_message text,
  assertions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_checks_env_executed ON private.observability_check_results (environment, executed_at DESC, id DESC);
CREATE INDEX idx_obs_checks_service_executed ON private.observability_check_results (environment, service, executed_at DESC);
CREATE INDEX idx_obs_checks_key_executed ON private.observability_check_results (environment, check_key, executed_at DESC);
CREATE INDEX idx_obs_checks_run ON private.observability_check_results (run_id, executed_at DESC);
CREATE INDEX idx_obs_checks_corr ON private.observability_check_results (correlation_id);

CREATE TABLE private.observability_sli_definitions (
  id uuid CONSTRAINT pk_observability_sli_definitions PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CONSTRAINT uk_obs_sli_code UNIQUE,
  current_version integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_sli_ver CHECK (current_version > 0),
  name text NOT NULL CONSTRAINT ck_obs_sli_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 120),
  description text NOT NULL CONSTRAINT ck_obs_sli_desc CHECK (char_length(btrim(description)) BETWEEN 3 AND 500),
  service text NOT NULL,
  characteristic text NOT NULL,
  data_source text NOT NULL CONSTRAINT ck_obs_sli_source CHECK (data_source IN ('operational_http', 'synthetic_availability', 'synthetic_functional', 'automated_tests', 'client_telemetry')),
  indicator_type text NOT NULL CONSTRAINT ck_obs_sli_type CHECK (indicator_type IN ('availability', 'latency_mean', 'latency_percentile', 'latency_threshold_pct', 'error_rate', 'operation_success_rate', 'reliability', 'recovery_time', 'functional_test_success')),
  unit text NOT NULL CONSTRAINT ck_obs_sli_unit CHECK (unit IN ('%', 'ms', 's', 'rps')),
  calculation_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  inclusion_criteria text NOT NULL,
  exclusion_criteria text NOT NULL,
  evaluation_period text NOT NULL CONSTRAINT ck_obs_sli_period CHECK (evaluation_period IN ('1h', '24h', '7d', '30d')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid CONSTRAINT fk_obs_sli_created_by REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_by uuid CONSTRAINT fk_obs_sli_updated_by REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_sli_versions (
  id uuid CONSTRAINT pk_observability_sli_versions PRIMARY KEY DEFAULT gen_random_uuid(),
  sli_id uuid NOT NULL CONSTRAINT fk_obs_sli_versions_sli REFERENCES private.observability_sli_definitions(id) ON DELETE RESTRICT,
  version integer NOT NULL CONSTRAINT ck_obs_sli_versions_num CHECK (version > 0),
  snapshot jsonb NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  changed_by uuid CONSTRAINT fk_obs_sli_versions_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uk_obs_sli_versions_num UNIQUE (sli_id, version)
);

CREATE TABLE private.observability_slo_definitions (
  id uuid CONSTRAINT pk_observability_slo_definitions PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CONSTRAINT uk_obs_slo_code UNIQUE,
  sli_id uuid NOT NULL CONSTRAINT fk_obs_slo_sli REFERENCES private.observability_sli_definitions(id) ON DELETE RESTRICT,
  current_version integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_slo_ver CHECK (current_version > 0),
  name text NOT NULL CONSTRAINT ck_obs_slo_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 140),
  description text NOT NULL CONSTRAINT ck_obs_slo_desc CHECK (char_length(btrim(description)) BETWEEN 3 AND 600),
  target_value numeric(12,3) NOT NULL,
  comparison_operator text NOT NULL CONSTRAINT ck_obs_slo_op CHECK (comparison_operator IN ('>=', '<=', '>', '<')),
  unit text NOT NULL CONSTRAINT ck_obs_slo_unit CHECK (unit IN ('%', 'ms', 's', 'rps')),
  evaluation_period text NOT NULL CONSTRAINT ck_obs_slo_period CHECK (evaluation_period IN ('1h', '24h', '7d', '30d')),
  min_samples integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_slo_min CHECK (min_samples >= 1),
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  status text NOT NULL DEFAULT 'active' CONSTRAINT ck_obs_slo_status CHECK (status IN ('active', 'inactive', 'archived')),
  is_contractual boolean NOT NULL DEFAULT false,
  created_by uuid CONSTRAINT fk_obs_slo_created_by REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_by uuid CONSTRAINT fk_obs_slo_updated_by REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_slo_versions (
  id uuid CONSTRAINT pk_observability_slo_versions PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_id uuid NOT NULL CONSTRAINT fk_obs_slo_versions_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  version integer NOT NULL CONSTRAINT ck_obs_slo_versions_num CHECK (version > 0),
  sli_version integer NOT NULL CONSTRAINT ck_obs_slo_versions_sli_ver CHECK (sli_version > 0),
  target_value numeric(12,3) NOT NULL,
  comparison_operator text NOT NULL CONSTRAINT ck_obs_slo_ver_op CHECK (comparison_operator IN ('>=', '<=', '>', '<')),
  unit text NOT NULL,
  evaluation_period text NOT NULL,
  min_samples integer NOT NULL CONSTRAINT ck_obs_slo_ver_min CHECK (min_samples >= 1),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  snapshot jsonb NOT NULL,
  changed_by uuid CONSTRAINT fk_obs_slo_versions_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uk_obs_slo_versions_num UNIQUE (slo_id, version)
);

CREATE TABLE private.observability_slo_evaluations (
  id uuid CONSTRAINT pk_observability_slo_evaluations PRIMARY KEY DEFAULT gen_random_uuid(),
  slo_id uuid NOT NULL CONSTRAINT fk_obs_slo_evals_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  slo_version integer NOT NULL CONSTRAINT ck_obs_slo_evals_ver CHECK (slo_version > 0),
  environment text NOT NULL CONSTRAINT ck_obs_slo_evals_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  target_value numeric(12,3) NOT NULL,
  observed_value numeric(12,3),
  delta_value numeric(12,3),
  samples integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_slo_evals_samples CHECK (samples >= 0),
  not_executed_count integer NOT NULL DEFAULT 0 CONSTRAINT ck_obs_slo_evals_not_exec CHECK (not_executed_count >= 0),
  compliance_status text NOT NULL CONSTRAINT ck_obs_slo_evals_status CHECK (compliance_status IN ('met', 'unmet', 'insufficient_data')),
  error_budget_total numeric(12,3),
  error_budget_consumed numeric(12,3),
  error_budget_remaining_pct numeric(8,2),
  notes text,
  evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_slo_evals_slo_env_time ON private.observability_slo_evaluations (slo_id, environment, evaluated_at DESC);

CREATE TABLE private.observability_slas (
  id uuid CONSTRAINT pk_observability_slas PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CONSTRAINT ck_obs_sla_name CHECK (char_length(btrim(name)) BETWEEN 3 AND 160),
  covered_service text NOT NULL CONSTRAINT ck_obs_sla_service CHECK (char_length(btrim(covered_service)) BETWEEN 2 AND 120),
  commitments text NOT NULL CONSTRAINT ck_obs_sla_commit CHECK (char_length(btrim(commitments)) BETWEEN 3 AND 2000),
  approval_status text NOT NULL DEFAULT 'draft' CONSTRAINT ck_obs_sla_approval CHECK (approval_status IN ('draft', 'internal_reference', 'formally_approved', 'expired')),
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  responsibilities text NOT NULL,
  exclusions text NOT NULL,
  breach_consequences text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid CONSTRAINT fk_obs_sla_created_by REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_by uuid CONSTRAINT fk_obs_sla_updated_by REFERENCES private.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_sla_slos (
  sla_id uuid NOT NULL CONSTRAINT fk_obs_sla_slos_sla REFERENCES private.observability_slas(id) ON DELETE CASCADE,
  slo_id uuid NOT NULL CONSTRAINT fk_obs_sla_slos_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  CONSTRAINT pk_observability_sla_slos PRIMARY KEY (sla_id, slo_id)
);

CREATE TABLE private.observability_incidents (
  id uuid CONSTRAINT pk_observability_incidents PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL,
  environment text NOT NULL CONSTRAINT ck_obs_inc_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  service text NOT NULL,
  incident_type text NOT NULL CONSTRAINT ck_obs_inc_type CHECK (incident_type IN ('service_outage', 'latency_spike', 'high_error_rate', 'consecutive_check_failure', 'slo_breach')),
  severity text NOT NULL CONSTRAINT ck_obs_inc_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CONSTRAINT ck_obs_inc_status CHECK (status IN ('open', 'acknowledged', 'resolved')),
  title text NOT NULL,
  summary text NOT NULL,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  resolved_at timestamptz,
  recovery_duration_s numeric(12,1),
  occurrence_count integer NOT NULL DEFAULT 1 CONSTRAINT ck_obs_inc_count CHECK (occurrence_count >= 1),
  correlation_id text,
  slo_id uuid CONSTRAINT fk_obs_inc_slo REFERENCES private.observability_slo_definitions(id) ON DELETE RESTRICT,
  acknowledged_by uuid CONSTRAINT fk_obs_inc_ack_by REFERENCES private.users(id) ON DELETE RESTRICT,
  resolution_notes text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX uk_obs_incidents_open_dedupe ON private.observability_incidents (dedupe_key) WHERE status IN ('open', 'acknowledged');
CREATE INDEX idx_obs_incidents_env_status_started ON private.observability_incidents (environment, status, started_at DESC);

CREATE TABLE private.observability_settings (
  key text CONSTRAINT pk_observability_settings PRIMARY KEY CONSTRAINT ck_obs_settings_key CHECK (key = 'default'),
  monitor_enabled boolean NOT NULL DEFAULT true,
  check_interval_minutes integer NOT NULL DEFAULT 5 CONSTRAINT ck_obs_settings_interval CHECK (check_interval_minutes IN (5, 10, 15, 30, 60)),
  log_retention_days integer NOT NULL DEFAULT 30 CONSTRAINT ck_obs_settings_log_ret CHECK (log_retention_days BETWEEN 7 AND 365),
  check_retention_days integer NOT NULL DEFAULT 90 CONSTRAINT ck_obs_settings_chk_ret CHECK (check_retention_days BETWEEN 14 AND 365),
  evaluation_retention_days integer NOT NULL DEFAULT 365 CONSTRAINT ck_obs_settings_eval_ret CHECK (evaluation_retention_days BETWEEN 30 AND 1095),
  incident_error_rate_threshold_pct numeric(5,2) NOT NULL DEFAULT 5.00 CONSTRAINT ck_obs_settings_err_pct CHECK (incident_error_rate_threshold_pct > 0 AND incident_error_rate_threshold_pct <= 100),
  incident_latency_p95_threshold_ms integer NOT NULL DEFAULT 2000 CONSTRAINT ck_obs_settings_lat CHECK (incident_latency_p95_threshold_ms BETWEEN 100 AND 60000),
  incident_consecutive_failures integer NOT NULL DEFAULT 2 CONSTRAINT ck_obs_settings_fail CHECK (incident_consecutive_failures BETWEEN 1 AND 20),
  updated_by uuid CONSTRAINT fk_obs_settings_actor REFERENCES private.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE private.observability_audit_log (
  id uuid CONSTRAINT pk_observability_audit_log PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL CONSTRAINT fk_obs_audit_admin REFERENCES private.users(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CONSTRAINT ck_obs_audit_entity CHECK (entity_type IN ('sli', 'slo', 'sla', 'settings', 'incident', 'check_run', 'maintenance')),
  entity_id text NOT NULL,
  action text NOT NULL CONSTRAINT ck_obs_audit_action CHECK (action IN ('created', 'updated', 'status_changed', 'evaluated', 'acknowledged', 'resolved', 'manual_run', 'pruned')),
  summary text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_obs_audit_created ON private.observability_audit_log (created_at DESC, id DESC);

CREATE TABLE private.observability_hourly_rollups (
  environment text NOT NULL CONSTRAINT ck_obs_rollup_env CHECK (environment IN ('production', 'staging', 'development', 'local', 'ci', 'test')),
  service text NOT NULL,
  module text NOT NULL,
  bucket_hour timestamptz NOT NULL,
  requests_total integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  client_error_count integer NOT NULL DEFAULT 0,
  server_error_count integer NOT NULL DEFAULT 0,
  aborted_count integer NOT NULL DEFAULT 0,
  duration_avg_ms numeric(10,1),
  duration_p50_ms numeric(10,1),
  duration_p95_ms numeric(10,1),
  duration_p99_ms numeric(10,1),
  synthetic_total integer NOT NULL DEFAULT 0,
  synthetic_passed integer NOT NULL DEFAULT 0,
  synthetic_failed integer NOT NULL DEFAULT 0,
  synthetic_not_executed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT pk_observability_hourly_rollups PRIMARY KEY (environment, service, module, bucket_hour)
);

-- RLS and minimum privileges: only active administrators read or manage observability tables directly.
REVOKE ALL ON
  private.observability_logs,
  private.observability_test_runs,
  private.observability_check_results,
  private.observability_sli_definitions,
  private.observability_sli_versions,
  private.observability_slo_definitions,
  private.observability_slo_versions,
  private.observability_slo_evaluations,
  private.observability_slas,
  private.observability_sla_slos,
  private.observability_incidents,
  private.observability_settings,
  private.observability_audit_log,
  private.observability_hourly_rollups
FROM PUBLIC;

ALTER TABLE private.observability_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_sli_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_sli_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slo_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slo_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slo_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_slas ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_sla_slos ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.observability_hourly_rollups ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON private.observability_logs, private.observability_hourly_rollups TO couchone_authentication;
GRANT SELECT, INSERT ON private.observability_test_runs, private.observability_check_results, private.observability_slo_evaluations, private.observability_audit_log TO couchone_authentication;
GRANT SELECT, INSERT, UPDATE (effective_to) ON private.observability_sli_versions, private.observability_slo_versions TO couchone_authentication;
GRANT SELECT, INSERT, UPDATE ON
  private.observability_sli_definitions,
  private.observability_slo_definitions,
  private.observability_slas,
  private.observability_incidents,
  private.observability_settings
TO couchone_authentication;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.observability_sla_slos TO couchone_authentication;

CREATE POLICY admin_observability_logs ON private.observability_logs FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_test_runs ON private.observability_test_runs FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_check_results ON private.observability_check_results FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_sli_definitions ON private.observability_sli_definitions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_sli_versions ON private.observability_sli_versions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slo_definitions ON private.observability_slo_definitions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slo_versions ON private.observability_slo_versions FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slo_evaluations ON private.observability_slo_evaluations FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_slas ON private.observability_slas FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_sla_slos ON private.observability_sla_slos FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_incidents ON private.observability_incidents FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_settings ON private.observability_settings FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_audit_log ON private.observability_audit_log FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);
CREATE POLICY admin_observability_hourly_rollups ON private.observability_hourly_rollups FOR ALL TO couchone_authentication
  USING (private.is_active_admin() IS NOT NULL) WITH CHECK (private.is_active_admin() IS NOT NULL);

-- Narrow SECURITY DEFINER functions for sanitized batch log insertion, idempotent ingest, and admin audit reads.
CREATE FUNCTION private.insert_observability_logs(entries jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE inserted_count integer := 0;
BEGIN
  IF jsonb_typeof(entries) <> 'array' THEN
    RAISE EXCEPTION 'OBSERVABILITY_INVALID_ENTRIES';
  END IF;
  WITH rows_in AS (
    SELECT
      left(COALESCE(NULLIF(btrim(item->>'correlationId'), ''), gen_random_uuid()::text), 128) AS correlation_id,
      COALESCE((item->>'occurredAt')::timestamptz, clock_timestamp()) AS occurred_at,
      CASE
        WHEN item->>'environment' IN ('production', 'staging', 'development', 'local', 'ci', 'test') THEN item->>'environment'
        ELSE 'development'
      END AS environment,
      left(COALESCE(NULLIF(btrim(item->>'service'), ''), 'api'), 60) AS service,
      left(COALESCE(NULLIF(btrim(item->>'module'), ''), 'system'), 60) AS module,
      CASE
        WHEN item->>'source' IN ('operational', 'error', 'client_telemetry', 'system') THEN item->>'source'
        ELSE 'operational'
      END AS source,
      left(COALESCE(NULLIF(btrim(item->>'eventType'), ''), 'http.request'), 80) AS event_type,
      CASE
        WHEN item->>'severity' IN ('debug', 'info', 'warn', 'error', 'critical') THEN item->>'severity'
        ELSE 'info'
      END AS severity,
      left(COALESCE(NULLIF(btrim(item->>'operation'), ''), 'unknown'), 160) AS operation,
      NULLIF(left(btrim(COALESCE(item->>'normalizedPath', '')), 200), '') AS normalized_path,
      CASE
        WHEN item->>'httpMethod' IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD') THEN item->>'httpMethod'
        ELSE NULL
      END AS http_method,
      CASE
        WHEN (item->>'statusCode') ~ '^\d{3}$' AND (item->>'statusCode')::integer BETWEEN 100 AND 599
          THEN (item->>'statusCode')::integer
        ELSE NULL
      END AS status_code,
      CASE
        WHEN (item->>'durationMs') ~ '^\d+(\.\d+)?$' THEN round((item->>'durationMs')::numeric, 1)
        ELSE NULL
      END AS duration_ms,
      CASE
        WHEN item->>'outcome' IN ('success', 'client_error', 'server_error', 'aborted', 'timeout', 'recovered', 'info') THEN item->>'outcome'
        ELSE 'info'
      END AS outcome,
      NULLIF(left(btrim(COALESCE(item->>'errorCode', '')), 120), '') AS error_code,
      NULLIF(left(btrim(COALESCE(item->>'errorMessage', '')), 500), '') AS error_message,
      NULLIF(left(btrim(COALESCE(item->>'systemVersion', '')), 60), '') AS system_version,
      CASE
        WHEN jsonb_typeof(item->'metadata') = 'object' THEN item->'metadata'
        ELSE '{}'::jsonb
      END AS metadata
    FROM jsonb_array_elements(entries) AS item
  ),
  inserted AS (
    INSERT INTO private.observability_logs (
      correlation_id, occurred_at, environment, service, module, source, event_type,
      severity, operation, normalized_path, http_method, status_code, duration_ms,
      outcome, error_code, error_message, system_version, metadata
    )
    SELECT * FROM rows_in
    RETURNING 1
  )
  SELECT count(*)::integer INTO inserted_count FROM inserted;
  RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION private.insert_observability_logs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.insert_observability_logs(jsonb) TO couchone_authentication;

CREATE FUNCTION private.read_observability_runtime_config() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
  SELECT jsonb_build_object(
    'monitorEnabled', s.monitor_enabled,
    'checkIntervalMinutes', s.check_interval_minutes,
    'logRetentionDays', s.log_retention_days,
    'checkRetentionDays', s.check_retention_days,
    'evaluationRetentionDays', s.evaluation_retention_days,
    'incidentErrorRateThresholdPct', s.incident_error_rate_threshold_pct::float8,
    'incidentLatencyP95ThresholdMs', s.incident_latency_p95_threshold_ms,
    'incidentConsecutiveFailures', s.incident_consecutive_failures,
    'updatedAt', s.updated_at
  )
  FROM private.observability_settings s
  WHERE s.key = 'default'
$$;
REVOKE ALL ON FUNCTION private.read_observability_runtime_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.read_observability_runtime_config() TO couchone_authentication;

CREATE FUNCTION private.ingest_observability_run(run_payload jsonb, checks_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE
  v_run_id uuid;
  v_external_run_id text := NULLIF(btrim(COALESCE(run_payload->>'externalRunId', '')), '');
  v_inserted integer := 0;
  v_total integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  IF jsonb_typeof(checks_payload) <> 'array' THEN
    RAISE EXCEPTION 'OBSERVABILITY_INVALID_CHECKS';
  END IF;

  IF v_external_run_id IS NOT NULL THEN
    INSERT INTO private.observability_test_runs (
      external_run_id, category, environment, trigger_source, triggered_by, status,
      started_at, finished_at, duration_ms, total_checks, passed_checks, failed_checks,
      not_executed_checks, skipped_checks, commit_sha, notes
    )
    VALUES (
      v_external_run_id,
      run_payload->>'category',
      run_payload->>'environment',
      run_payload->>'triggerSource',
      NULLIF(run_payload->>'triggeredBy', '')::uuid,
      run_payload->>'status',
      (run_payload->>'startedAt')::timestamptz,
      (run_payload->>'finishedAt')::timestamptz,
      COALESCE((run_payload->>'durationMs')::numeric, 0),
      COALESCE((run_payload->>'totalChecks')::integer, 0),
      COALESCE((run_payload->>'passedChecks')::integer, 0),
      COALESCE((run_payload->>'failedChecks')::integer, 0),
      COALESCE((run_payload->>'notExecutedChecks')::integer, 0),
      COALESCE((run_payload->>'skippedChecks')::integer, 0),
      NULLIF(btrim(COALESCE(run_payload->>'commitSha', '')), ''),
      NULLIF(btrim(COALESCE(run_payload->>'notes', '')), '')
    )
    ON CONFLICT (external_run_id) DO NOTHING
    RETURNING id INTO v_run_id;

    IF v_run_id IS NULL THEN
      SELECT id INTO v_run_id FROM private.observability_test_runs WHERE external_run_id = v_external_run_id;
    END IF;
  ELSE
    INSERT INTO private.observability_test_runs (
      category, environment, trigger_source, triggered_by, status,
      started_at, finished_at, duration_ms, total_checks, passed_checks, failed_checks,
      not_executed_checks, skipped_checks, commit_sha, notes
    )
    VALUES (
      run_payload->>'category',
      run_payload->>'environment',
      run_payload->>'triggerSource',
      NULLIF(run_payload->>'triggeredBy', '')::uuid,
      run_payload->>'status',
      (run_payload->>'startedAt')::timestamptz,
      (run_payload->>'finishedAt')::timestamptz,
      COALESCE((run_payload->>'durationMs')::numeric, 0),
      COALESCE((run_payload->>'totalChecks')::integer, 0),
      COALESCE((run_payload->>'passedChecks')::integer, 0),
      COALESCE((run_payload->>'failedChecks')::integer, 0),
      COALESCE((run_payload->>'notExecutedChecks')::integer, 0),
      COALESCE((run_payload->>'skippedChecks')::integer, 0),
      NULLIF(btrim(COALESCE(run_payload->>'commitSha', '')), ''),
      NULLIF(btrim(COALESCE(run_payload->>'notes', '')), '')
    )
    RETURNING id INTO v_run_id;
  END IF;

  v_total := jsonb_array_length(checks_payload);

  WITH inserted_checks AS (
    INSERT INTO private.observability_check_results (
      run_id, external_event_id, correlation_id, check_key, check_name, check_kind,
      service, module, environment, target, phase, executed_at, expected_result,
      actual_result, status, duration_ms, http_status, error_code, error_message, assertions
    )
    SELECT
      v_run_id,
      NULLIF(btrim(COALESCE(item->>'externalEventId', '')), ''),
      left(COALESCE(NULLIF(btrim(item->>'correlationId'), ''), v_run_id::text), 128),
      item->>'checkKey',
      item->>'checkName',
      item->>'checkKind',
      item->>'service',
      item->>'module',
      item->>'environment',
      NULLIF(btrim(COALESCE(item->>'target', '')), ''),
      COALESCE(NULLIF(btrim(item->>'phase'), ''), 'regular'),
      (item->>'executedAt')::timestamptz,
      item->>'expectedResult',
      item->>'actualResult',
      item->>'status',
      CASE WHEN (item->>'durationMs') ~ '^\d+(\.\d+)?$' THEN round((item->>'durationMs')::numeric, 1) ELSE NULL END,
      CASE WHEN (item->>'httpStatus') ~ '^\d{3}$' THEN (item->>'httpStatus')::integer ELSE NULL END,
      NULLIF(left(btrim(COALESCE(item->>'errorCode', '')), 120), ''),
      NULLIF(left(btrim(COALESCE(item->>'errorMessage', '')), 500), ''),
      CASE WHEN jsonb_typeof(item->'assertions') = 'array' THEN item->'assertions' ELSE '[]'::jsonb END
    FROM jsonb_array_elements(checks_payload) AS item
    ON CONFLICT (external_event_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM inserted_checks;

  RETURN jsonb_build_object(
    'runId', v_run_id,
    'insertedChecks', v_inserted,
    'duplicateChecks', GREATEST(v_total - v_inserted, 0)
  );
END $$;
REVOKE ALL ON FUNCTION private.ingest_observability_run(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ingest_observability_run(jsonb, jsonb) TO couchone_authentication;

CREATE FUNCTION private.upsert_observability_incident(
  p_dedupe_key text,
  p_env text,
  p_service text,
  p_type text,
  p_severity text,
  p_title text,
  p_summary text,
  p_seen_at timestamptz,
  p_correlation_id text,
  p_slo_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  INSERT INTO private.observability_incidents (
    dedupe_key, environment, service, incident_type, severity, status,
    title, summary, started_at, last_seen_at, occurrence_count, correlation_id, slo_id, updated_at
  )
  VALUES (
    p_dedupe_key, p_env, p_service, p_type, p_severity, 'open',
    p_title, p_summary, p_seen_at, p_seen_at, 1, p_correlation_id, p_slo_id, clock_timestamp()
  )
  ON CONFLICT (dedupe_key) WHERE status IN ('open', 'acknowledged')
  DO UPDATE SET
    severity = CASE
      WHEN private.observability_incidents.severity = 'critical' OR EXCLUDED.severity = 'critical' THEN 'critical'
      WHEN private.observability_incidents.severity = 'high' OR EXCLUDED.severity = 'high' THEN 'high'
      WHEN private.observability_incidents.severity = 'medium' OR EXCLUDED.severity = 'medium' THEN 'medium'
      ELSE 'low'
    END,
    summary = EXCLUDED.summary,
    last_seen_at = GREATEST(private.observability_incidents.last_seen_at, EXCLUDED.last_seen_at),
    occurrence_count = private.observability_incidents.occurrence_count + 1,
    correlation_id = COALESCE(EXCLUDED.correlation_id, private.observability_incidents.correlation_id),
    updated_at = clock_timestamp()
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.upsert_observability_incident(text, text, text, text, text, text, text, timestamptz, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.upsert_observability_incident(text, text, text, text, text, text, text, timestamptz, text, uuid) TO couchone_authentication;

CREATE FUNCTION private.resolve_observability_incident(
  p_dedupe_key text,
  p_resolved_at timestamptz,
  p_notes text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_updated integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  UPDATE private.observability_incidents
  SET
    status = 'resolved',
    resolved_at = p_resolved_at,
    recovery_duration_s = round(GREATEST(EXTRACT(EPOCH FROM (p_resolved_at - started_at)), 0)::numeric, 1),
    resolution_notes = COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), resolution_notes),
    updated_at = clock_timestamp()
  WHERE dedupe_key = p_dedupe_key
    AND status IN ('open', 'acknowledged');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $$;
REVOKE ALL ON FUNCTION private.resolve_observability_incident(text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.resolve_observability_incident(text, timestamptz, text) TO couchone_authentication;

CREATE FUNCTION private.record_observability_slo_evaluation(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  INSERT INTO private.observability_slo_evaluations (
    slo_id, slo_version, environment, period_start, period_end, target_value,
    observed_value, delta_value, samples, not_executed_count, compliance_status,
    error_budget_total, error_budget_consumed, error_budget_remaining_pct, notes, evaluated_at
  )
  VALUES (
    (payload->>'sloId')::uuid,
    (payload->>'sloVersion')::integer,
    payload->>'environment',
    (payload->>'periodStart')::timestamptz,
    (payload->>'periodEnd')::timestamptz,
    (payload->>'targetValue')::numeric,
    CASE WHEN payload->>'observedValue' IS NULL THEN NULL ELSE (payload->>'observedValue')::numeric END,
    CASE WHEN payload->>'deltaValue' IS NULL THEN NULL ELSE (payload->>'deltaValue')::numeric END,
    COALESCE((payload->>'samples')::integer, 0),
    COALESCE((payload->>'notExecutedCount')::integer, 0),
    payload->>'complianceStatus',
    CASE WHEN payload->>'errorBudgetTotal' IS NULL THEN NULL ELSE (payload->>'errorBudgetTotal')::numeric END,
    CASE WHEN payload->>'errorBudgetConsumed' IS NULL THEN NULL ELSE (payload->>'errorBudgetConsumed')::numeric END,
    CASE WHEN payload->>'errorBudgetRemainingPct' IS NULL THEN NULL ELSE (payload->>'errorBudgetRemainingPct')::numeric END,
    NULLIF(btrim(COALESCE(payload->>'notes', '')), ''),
    COALESCE((payload->>'evaluatedAt')::timestamptz, clock_timestamp())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION private.record_observability_slo_evaluation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_observability_slo_evaluation(jsonb) TO couchone_authentication;

CREATE FUNCTION private.observability_ingest_snapshot(p_env text, p_since timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  RETURN jsonb_build_object(
    'settings', private.read_observability_runtime_config(),
    'logs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'occurredAt', l.occurred_at,
        'service', l.service,
        'module', l.module,
        'source', l.source,
        'eventType', l.event_type,
        'severity', l.severity,
        'normalizedPath', l.normalized_path,
        'httpMethod', l.http_method,
        'statusCode', l.status_code,
        'durationMs', l.duration_ms::float8,
        'outcome', l.outcome
      ) ORDER BY l.occurred_at DESC)
      FROM private.observability_logs l
      WHERE l.environment = p_env AND l.occurred_at >= p_since
    ), '[]'::jsonb),
    'checks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'checkKey', c.check_key,
        'checkName', c.check_name,
        'checkKind', c.check_kind,
        'service', c.service,
        'module', c.module,
        'target', c.target,
        'phase', c.phase,
        'executedAt', c.executed_at,
        'status', c.status,
        'durationMs', c.duration_ms::float8,
        'httpStatus', c.http_status,
        'correlationId', c.correlation_id,
        'errorMessage', c.error_message
      ) ORDER BY c.executed_at DESC)
      FROM private.observability_check_results c
      WHERE c.environment = p_env AND c.executed_at >= p_since
    ), '[]'::jsonb),
    'slis', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'currentVersion', s.current_version,
        'name', s.name,
        'description', s.description,
        'service', s.service,
        'characteristic', s.characteristic,
        'dataSource', s.data_source,
        'indicatorType', s.indicator_type,
        'unit', s.unit,
        'calculationMethod', s.calculation_method,
        'inclusionCriteria', s.inclusion_criteria,
        'exclusionCriteria', s.exclusion_criteria,
        'evaluationPeriod', s.evaluation_period,
        'isActive', s.is_active
      ))
      FROM private.observability_sli_definitions s
      WHERE s.is_active = true
    ), '[]'::jsonb),
    'slos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'code', o.code,
        'sliId', o.sli_id,
        'currentVersion', o.current_version,
        'name', o.name,
        'description', o.description,
        'targetValue', o.target_value::float8,
        'comparisonOperator', o.comparison_operator,
        'unit', o.unit,
        'evaluationPeriod', o.evaluation_period,
        'minSamples', o.min_samples,
        'effectiveFrom', o.effective_from,
        'effectiveTo', o.effective_to,
        'status', o.status,
        'isContractual', o.is_contractual
      ))
      FROM private.observability_slo_definitions o
      WHERE o.status = 'active'
    ), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION private.observability_ingest_snapshot(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_ingest_snapshot(text, timestamptz) TO couchone_authentication;

CREATE FUNCTION private.admin_access_events_page(
  p_from timestamptz,
  p_to timestamptz,
  p_search text,
  p_limit integer,
  p_offset integer
) RETURNS TABLE(
  total bigint,
  id uuid,
  action text,
  actor_username text,
  subject_username text,
  client_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  RETURN QUERY
  WITH filtered AS (
    SELECT
      e.id,
      e.action,
      actor.username AS actor_username,
      subj.username AS subject_username,
      e.client_id,
      e.created_at
    FROM private.access_events e
    LEFT JOIN private.users actor ON actor.id = e.actor_id
    LEFT JOIN private.users subj ON subj.id = e.subject_id
    WHERE (p_from IS NULL OR e.created_at >= p_from)
      AND (p_to IS NULL OR e.created_at <= p_to)
      AND (
        COALESCE(btrim(p_search), '') = ''
        OR position(lower(btrim(p_search) COLLATE pg_catalog.pg_c_utf8) IN lower((e.action || ' ' || COALESCE(actor.username, '') || ' ' || COALESCE(subj.username, '')) COLLATE pg_catalog.pg_c_utf8)) > 0
      )
  )
  SELECT
    (SELECT count(*) FROM filtered),
    f.id,
    f.action,
    f.actor_username,
    f.subject_username,
    f.client_id,
    f.created_at
  FROM filtered f
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET GREATEST(p_offset, 0);
END $$;
REVOKE ALL ON FUNCTION private.admin_access_events_page(timestamptz, timestamptz, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.admin_access_events_page(timestamptz, timestamptz, text, integer, integer) TO couchone_authentication;

CREATE FUNCTION private.prune_observability_data() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE
  v_log_days integer;
  v_check_days integer;
  v_eval_days integer;
  v_log_cutoff timestamptz;
  v_check_cutoff timestamptz;
  v_eval_cutoff timestamptz;
  v_deleted_logs integer := 0;
  v_deleted_checks integer := 0;
  v_deleted_evals integer := 0;
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  SELECT log_retention_days, check_retention_days, evaluation_retention_days
  INTO v_log_days, v_check_days, v_eval_days
  FROM private.observability_settings
  WHERE key = 'default';

  v_log_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_log_days, 30));
  v_check_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_check_days, 90));
  v_eval_cutoff := clock_timestamp() - make_interval(days => COALESCE(v_eval_days, 365));

  -- Aggregate hourly HTTP rollups before deleting expired raw logs.
  INSERT INTO private.observability_hourly_rollups (
    environment, service, module, bucket_hour, requests_total, success_count,
    client_error_count, server_error_count, aborted_count, duration_avg_ms,
    duration_p50_ms, duration_p95_ms, duration_p99_ms, updated_at
  )
  SELECT
    l.environment,
    l.service,
    l.module,
    date_trunc('hour', l.occurred_at) AS bucket_hour,
    count(*)::integer,
    count(*) FILTER (WHERE l.outcome = 'success')::integer,
    count(*) FILTER (WHERE l.outcome = 'client_error')::integer,
    count(*) FILTER (WHERE l.outcome = 'server_error')::integer,
    count(*) FILTER (WHERE l.outcome = 'aborted')::integer,
    round(avg(l.duration_ms)::numeric, 1),
    round((percentile_disc(0.50) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    round((percentile_disc(0.95) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    round((percentile_disc(0.99) WITHIN GROUP (ORDER BY l.duration_ms))::numeric, 1),
    clock_timestamp()
  FROM private.observability_logs l
  WHERE l.occurred_at < v_log_cutoff
    AND l.event_type IN ('http.request', 'http.aborted')
  GROUP BY l.environment, l.service, l.module, date_trunc('hour', l.occurred_at)
  ON CONFLICT (environment, service, module, bucket_hour)
  DO UPDATE SET
    requests_total = GREATEST(private.observability_hourly_rollups.requests_total, EXCLUDED.requests_total),
    success_count = GREATEST(private.observability_hourly_rollups.success_count, EXCLUDED.success_count),
    client_error_count = GREATEST(private.observability_hourly_rollups.client_error_count, EXCLUDED.client_error_count),
    server_error_count = GREATEST(private.observability_hourly_rollups.server_error_count, EXCLUDED.server_error_count),
    aborted_count = GREATEST(private.observability_hourly_rollups.aborted_count, EXCLUDED.aborted_count),
    duration_avg_ms = COALESCE(EXCLUDED.duration_avg_ms, private.observability_hourly_rollups.duration_avg_ms),
    duration_p50_ms = COALESCE(EXCLUDED.duration_p50_ms, private.observability_hourly_rollups.duration_p50_ms),
    duration_p95_ms = COALESCE(EXCLUDED.duration_p95_ms, private.observability_hourly_rollups.duration_p95_ms),
    duration_p99_ms = COALESCE(EXCLUDED.duration_p99_ms, private.observability_hourly_rollups.duration_p99_ms),
    updated_at = clock_timestamp();

  INSERT INTO private.observability_hourly_rollups (
    environment, service, module, bucket_hour, synthetic_total, synthetic_passed,
    synthetic_failed, synthetic_not_executed, updated_at
  )
  SELECT
    c.environment,
    c.service,
    c.module,
    date_trunc('hour', c.executed_at) AS bucket_hour,
    count(*)::integer,
    count(*) FILTER (WHERE c.status = 'passed')::integer,
    count(*) FILTER (WHERE c.status = 'failed')::integer,
    count(*) FILTER (WHERE c.status = 'not_executed')::integer,
    clock_timestamp()
  FROM private.observability_check_results c
  WHERE c.executed_at < v_check_cutoff
    AND c.phase <> 'recovery-drill'
  GROUP BY c.environment, c.service, c.module, date_trunc('hour', c.executed_at)
  ON CONFLICT (environment, service, module, bucket_hour)
  DO UPDATE SET
    synthetic_total = GREATEST(private.observability_hourly_rollups.synthetic_total, EXCLUDED.synthetic_total),
    synthetic_passed = GREATEST(private.observability_hourly_rollups.synthetic_passed, EXCLUDED.synthetic_passed),
    synthetic_failed = GREATEST(private.observability_hourly_rollups.synthetic_failed, EXCLUDED.synthetic_failed),
    synthetic_not_executed = GREATEST(private.observability_hourly_rollups.synthetic_not_executed, EXCLUDED.synthetic_not_executed),
    updated_at = clock_timestamp();

  DELETE FROM private.observability_logs WHERE occurred_at < v_log_cutoff;
  GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

  DELETE FROM private.observability_check_results WHERE executed_at < v_check_cutoff;
  GET DIAGNOSTICS v_deleted_checks = ROW_COUNT;

  DELETE FROM private.observability_slo_evaluations WHERE evaluated_at < v_eval_cutoff;
  GET DIAGNOSTICS v_deleted_evals = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletedLogs', v_deleted_logs,
    'deletedChecks', v_deleted_checks,
    'deletedEvaluations', v_deleted_evals
  );
END $$;
REVOKE ALL ON FUNCTION private.prune_observability_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.prune_observability_data() TO couchone_authentication;

-- Default runtime settings and initial internal SLI/SLO catalog (never contractual SLAs).
INSERT INTO private.observability_settings (key) VALUES ('default') ON CONFLICT (key) DO NOTHING;

WITH seed_slis (code, name, description, service, characteristic, data_source, indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria, evaluation_period) AS (
  VALUES
    ('synthetic_availability', 'Disponibilidad sintética global', 'Porcentaje de comprobaciones sintéticas de disponibilidad respondidas con éxito.', 'platform', 'Disponibilidad externa', 'synthetic_availability', 'availability', '%', '{"includeNotExecuted":false}'::jsonb, 'Sondeos sintéticos regulares de Web, API y PostgreSQL.', 'Simulacros (recovery-drill) y comprobaciones no ejecutadas.', '7d'),
    ('synthetic_latency_p95', 'Latencia externa P95 en sondas', 'Percentil 95 de latencia de extremo a extremo en sondeos sintéticos exitosos.', 'platform', 'Latencia percibida', 'synthetic_availability', 'latency_percentile', 'ms', '{"percentile":95}'::jsonb, 'Sondeos sintéticos exitosos (HTTP 2xx).', 'Sondeos fallidos o simulacros de recuperación.', '7d'),
    ('api_error_rate_5xx', 'Tasa de errores 5xx de la API', 'Porcentaje de solicitudes HTTP reales respondidas con código de servidor >= 500.', 'api', 'Confiabilidad HTTP', 'operational_http', 'error_rate', '%', '{"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Eventos http.request reales en la API.', 'Rutas de salud (/api/health*) e ingesta interna.', '7d'),
    ('api_write_success_rate', 'Éxito de operaciones de escritura', 'Porcentaje de mutaciones (POST/PUT/PATCH/DELETE) completadas sin error 5xx ni aborto.', 'api', 'Integridad operativa', 'operational_http', 'operation_success_rate', '%', '{"methods":["POST","PUT","PATCH","DELETE"],"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Mutaciones HTTP exitosas (2xx/3xx), fallidas (>=500) y abortadas.', 'Errores de validación 4xx y endpoints de salud.', '7d'),
    ('api_latency_p50', 'Latencia API P50', 'Mediana del tiempo de procesamiento en servidor de solicitudes reales.', 'api', 'Velocidad de respuesta típica', 'operational_http', 'latency_percentile', 'ms', '{"percentile":50,"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Solicitudes http.request medidas en el servidor.', 'Endpoints /api/health* y /api/observability*.', '7d'),
    ('api_latency_p95', 'Latencia API P95', 'Percentil 95 del tiempo de procesamiento en servidor de solicitudes reales.', 'api', 'Latencia en percentil alto', 'operational_http', 'latency_percentile', 'ms', '{"percentile":95,"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Solicitudes http.request medidas en el servidor.', 'Endpoints /api/health* y /api/observability*.', '7d'),
    ('api_latency_p99', 'Latencia API P99', 'Percentil 99 de cola larga en el servidor de la API.', 'api', 'Cola larga de latencia', 'operational_http', 'latency_percentile', 'ms', '{"percentile":99,"excludePaths":["^/api/health","^/api/observability"]}'::jsonb, 'Solicitudes http.request medidas en el servidor.', 'Endpoints /api/health* y /api/observability*.', '7d'),
    ('synthetic_recovery_time', 'Tiempo máximo de recuperación', 'Duración máxima entre el primer sondeo fallido de una interrupción y el siguiente sondeo exitoso.', 'platform', 'Recuperación ante fallos', 'synthetic_availability', 'recovery_time', 's', '{}'::jsonb, 'Interrupciones detectadas por sondas sintéticas con recuperación observada.', 'Sondeos sin interrupciones abiertas ni simulacros.', '7d'),
    ('synthetic_functional_success', 'Éxito de pruebas funcionales sintéticas', 'Porcentaje de comprobaciones funcionales representativas aprobadas sobre las ejecutadas.', 'platform', 'Integridad funcional', 'synthetic_functional', 'functional_test_success', '%', '{"includeNotExecuted":false}'::jsonb, 'Pruebas funcionales sintéticas ejecutadas con validación de contenido.', 'Pruebas marcadas como no ejecutadas por falta de credenciales o configuración.', '7d')
),
inserted_slis AS (
  INSERT INTO private.observability_sli_definitions (
    code, current_version, name, description, service, characteristic, data_source,
    indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria, evaluation_period, is_active
  )
  SELECT code, 1, name, description, service, characteristic, data_source,
    indicator_type, unit, calculation_method, inclusion_criteria, exclusion_criteria, evaluation_period, true
  FROM seed_slis
  ON CONFLICT (code) DO NOTHING
  RETURNING *
)
INSERT INTO private.observability_sli_versions (sli_id, version, snapshot, change_reason)
SELECT id, 1, to_jsonb(inserted_slis), 'Definición inicial del catálogo interno de observabilidad'
FROM inserted_slis
ON CONFLICT (sli_id, version) DO NOTHING;

WITH seed_slos (code, sli_code, name, description, target_value, comparison_operator, unit, evaluation_period, min_samples) AS (
  VALUES
    ('slo_availability', 'synthetic_availability', 'Disponibilidad sintética >= 99.0 %', 'Objetivo interno de disponibilidad observada de la plataforma (no contractual, sujeto a Render Free).', 99.000, '>=', '%', '7d', 1),
    ('slo_synthetic_latency_p95', 'synthetic_latency_p95', 'Latencia externa P95 <= 1000 ms', 'Objetivo interno de latencia percibida desde el exterior en sondas exitosas (DEC-013).', 1000.000, '<=', 'ms', '7d', 20),
    ('slo_error_rate_5xx', 'api_error_rate_5xx', 'Tasa de errores 5xx <= 0.5 %', 'Objetivo interno de confiabilidad del backend frente a fallos de servidor.', 0.500, '<=', '%', '7d', 1),
    ('slo_write_success', 'api_write_success_rate', 'Éxito de escrituras >= 99.5 %', 'Objetivo interno de integridad en operaciones de escritura.', 99.500, '>=', '%', '7d', 1),
    ('slo_api_latency_p50', 'api_latency_p50', 'Latencia servidor P50 <= 300 ms', 'Objetivo interno de mediana de respuesta del backend.', 300.000, '<=', 'ms', '7d', 20),
    ('slo_api_latency_p95', 'api_latency_p95', 'Latencia servidor P95 <= 1000 ms', 'Objetivo interno de lectura/escritura P95 en servidor (DEC-013).', 1000.000, '<=', 'ms', '7d', 20),
    ('slo_api_latency_p99', 'api_latency_p99', 'Latencia servidor P99 <= 2000 ms', 'Objetivo interno de cola larga por debajo del timeout del servidor.', 2000.000, '<=', 'ms', '7d', 100),
    ('slo_recovery_time', 'synthetic_recovery_time', 'Tiempo máximo de recuperación <= 65 s', 'Objetivo interno de recuperación ante interrupciones o arranque en frío (DEC-013).', 65.000, '<=', 's', '7d', 1),
    ('slo_functional_success', 'synthetic_functional_success', 'Éxito de pruebas funcionales >= 95.0 %', 'Objetivo interno para comprobaciones funcionales sintéticas ejecutadas.', 95.000, '>=', '%', '7d', 1)
),
inserted_slos AS (
  INSERT INTO private.observability_slo_definitions (
    code, sli_id, current_version, name, description, target_value, comparison_operator,
    unit, evaluation_period, min_samples, status, is_contractual
  )
  SELECT
    o.code, s.id, 1, o.name, o.description, o.target_value, o.comparison_operator,
    o.unit, o.evaluation_period, o.min_samples, 'active', false
  FROM seed_slos o
  JOIN private.observability_sli_definitions s ON s.code = o.sli_code
  ON CONFLICT (code) DO NOTHING
  RETURNING *
)
INSERT INTO private.observability_slo_versions (
  slo_id, version, sli_version, target_value, comparison_operator, unit,
  evaluation_period, min_samples, effective_from, snapshot, change_reason
)
SELECT
  id, 1, 1, target_value, comparison_operator, unit,
  evaluation_period, min_samples, effective_from, to_jsonb(inserted_slos),
  'Objetivo interno inicial alineado con slo.config.json (DEC-013)'
FROM inserted_slos
ON CONFLICT (slo_id, version) DO NOTHING;

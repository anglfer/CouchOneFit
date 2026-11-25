-- Bound sampling and read the configuration version in force at the observation.
CREATE FUNCTION private.observability_ingest_snapshot(
  p_env text,
  p_since timestamptz,
  p_until timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  RETURN (
    WITH logs AS (
      SELECT l.occurred_at AS "occurredAt", l.service, l.module, l.source,
        l.event_type AS "eventType", l.severity, l.normalized_path AS "normalizedPath",
        l.http_method AS "httpMethod", l.status_code AS "statusCode",
        l.duration_ms::float8 AS "durationMs", l.outcome
      FROM private.observability_logs l
      WHERE l.environment = p_env AND l.occurred_at BETWEEN p_since AND p_until
        AND l.metadata->'synthetic' IS DISTINCT FROM 'true'::jsonb
      ORDER BY l.occurred_at DESC, l.id DESC
      LIMIT 50001
    ), checks AS (
      SELECT c.check_key AS "checkKey", c.check_name AS "checkName",
        c.check_kind AS "checkKind", c.service, c.module, c.target, c.phase,
        c.executed_at AS "executedAt", c.status, c.duration_ms::float8 AS "durationMs",
        c.http_status AS "httpStatus", c.correlation_id AS "correlationId",
        c.error_message AS "errorMessage", r.category AS "runCategory"
      FROM private.observability_check_results c
      JOIN private.observability_test_runs r ON r.id = c.run_id
      WHERE c.environment = p_env AND c.executed_at BETWEEN p_since AND p_until
      ORDER BY c.executed_at DESC, c.id DESC
      LIMIT 25001
    ), slis AS (
      SELECT jsonb_build_object(
        'id', d.id, 'code', d.code, 'currentVersion', v.version,
        'name', v.snapshot->>'name', 'description', v.snapshot->>'description',
        'service', v.snapshot->>'service', 'characteristic', v.snapshot->>'characteristic',
        'dataSource', COALESCE(v.snapshot->>'dataSource', v.snapshot->>'data_source'),
        'indicatorType', COALESCE(v.snapshot->>'indicatorType', v.snapshot->>'indicator_type'),
        'unit', v.snapshot->>'unit',
        'calculationMethod', COALESCE(v.snapshot->'calculationMethod', v.snapshot->'calculation_method', '{}'::jsonb),
        'inclusionCriteria', COALESCE(v.snapshot->>'inclusionCriteria', v.snapshot->>'inclusion_criteria'),
        'exclusionCriteria', COALESCE(v.snapshot->>'exclusionCriteria', v.snapshot->>'exclusion_criteria'),
        'evaluationPeriod', COALESCE(v.snapshot->>'evaluationPeriod', v.snapshot->>'evaluation_period'),
        'isActive', COALESCE(v.snapshot->'isActive', v.snapshot->'is_active'),
        'createdAt', d.created_at, 'updatedAt', v.created_at, 'versionFrom', v.effective_from
      ) AS item
      FROM private.observability_sli_definitions d
      JOIN LATERAL (
        SELECT svi.*
        FROM private.observability_sli_versions svi
        WHERE svi.sli_id = d.id
          AND svi.effective_from <= p_until
          AND (svi.effective_to IS NULL OR svi.effective_to > p_until)
        ORDER BY svi.version DESC
        LIMIT 1
      ) v ON true
      ORDER BY d.code
    ), slos AS (
      SELECT jsonb_build_object(
        'id', d.id, 'code', d.code, 'sliId', COALESCE(v.snapshot->>'sliId', v.snapshot->>'sli_id'),
        'currentVersion', v.version, 'name', v.snapshot->>'name',
        'description', v.snapshot->>'description', 'targetValue', v.target_value::float8,
        'comparisonOperator', v.comparison_operator, 'unit', v.unit,
        'evaluationPeriod', v.evaluation_period, 'minSamples', v.min_samples,
        'effectiveFrom', v.effective_from, 'effectiveTo', v.effective_to,
        'status', v.snapshot->>'status',
        'isContractual', COALESCE(v.snapshot->'isContractual', v.snapshot->'is_contractual', 'false'::jsonb),
        'createdAt', d.created_at, 'updatedAt', v.created_at,
        'versionFrom', GREATEST(v.effective_from, v.created_at)
      ) AS item
      FROM private.observability_slo_definitions d
      JOIN LATERAL (
        SELECT svo.*
        FROM private.observability_slo_versions svo
        WHERE svo.slo_id = d.id
          AND GREATEST(svo.created_at, svo.effective_from) <= p_until
          AND (svo.effective_to IS NULL OR svo.effective_to > p_until)
        ORDER BY svo.version DESC
        LIMIT 1
      ) v ON true
      ORDER BY d.code
    )
    SELECT jsonb_build_object(
      'settings', private.read_observability_runtime_config(),
      'logs', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM (SELECT * FROM logs LIMIT 50000) l), '[]'::jsonb),
      'checks', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT * FROM checks LIMIT 25000) c), '[]'::jsonb),
      'logsTruncated', (SELECT count(*) > 50000 FROM logs),
      'checksTruncated', (SELECT count(*) > 25000 FROM checks),
      'slis', COALESCE((SELECT jsonb_agg(item) FROM slis), '[]'::jsonb),
      'slos', COALESCE((SELECT jsonb_agg(item) FROM slos), '[]'::jsonb)
    )
  );
END $$;
REVOKE ALL ON FUNCTION private.observability_ingest_snapshot(text, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_ingest_snapshot(text, timestamptz, timestamptz) TO couchone_authentication;

-- Feed the unified admin log query without exposing access subject details.
CREATE FUNCTION private.observability_access_event_logs(
  p_from timestamptz,
  p_to timestamptz,
  p_id uuid
) RETURNS TABLE(id uuid, action text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
BEGIN
  IF private.is_active_admin() IS NULL THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT e.id, e.action, e.created_at
  FROM private.access_events e
  WHERE (p_from IS NULL OR e.created_at >= p_from)
    AND (p_to IS NULL OR e.created_at <= p_to)
    AND (p_id IS NULL OR e.id = p_id);
END $$;
REVOKE ALL ON FUNCTION private.observability_access_event_logs(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_access_event_logs(timestamptz, timestamptz, uuid) TO couchone_authentication;

-- Prevent old observations and repeat analyses from reopening or counting incidents again.
CREATE OR REPLACE FUNCTION private.upsert_observability_incident(
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

  IF EXISTS (
    SELECT 1 FROM private.observability_incidents
    WHERE dedupe_key = p_dedupe_key AND resolved_at >= p_seen_at
  ) THEN
    RETURN NULL;
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
  WHERE private.observability_incidents.last_seen_at < EXCLUDED.last_seen_at
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION private.resolve_observability_incident(
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
    AND status IN ('open', 'acknowledged')
    AND last_seen_at <= p_resolved_at;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END $$;

-- Limit automatic snapshots to one evaluation batch per environment and UTC hour.
ALTER TABLE private.observability_slo_evaluations ADD COLUMN automatic boolean NOT NULL DEFAULT false;
CREATE INDEX idx_obs_slo_evals_automatic_hour
  ON private.observability_slo_evaluations (environment, evaluated_at) WHERE automatic;

CREATE FUNCTION private.observability_needs_hourly_evaluation(p_env text, p_at timestamptz) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_start timestamptz := date_trunc('hour', p_at, 'UTC');
BEGIN
  IF current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  RETURN NOT EXISTS (
    SELECT 1 FROM private.observability_slo_evaluations
    WHERE automatic AND environment = p_env
      AND evaluated_at >= v_start AND evaluated_at < v_start + interval '1 hour'
  );
END $$;
REVOKE ALL ON FUNCTION private.observability_needs_hourly_evaluation(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.observability_needs_hourly_evaluation(text, timestamptz) TO couchone_authentication;

CREATE OR REPLACE FUNCTION private.record_observability_slo_evaluation(payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE v_id uuid;
BEGIN
  IF private.is_active_admin() IS NULL AND current_setting('app.observability_scope', true) IS DISTINCT FROM 'ingest' THEN
    RAISE EXCEPTION 'OBSERVABILITY_FORBIDDEN';
  END IF;

  INSERT INTO private.observability_slo_evaluations (
    slo_id, slo_version, environment, period_start, period_end, target_value,
    observed_value, delta_value, samples, not_executed_count, compliance_status,
    error_budget_total, error_budget_consumed, error_budget_remaining_pct, notes, evaluated_at, automatic
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
    COALESCE((payload->>'evaluatedAt')::timestamptz, clock_timestamp()),
    COALESCE((payload->>'automatic')::boolean, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Keep history sizes bounded and operational rollups free of monitor traffic.
CREATE OR REPLACE FUNCTION private.prune_observability_data() RETURNS jsonb
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
    AND l.metadata->'synthetic' IS DISTINCT FROM 'true'::jsonb
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

  DELETE FROM private.observability_test_runs r
  WHERE r.finished_at < v_check_cutoff
    AND NOT EXISTS (SELECT 1 FROM private.observability_check_results c WHERE c.run_id = r.id);
  DELETE FROM private.observability_hourly_rollups WHERE bucket_hour < v_eval_cutoff;
  DELETE FROM private.observability_slo_evaluations WHERE evaluated_at < v_eval_cutoff;
  GET DIAGNOSTICS v_deleted_evals = ROW_COUNT;

  RETURN jsonb_build_object(
    'deletedLogs', v_deleted_logs,
    'deletedChecks', v_deleted_checks,
    'deletedEvaluations', v_deleted_evals
  );
END $$;

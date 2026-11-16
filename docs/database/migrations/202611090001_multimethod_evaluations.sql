-- HU-021 scope extension. Existing columns and historical rows retain their meaning.
-- NULL assessment means legacy/unknown method; never infer provenance or recalculate it.
ALTER TABLE private.client_evaluations ADD COLUMN assessment jsonb;
ALTER TABLE private.client_evaluations DROP CONSTRAINT ck_client_evaluations_nonempty;
ALTER TABLE private.client_evaluations ADD CONSTRAINT ck_client_evaluations_nonempty CHECK (
  num_nonnulls(weight_kg,waist_cm,hip_cm,measured_body_fat_percentage,pectoral_skinfold_mm,
    abdominal_skinfold_mm,triceps_skinfold_mm,suprailiac_skinfold_mm,thigh_skinfold_mm)>=1
  OR assessment IS NOT NULL
);
ALTER TABLE private.client_evaluations ADD CONSTRAINT ck_client_evaluations_assessment CHECK (
  assessment IS NULL OR COALESCE((
    jsonb_typeof(assessment)='object'
    AND assessment ?& ARRAY['protocol','method','effectiveDate','ownerId','version','calculationStatus','provenance','measurements','results','equation','birthDate','ageYears']
    AND assessment->>'method' IN ('circumference','skinfolds','bioimpedance')
    AND assessment->>'equation' IN ('male','female','not_applicable')
    AND assessment->>'version'='composition-arithmetic-v1'
    AND assessment->>'calculationStatus' IN ('available','partial','pending_verification')
    AND assessment->>'provenance' IN ('device_reported','manual_measurements')
    AND jsonb_typeof(assessment->'ownerId')='string'
    AND jsonb_typeof(assessment->'protocol')='string'
    AND assessment->>'protocol'<>''
    AND jsonb_typeof(assessment->'measurements')='object'
    AND assessment->'measurements'<>'{}'::jsonb
    AND jsonb_typeof(assessment->'results')='object'
    AND NOT jsonb_path_exists(assessment, '$.measurements.* ? (@.type() != "number" || @ <= 0)')
    AND NOT jsonb_path_exists(assessment, '$.results.* ? (@.type() != "number")')
    AND jsonb_typeof(assessment->'effectiveDate')='string'
    AND (assessment->>'effectiveDate')::date <= timezone('UTC',clock_timestamp())::date
    AND (assessment->>'method'='bioimpedance' OR (
      assessment->>'calculationStatus'='pending_verification'
      AND NOT (assessment->'results' ?| ARRAY['bodyFatPercentage','density','fatMassKg','fatFreeMassKg'])
    ))
  ), false)
);
GRANT INSERT(assessment) ON private.client_evaluations TO couchone_authentication;
-- Restrictive policies complement the existing ownership/elegibility policies.
CREATE POLICY client_evaluations_snapshot_owner ON private.client_evaluations AS RESTRICTIVE
  FOR INSERT TO couchone_authentication
  WITH CHECK (assessment IS NULL OR assessment->>'ownerId'=current_setting('app.subject_id',true));
-- No UPDATE/DELETE grant. Original rows, date defaults, indices and read RLS preserved.

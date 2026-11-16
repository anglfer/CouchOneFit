-- HU-023: technical pending references and local candidates; no scientific approval.
-- Preserve all rows, v1 semantics, grants and RLS. No data transformations.
ALTER TABLE private.client_evaluations DROP CONSTRAINT ck_client_evaluations_assessment;
ALTER TABLE private.client_evaluations ADD CONSTRAINT ck_client_evaluations_assessment CHECK (
  assessment IS NULL OR COALESCE((
    jsonb_typeof(assessment)='object'
    AND assessment ?& ARRAY['protocol','method','effectiveDate','ownerId','version','calculationStatus','provenance','measurements','results','equation','birthDate','ageYears']
    AND assessment->>'method' IN ('circumference','skinfolds','bioimpedance')
    AND assessment->>'equation' IN ('male','female','not_applicable')
    AND assessment->>'version' IN ('composition-arithmetic-v1','composition-estimation-v1','composition-candidate-v1')
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

ALTER TABLE private.client_evaluations
  ADD CONSTRAINT ck_client_evaluations_pending_estimation CHECK (
    assessment IS NULL OR assessment->>'version' IN ('composition-arithmetic-v1','composition-candidate-v1') OR COALESCE((
      assessment->>'version'='composition-estimation-v1'
      AND assessment->>'method'='skinfolds'
      AND assessment->>'protocol'='jp3-sites-pending@technical-reference-v1'
      AND assessment->>'calculationStatus'='pending_verification'
      AND assessment->>'provenance'='manual_measurements'
      AND assessment->'results'='{}'::jsonb
      AND assessment->'estimation'=jsonb_build_object(
        'schemaVersion',1,
        'methodId','jackson-pollock-3-siri',
        'variant',NULLIF(assessment->>'equation','not_applicable'),
        'formulaVersion',NULL,'domainPolicyVersion',NULL,
        'protocol',jsonb_build_object('id','jp3-sites-pending','version','technical-reference-v1'),
        'provenance','server_estimation',
        'inputs',jsonb_build_object(
          'effectiveDate',assessment->>'effectiveDate',
          'ageYears',assessment->'ageYears',
          'unit','mm',
          'skinfolds',CASE WHEN assessment->>'equation'='not_applicable' THEN '{}'::jsonb
                          ELSE (assessment->'measurements') - ARRAY['weightKg','heightCm'] END),
        'status','unavailable','result',NULL,
        'reasons',jsonb_build_array(jsonb_build_object('code','scientific_verification_pending','fields','[]'::jsonb))
      )
    ),false)
  );

-- Local technical candidates remain distinct from scientifically available results.
ALTER TABLE private.client_evaluations
  ADD CONSTRAINT ck_client_evaluations_candidate_estimation CHECK (
    assessment IS NULL OR assessment->>'version'<>'composition-candidate-v1' OR COALESCE((
      assessment->>'method'='skinfolds'
      AND assessment->>'protocol' IN ('jp3-male-candidate@technical-candidate-v1','jp3-female-candidate@technical-candidate-v1')
      AND (assessment->>'equation'='not_applicable' OR assessment->>'protocol'=CASE assessment->>'equation' WHEN 'male' THEN 'jp3-male-candidate@technical-candidate-v1' ELSE 'jp3-female-candidate@technical-candidate-v1' END)
      AND assessment->>'calculationStatus'='pending_verification'
      AND assessment->>'provenance'='manual_measurements'
      AND assessment->'results'='{}'::jsonb
      AND (assessment->'estimation') - ARRAY['status','inputs','result','reasons'] = jsonb_build_object(
        'schemaVersion',1,'methodId','jackson-pollock-3-siri',
        'variant',NULLIF(assessment->>'equation','not_applicable'),
        'formulaVersion',NULL,'domainPolicyVersion',NULL,
        'technicalFormulaVersion','jp3-siri-arithmetic-candidate-v1',
        'technicalDomainVersion','jp3-reference-ranges-candidate-v1',
        'scientificStatus','not_validated','activationAllowed',false,
        'protocol',jsonb_build_object('id',split_part(assessment->>'protocol','@',1),'version','technical-candidate-v1'),
        'provenance','server_estimation',
        'blockers',to_jsonb(ARRAY['scientific_verification_pending','domain_approval_pending','protocol_approval_pending','independent_reference_cases_pending']::text[]
          || CASE WHEN assessment->>'equation'='female' THEN ARRAY['female_equation_original_pending']::text[] ELSE ARRAY[]::text[] END
          || CASE WHEN assessment->>'equation'='female' AND (assessment->>'ageYears')::numeric>40 THEN ARRAY['female_over_40_caution_pending']::text[] ELSE ARRAY[]::text[] END)
      )
      AND (assessment->'estimation')->'inputs' = jsonb_build_object(
        'effectiveDate',assessment->>'effectiveDate','ageYears',assessment->'ageYears','unit','mm',
        'skinfolds',CASE
          WHEN assessment->>'equation'='not_applicable' THEN '{}'::jsonb
          WHEN (assessment->'estimation')->>'status'='candidate_only' AND assessment->>'equation'='male' THEN jsonb_build_object(
            'pectoralSkinfoldMm',(assessment->'measurements')->'pectoralSkinfoldMm',
            'abdominalSkinfoldMm',(assessment->'measurements')->'abdominalSkinfoldMm',
            'thighSkinfoldMm',(assessment->'measurements')->'thighSkinfoldMm')
          WHEN (assessment->'estimation')->>'status'='candidate_only' THEN jsonb_build_object(
            'tricepsSkinfoldMm',(assessment->'measurements')->'tricepsSkinfoldMm',
            'suprailiacSkinfoldMm',(assessment->'measurements')->'suprailiacSkinfoldMm',
            'thighSkinfoldMm',(assessment->'measurements')->'thighSkinfoldMm')
          ELSE (assessment->'measurements') - ARRAY['weightKg','heightCm'] END)
      AND (
        ((assessment->'estimation')->>'status'='unavailable'
          AND (assessment->'estimation')->'result'='null'::jsonb
          AND jsonb_typeof((assessment->'estimation')->'reasons')='array'
          AND jsonb_array_length((assessment->'estimation')->'reasons')=1
          AND ((assessment->'estimation')->'reasons'->0) - ARRAY['code','fields']='{}'::jsonb
          AND (assessment->'estimation')->'reasons'->0->>'code' IN ('candidate_execution_disabled','invalid_input','equation_not_selected','invalid_effective_date','invalid_birth_date','age_unavailable','outside_reference_age_range','invalid_measurements','missing_measurements','non_finite_calculation','invalid_density','invalid_estimated_percentage')
          AND jsonb_typeof((assessment->'estimation')->'reasons'->0->'fields')='array'
          AND NOT jsonb_path_exists((assessment->'estimation')->'reasons'->0->'fields','$[*] ? (@.type() != "string")'))
        OR ((assessment->'estimation')->>'status'='candidate_only'
          AND assessment->>'equation' IN ('male','female')
          AND CASE WHEN jsonb_typeof(assessment->'ageYears')='number' THEN (assessment->>'ageYears')::numeric BETWEEN 18 AND CASE WHEN assessment->>'equation'='male' THEN 61 ELSE 55 END ELSE false END
          AND NOT jsonb_path_exists((assessment->'estimation')->'inputs'->'skinfolds','$.* ? (@.type() != "number")')
          AND (assessment->'estimation')->'reasons'='[]'::jsonb
          AND jsonb_typeof((assessment->'estimation')->'result')='object'
          AND (assessment->'estimation')->'result' ?& ARRAY['sumSkinfoldMm','bodyDensityGPerMl','estimatedBodyFatPercentage']
          AND ((assessment->'estimation')->'result') - ARRAY['sumSkinfoldMm','bodyDensityGPerMl','estimatedBodyFatPercentage']='{}'::jsonb
          AND NOT jsonb_path_exists((assessment->'estimation')->'result','$.* ? (@.type() != "number" || @ <= 0)')
          AND CASE WHEN jsonb_typeof((assessment->'estimation')->'result'->'estimatedBodyFatPercentage')='number' THEN ((assessment->'estimation')->'result'->>'estimatedBodyFatPercentage')::numeric < 100 ELSE false END)
      )
    ),false)
  );

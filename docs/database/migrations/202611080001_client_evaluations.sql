CREATE TABLE private.client_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES private.clients(id) ON DELETE RESTRICT,
  evaluation_date date NOT NULL DEFAULT (timezone('UTC', clock_timestamp())::date),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  weight_kg numeric,
  waist_cm numeric,
  hip_cm numeric,
  measured_body_fat_percentage numeric,
  pectoral_skinfold_mm numeric,
  abdominal_skinfold_mm numeric,
  triceps_skinfold_mm numeric,
  suprailiac_skinfold_mm numeric,
  thigh_skinfold_mm numeric,
  CONSTRAINT ck_client_evaluations_nonempty CHECK (num_nonnulls(
    weight_kg, waist_cm, hip_cm, measured_body_fat_percentage,
    pectoral_skinfold_mm, abdominal_skinfold_mm, triceps_skinfold_mm,
    suprailiac_skinfold_mm, thigh_skinfold_mm
  ) >= 1),
  CONSTRAINT ck_client_evaluations_weight CHECK (
    weight_kg IS NULL OR (weight_kg BETWEEN 30 AND 300 AND weight_kg = round(weight_kg, 1))
  ),
  CONSTRAINT ck_client_evaluations_waist CHECK (
    waist_cm IS NULL OR (waist_cm BETWEEN 40 AND 250 AND waist_cm = round(waist_cm, 1))
  ),
  CONSTRAINT ck_client_evaluations_hip CHECK (
    hip_cm IS NULL OR (hip_cm BETWEEN 50 AND 250 AND hip_cm = round(hip_cm, 1))
  ),
  CONSTRAINT ck_client_evaluations_measured_body_fat CHECK (
    measured_body_fat_percentage IS NULL OR (measured_body_fat_percentage BETWEEN 2 AND 60 AND measured_body_fat_percentage = round(measured_body_fat_percentage, 1))
  ),
  CONSTRAINT ck_client_evaluations_pectoral_skinfold CHECK (
    pectoral_skinfold_mm IS NULL OR (pectoral_skinfold_mm BETWEEN 1 AND 80 AND pectoral_skinfold_mm = round(pectoral_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_abdominal_skinfold CHECK (
    abdominal_skinfold_mm IS NULL OR (abdominal_skinfold_mm BETWEEN 1 AND 80 AND abdominal_skinfold_mm = round(abdominal_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_triceps_skinfold CHECK (
    triceps_skinfold_mm IS NULL OR (triceps_skinfold_mm BETWEEN 1 AND 80 AND triceps_skinfold_mm = round(triceps_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_suprailiac_skinfold CHECK (
    suprailiac_skinfold_mm IS NULL OR (suprailiac_skinfold_mm BETWEEN 1 AND 80 AND suprailiac_skinfold_mm = round(suprailiac_skinfold_mm, 1))
  ),
  CONSTRAINT ck_client_evaluations_thigh_skinfold CHECK (
    thigh_skinfold_mm IS NULL OR (thigh_skinfold_mm BETWEEN 1 AND 80 AND thigh_skinfold_mm = round(thigh_skinfold_mm, 1))
  )
);
CREATE INDEX ix_client_evaluations_client_date
  ON private.client_evaluations(client_id, evaluation_date DESC, created_at DESC, id DESC);
REVOKE ALL ON TABLE private.client_evaluations FROM PUBLIC, couchone_authentication;
GRANT SELECT ON TABLE private.client_evaluations TO couchone_authentication;
GRANT INSERT(
  client_id, weight_kg, waist_cm, hip_cm, measured_body_fat_percentage,
  pectoral_skinfold_mm, abdominal_skinfold_mm, triceps_skinfold_mm,
  suprailiac_skinfold_mm, thigh_skinfold_mm
) ON TABLE private.client_evaluations TO couchone_authentication;
ALTER TABLE private.client_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_evaluations_read ON private.client_evaluations
  FOR SELECT TO couchone_authentication
  USING (EXISTS (
    SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    WHERE c.id=client_evaluations.client_id AND private.training_professional(p.user_id)
  ));
CREATE POLICY client_evaluations_insert ON private.client_evaluations
  FOR INSERT TO couchone_authentication
  WITH CHECK (EXISTS (
    SELECT 1 FROM private.clients c JOIN private.professionals p ON p.id=c.professional_id
    WHERE c.id=client_evaluations.client_id AND c.status='active' AND private.training_professional(p.user_id)
  ));

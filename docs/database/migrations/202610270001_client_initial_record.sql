-- HU-015: base data captured when a professional creates a client record.
-- Existing records predate this contract, so every added column remains nullable.
ALTER TABLE private.clients
  ADD COLUMN birth_date date,
  ADD COLUMN height_cm numeric,
  ADD COLUMN weight_kg numeric,
  ADD COLUMN body_fat_percentage numeric,
  ADD COLUMN waist_cm numeric,
  ADD COLUMN hip_cm numeric,
  ADD CONSTRAINT ck_clients_initial_measurements_complete CHECK (
    (birth_date IS NULL AND height_cm IS NULL AND weight_kg IS NULL)
    OR (birth_date IS NOT NULL AND height_cm IS NOT NULL AND weight_kg IS NOT NULL)
  ),
  ADD CONSTRAINT ck_clients_height_cm CHECK (
    height_cm IS NULL OR (height_cm BETWEEN 100 AND 250 AND height_cm = round(height_cm, 1))
  ),
  ADD CONSTRAINT ck_clients_weight_kg CHECK (
    weight_kg IS NULL OR (weight_kg BETWEEN 30 AND 300 AND weight_kg = round(weight_kg, 1))
  ),
  ADD CONSTRAINT ck_clients_body_fat_percentage CHECK (
    body_fat_percentage IS NULL OR (body_fat_percentage BETWEEN 2 AND 60 AND body_fat_percentage = round(body_fat_percentage, 1))
  ),
  ADD CONSTRAINT ck_clients_waist_cm CHECK (
    waist_cm IS NULL OR (waist_cm BETWEEN 40 AND 250 AND waist_cm = round(waist_cm, 1))
  ),
  ADD CONSTRAINT ck_clients_hip_cm CHECK (
    hip_cm IS NULL OR (hip_cm BETWEEN 50 AND 250 AND hip_cm = round(hip_cm, 1))
  );

CREATE FUNCTION private.validate_client_birth_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date > CURRENT_DATE - INTERVAL '18 years' THEN
    RAISE EXCEPTION 'birth_date must identify an adult client'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_client_birth_date
  BEFORE INSERT OR UPDATE OF birth_date ON private.clients
  FOR EACH ROW EXECUTE FUNCTION private.validate_client_birth_date();

COMMENT ON COLUMN private.clients.birth_date IS
  'Required by the HU-015 API for new records; NULL is retained for pre-HU-015 records.';
COMMENT ON COLUMN private.clients.height_cm IS
  'Required by the HU-015 API for new records; centimetres with one decimal.';
COMMENT ON COLUMN private.clients.weight_kg IS
  'Required by the HU-015 API for new records; kilograms with one decimal.';
COMMENT ON COLUMN private.clients.body_fat_percentage IS
  'Optional measured body fat percentage, not a calculated evaluation result.';
COMMENT ON COLUMN private.clients.waist_cm IS
  'Optional base waist circumference in centimetres, not a historical measurement.';
COMMENT ON COLUMN private.clients.hip_cm IS
  'Optional base hip circumference in centimetres, not a historical measurement.';

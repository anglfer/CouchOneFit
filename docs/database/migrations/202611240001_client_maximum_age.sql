-- DEC-017: a client is at most 120 years old. The bound applies to new rows and to
-- changed birth dates only; existing rows are not rewritten and stay editable.
CREATE OR REPLACE FUNCTION private.validate_client_birth_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date > CURRENT_DATE - INTERVAL '16 years' THEN
    RAISE EXCEPTION 'birth_date must identify a client of at least 16 years'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date < CURRENT_DATE - INTERVAL '120 years' THEN
    IF TG_OP = 'INSERT' OR NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
      RAISE EXCEPTION 'birth_date must identify a client of at most 120 years'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

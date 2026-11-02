-- DEC-017: the minimum client age is 16 years (it was 18). Existing rows are not rewritten;
-- every previously valid birth date remains valid.
CREATE OR REPLACE FUNCTION private.validate_client_birth_date() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
    AND NEW.birth_date > CURRENT_DATE - INTERVAL '16 years' THEN
    RAISE EXCEPTION 'birth_date must identify a client of at least 16 years'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

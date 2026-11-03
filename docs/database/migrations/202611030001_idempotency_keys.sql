-- DEC-018: replays of writes captured offline must not duplicate or reapply (docs/architecture/pwa-offline.md §4.4).
-- A client sends `Idempotency-Key` (uuid); the first request stores a claim, the finished 2xx response is kept,
-- and a repetition with the same key and body returns that response without writing again.
CREATE TABLE private.idempotency_keys (
  owner_id uuid NOT NULL REFERENCES private.users(id) ON DELETE RESTRICT,
  key uuid NOT NULL,
  request_hash text NOT NULL,
  status_code integer CONSTRAINT ck_idempotency_keys_status CHECK (status_code IS NULL OR status_code BETWEEN 200 AND 299),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT pk_idempotency_keys PRIMARY KEY (owner_id, key),
  CONSTRAINT ck_idempotency_keys_complete CHECK ((status_code IS NULL) = (response IS NULL))
);
CREATE INDEX idx_idempotency_keys_created_at ON private.idempotency_keys (created_at);
ALTER TABLE private.idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.idempotency_keys FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.idempotency_keys TO couchone_authentication;
CREATE POLICY own_idempotency_keys ON private.idempotency_keys FOR ALL TO couchone_authentication
  USING (owner_id::text = current_setting('app.subject_id', true))
  WITH CHECK (owner_id::text = current_setting('app.subject_id', true));

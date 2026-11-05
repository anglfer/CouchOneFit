-- EP-06: prescribed set type (warm-up, working, top set, back-off, drop set, to failure).
ALTER TABLE private.training_sets ADD COLUMN kind text NOT NULL DEFAULT 'working'
  CONSTRAINT ck_training_sets_kind CHECK(kind IN ('warmup','working','top','backoff','drop','failure'));

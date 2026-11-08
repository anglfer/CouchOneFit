-- EP-06: rep ranges, optional RPE/RIR, prescribed rest, and real effort per performed set.
ALTER TABLE private.training_exercises ADD COLUMN rest_seconds integer CONSTRAINT ck_training_exercises_rest CHECK(rest_seconds BETWEEN 0 AND 900);
ALTER TABLE private.training_sets ALTER COLUMN rpe DROP NOT NULL;
ALTER TABLE private.training_sets ADD COLUMN reps_max integer, ADD COLUMN rir smallint CONSTRAINT ck_training_sets_rir CHECK(rir BETWEEN 0 AND 10),
  ADD CONSTRAINT ck_training_sets_reps_range CHECK(reps_max IS NULL OR reps_max BETWEEN reps AND 100);
ALTER TABLE private.training_results ADD COLUMN rpe numeric(3,1) CONSTRAINT ck_training_results_rpe CHECK(rpe BETWEEN 1 AND 10 AND mod(rpe,0.5)=0),
  ADD COLUMN rir smallint CONSTRAINT ck_training_results_rir CHECK(rir BETWEEN 0 AND 10),
  ADD CONSTRAINT ck_training_results_effort CHECK(state='performed' OR (rpe IS NULL AND rir IS NULL));

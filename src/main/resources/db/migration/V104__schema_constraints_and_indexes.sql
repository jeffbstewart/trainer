-- M5: Unique constraint on exercise_target
ALTER TABLE exercise_target ADD CONSTRAINT uq_exercise_target UNIQUE (exercise_id, target_id);

-- M6: Unique constraint on workout_plan_exercise
ALTER TABLE workout_plan_exercise ADD CONSTRAINT uq_wpe_plan_exercise UNIQUE (workout_plan_id, exercise_id);

-- L4: Cascade deletes on child tables where orphan rows have no meaning.
-- NOT adding cascade on trainer-referencing tables (historical data survives trainer deletion).
ALTER TABLE workout_session_set DROP CONSTRAINT IF EXISTS constraint_sessionset_fk;
ALTER TABLE workout_session_set ADD CONSTRAINT fk_wss_exercise
    FOREIGN KEY (session_exercise_id) REFERENCES workout_session_exercise(id) ON DELETE CASCADE;

ALTER TABLE workout_session_exercise DROP CONSTRAINT IF EXISTS constraint_sessionexercise_fk;
ALTER TABLE workout_session_exercise ADD CONSTRAINT fk_wse_session
    FOREIGN KEY (workout_session_id) REFERENCES workout_session(id) ON DELETE CASCADE;

ALTER TABLE workout_plan_exercise DROP CONSTRAINT IF EXISTS constraint_planexercise_fk;
ALTER TABLE workout_plan_exercise ADD CONSTRAINT fk_wpe_plan
    FOREIGN KEY (workout_plan_id) REFERENCES workout_plan(id) ON DELETE CASCADE;

ALTER TABLE exercise_target DROP CONSTRAINT IF EXISTS constraint_exercisetarget_exercise_fk;
ALTER TABLE exercise_target ADD CONSTRAINT fk_et_exercise
    FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE CASCADE;

ALTER TABLE exercise_target DROP CONSTRAINT IF EXISTS constraint_exercisetarget_target_fk;
ALTER TABLE exercise_target ADD CONSTRAINT fk_et_target
    FOREIGN KEY (target_id) REFERENCES target(id) ON DELETE CASCADE;

-- L5: Missing index on exercise_media.exercise_id
CREATE INDEX IF NOT EXISTS idx_exercise_media_exercise ON exercise_media(exercise_id);

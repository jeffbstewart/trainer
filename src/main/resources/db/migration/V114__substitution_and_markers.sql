ALTER TABLE workout_session_exercise ADD COLUMN substitute_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE workout_session_set RENAME COLUMN marker TO weight_marker;
ALTER TABLE workout_session_set ADD COLUMN reps_marker VARCHAR(1) DEFAULT NULL;

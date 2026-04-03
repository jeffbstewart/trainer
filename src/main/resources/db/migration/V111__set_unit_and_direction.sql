ALTER TABLE workout_session_set ADD COLUMN unit VARCHAR(10) DEFAULT 'lbs' NOT NULL;
ALTER TABLE workout_session_set ADD COLUMN weight_direction VARCHAR(4) DEFAULT NULL;

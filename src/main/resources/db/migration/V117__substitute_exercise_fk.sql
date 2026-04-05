-- Replace freetext substitute_name with a FK to exercise.
-- V116 already backfilled exercise records for all existing substitute names.

-- Add the FK column
ALTER TABLE workout_session_exercise ADD COLUMN substitute_exercise_id BIGINT DEFAULT NULL;
ALTER TABLE workout_session_exercise ADD CONSTRAINT fk_wse_substitute FOREIGN KEY (substitute_exercise_id) REFERENCES exercise(id);

-- Populate from substitute_name by matching on trainer + name (case-insensitive)
UPDATE workout_session_exercise wse
SET substitute_exercise_id = (
    SELECT e.id FROM exercise e
    JOIN workout_session ws ON ws.id = wse.workout_session_id
    WHERE e.trainer_id = ws.trainer_id
      AND LOWER(e.name) = LOWER(wse.substitute_name)
    LIMIT 1
)
WHERE wse.substitute_name IS NOT NULL AND wse.substitute_name <> '';

-- Drop the freetext column
ALTER TABLE workout_session_exercise DROP COLUMN substitute_name;

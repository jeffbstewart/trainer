-- Create exercise records for any substitute_name values that don't already
-- have a matching exercise in the trainer's library.
INSERT INTO exercise (trainer_id, name, created_at, updated_at)
SELECT DISTINCT ws.trainer_id, wse.substitute_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM workout_session_exercise wse
JOIN workout_session ws ON ws.id = wse.workout_session_id
WHERE wse.substitute_name IS NOT NULL
  AND wse.substitute_name <> ''
  AND NOT EXISTS (
    SELECT 1 FROM exercise e
    WHERE e.trainer_id = ws.trainer_id
      AND LOWER(e.name) = LOWER(wse.substitute_name)
  );

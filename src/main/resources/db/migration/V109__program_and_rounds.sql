-- Program: groups upper/lower (or other) workouts into a planning block
CREATE TABLE program (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    trainee_id      BIGINT NOT NULL,
    trainer_id      BIGINT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    sequence        VARCHAR(100),
    started_at      DATE,
    ended_at        DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_program_trainee ON program(trainee_id);
CREATE INDEX idx_program_trainer ON program(trainer_id);

-- Link workout_plan to its program
ALTER TABLE workout_plan ADD COLUMN program_id BIGINT;
ALTER TABLE workout_plan ADD CONSTRAINT fk_wp_program FOREIGN KEY (program_id) REFERENCES program(id);
CREATE INDEX idx_wp_program ON workout_plan(program_id);

-- Track which round a set belongs to (1, 2, 3, ...)
ALTER TABLE workout_session_set ADD COLUMN round_number INT;

-- Backfill: existing sets without round_number get round 1
UPDATE workout_session_set SET round_number = set_number WHERE round_number IS NULL;

-- Make round_number required going forward
ALTER TABLE workout_session_set ALTER COLUMN round_number SET NOT NULL;

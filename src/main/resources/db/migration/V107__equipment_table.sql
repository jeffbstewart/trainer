-- Equipment as a first-class entity (trainer-scoped)
CREATE TABLE equipment (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    trainer_id      BIGINT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_equipment_trainer ON equipment(trainer_id);

-- Many-to-many: exercises require equipment
CREATE TABLE exercise_equipment (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    exercise_id     BIGINT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
    equipment_id    BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    CONSTRAINT uq_exercise_equipment UNIQUE (exercise_id, equipment_id)
);

-- Drop the freetext equipment column (replaced by the join table)
ALTER TABLE exercise DROP COLUMN equipment;

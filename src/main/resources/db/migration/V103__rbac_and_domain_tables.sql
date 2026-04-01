-- RBAC: add trainer_id and created_by to app_user
ALTER TABLE app_user ADD COLUMN trainer_id BIGINT;
ALTER TABLE app_user ADD COLUMN created_by BIGINT;

-- Trainer-scoped targets (muscles, muscle groups, objectives)
CREATE TABLE target (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    trainer_id      BIGINT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL DEFAULT 'MUSCLE',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_target_trainer ON target(trainer_id);

-- Trainer-scoped exercises
CREATE TABLE exercise (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    trainer_id      BIGINT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     CLOB,
    form_notes      CLOB,
    progression_rank INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_exercise_trainer ON exercise(trainer_id);

-- Exercise-to-target many-to-many
CREATE TABLE exercise_target (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    exercise_id     BIGINT NOT NULL REFERENCES exercise(id),
    target_id       BIGINT NOT NULL REFERENCES target(id)
);
CREATE INDEX idx_exercise_target_exercise ON exercise_target(exercise_id);
CREATE INDEX idx_exercise_target_target ON exercise_target(target_id);

-- Exercise media (technique photos/videos)
CREATE TABLE exercise_media (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    exercise_id     BIGINT NOT NULL REFERENCES exercise(id),
    content_type    VARCHAR(50) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    caption         VARCHAR(500),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workout plans (templates)
CREATE TABLE workout_plan (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    trainee_id      BIGINT NOT NULL,
    trainer_id      BIGINT NOT NULL,
    name            VARCHAR(200) NOT NULL,
    sequence        VARCHAR(100),
    plan_type       VARCHAR(50) NOT NULL DEFAULT 'CUSTOM',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_workout_plan_trainee ON workout_plan(trainee_id);
CREATE INDEX idx_workout_plan_trainer ON workout_plan(trainer_id);

-- Exercises within a plan (ordered)
CREATE TABLE workout_plan_exercise (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    workout_plan_id BIGINT NOT NULL REFERENCES workout_plan(id),
    exercise_id     BIGINT NOT NULL REFERENCES exercise(id),
    sort_order      INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_wpe_plan ON workout_plan_exercise(workout_plan_id);

-- Workout sessions (dated executions of a plan)
CREATE TABLE workout_session (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    workout_plan_id BIGINT NOT NULL REFERENCES workout_plan(id),
    trainee_id      BIGINT NOT NULL,
    trainer_id      BIGINT NOT NULL,
    session_date    DATE NOT NULL,
    notes           CLOB,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ws_trainee ON workout_session(trainee_id);
CREATE INDEX idx_ws_trainer ON workout_session(trainer_id);
CREATE INDEX idx_ws_date ON workout_session(session_date);

-- Per-exercise data within a session
CREATE TABLE workout_session_exercise (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    workout_session_id BIGINT NOT NULL REFERENCES workout_session(id),
    exercise_id     BIGINT NOT NULL REFERENCES exercise(id),
    set_style       VARCHAR(20),
    resistance_note VARCHAR(20),
    notes           CLOB
);
CREATE INDEX idx_wse_session ON workout_session_exercise(workout_session_id);

-- Individual sets within an exercise in a session
CREATE TABLE workout_session_set (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_exercise_id BIGINT NOT NULL REFERENCES workout_session_exercise(id),
    set_number      INT NOT NULL,
    weight          DECIMAL(8,2),
    reps            INT
);
CREATE INDEX idx_wss_exercise ON workout_session_set(session_exercise_id);

-- Trainee media (form checks, progress photos)
CREATE TABLE trainee_media (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    trainee_id      BIGINT NOT NULL,
    trainer_id      BIGINT NOT NULL,
    content_type    VARCHAR(50) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    caption         VARCHAR(500),
    captured_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trainee_media_trainee ON trainee_media(trainee_id);

-- Impersonation audit log
CREATE TABLE impersonation_log (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_id        BIGINT NOT NULL,
    impersonated_id BIGINT NOT NULL,
    started_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at        TIMESTAMP
);
CREATE INDEX idx_impersonation_admin ON impersonation_log(admin_id);

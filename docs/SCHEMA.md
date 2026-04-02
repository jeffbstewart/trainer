# Database Schema

## Core Tables

### app_user

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-increment |
| username | VARCHAR(100) | Unique |
| password_hash | VARCHAR(200) | BCrypt |
| access_level | INT | 1=Trainee, 2=Trainer, 3=Manager, 4=Admin |
| trainer_id | BIGINT FK | Points to trainer (for trainees). Null for trainers/managers/admins. |
| created_by | BIGINT FK | Which user created this account |
| locked | BOOLEAN | Account lockout |
| must_change_password | BOOLEAN | Force password change on next login |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### app_config

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto-increment |
| config_key | VARCHAR(100) | Unique |
| config_val | VARCHAR(4000) | |

## Trainer-Scoped Data

### target

Muscles, muscle groups, or objectives (e.g., "Glutes", "Cardio", "Stability").
Scoped per trainer — trainers cannot see each other's targets.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| trainer_id | BIGINT FK | Owner trainer |
| name | VARCHAR(200) | |
| category | VARCHAR(50) | MUSCLE, MUSCLE_GROUP, or OBJECTIVE |
| created_at | TIMESTAMP | |

### exercise

Individual exercises with form guidance and difficulty rating.
Scoped per trainer.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| trainer_id | BIGINT FK | Owner trainer |
| name | VARCHAR(200) | |
| description | TEXT | General description |
| form_notes | TEXT | Technique guidance |
| difficulty | VARCHAR(20) | BEGINNER, INTERMEDIATE, or ADVANCED |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### exercise_target

Many-to-many link between exercises and targets.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| exercise_id | BIGINT FK | |
| target_id | BIGINT FK | |

### exercise_media

Photos and videos of proper technique, per exercise.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| exercise_id | BIGINT FK | |
| content_type | VARCHAR(50) | e.g., image/jpeg, video/mp4 |
| file_path | VARCHAR(500) | Path on disk |
| caption | VARCHAR(500) | |
| created_at | TIMESTAMP | |

## Workout Data

### program

A training block (typically ~8 weeks) grouping upper/lower workout plans
for a trainee. The unit of planning for trainers.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| trainee_id | BIGINT FK | Which client |
| trainer_id | BIGINT FK | Which trainer created it |
| name | VARCHAR(200) | e.g., "Spring 2026" |
| sequence | VARCHAR(100) | Freetext ordering (e.g., "12", "Phase 3"). Numeric sort when all-numeric. |
| started_at | DATE | When the program started |
| ended_at | DATE | When the program ended (null if active) |
| created_at | TIMESTAMP | |

### workout_plan

A template for a workout session within a program. Each plan has a sequence
identifier (freetext) and a type (upper/lower/full/custom).

After 3-4 sessions of the same plan, the trainer creates the next plan.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| program_id | BIGINT FK | Parent program (nullable for legacy plans) |
| trainee_id | BIGINT FK | Which client this plan is for |
| trainer_id | BIGINT FK | Which trainer created it (survives reassignment) |
| name | VARCHAR(200) | e.g., "Upper Body A" |
| sequence | VARCHAR(100) | Freetext ordering field. Numeric sort when all-numeric, lexicographic otherwise. |
| plan_type | VARCHAR(50) | UPPER, LOWER, FULL, CUSTOM |
| created_at | TIMESTAMP | |

### workout_plan_exercise

Exercises in a plan, ordered.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| workout_plan_id | BIGINT FK | |
| exercise_id | BIGINT FK | |
| sort_order | INT | Display order within the plan |

### workout_session

A dated execution of a workout plan. Records when the workout happened
and which trainer ran it.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| workout_plan_id | BIGINT FK | Which plan was executed |
| trainee_id | BIGINT FK | |
| trainer_id | BIGINT FK | Trainer at time of session (survives reassignment) |
| session_date | DATE | When the workout occurred |
| notes | TEXT | Freetext session-level notes |
| created_at | TIMESTAMP | |

### workout_session_exercise

Recorded data per exercise per session. One row per exercise (not per set).
Individual sets are tracked in `workout_session_set`.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| workout_session_id | BIGINT FK | |
| exercise_id | BIGINT FK | |
| set_style | VARCHAR(20) | ALTERNATING, EACH, STANDARD |
| resistance_note | VARCHAR(20) | MORE, LESS, SAME, or null |
| notes | TEXT | Freetext per-exercise notes |

### workout_session_set

Individual sets within an exercise in a session. Each set belongs to a
round (circuit lap). In a typical 3-round circuit, each exercise has
3 sets (one per round).

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| session_exercise_id | BIGINT FK | Points to workout_session_exercise |
| set_number | INT | Sequential set number (1, 2, 3, ...) |
| round_number | INT | Which circuit round (1, 2, 3) |
| weight | DECIMAL(8,2) | Weight used (nullable for bodyweight) |
| reps | INT | Repetitions completed |

## Trainee Media

### trainee_media

Per-trainee photos and videos captured by the trainer (form checks, progress).

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| trainee_id | BIGINT FK | |
| trainer_id | BIGINT FK | Who captured it |
| content_type | VARCHAR(50) | |
| file_path | VARCHAR(500) | |
| caption | VARCHAR(500) | |
| captured_at | TIMESTAMP | |

## Audit

### impersonation_log

Tracks admin impersonation sessions with start and end times.
Logout while impersonating ends the impersonation (not the admin session).

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| admin_id | BIGINT FK | The admin performing the impersonation |
| impersonated_id | BIGINT FK | The user being impersonated |
| started_at | TIMESTAMP | When impersonation began |
| ended_at | TIMESTAMP | When impersonation ended (null if still active) |

## Sorting Notes

The `workout_plan.sequence` field supports freetext values. When displaying
plans in order, the application sorts by:
1. Try numeric parse — if all sequence values for a trainee are numeric, sort numerically
2. Otherwise, sort lexicographically

This allows trainers to use "1", "2", "3" or "Phase 1 Week 1", "Phase 1 Week 2", etc.

## Difficulty Notes

Exercises have a `difficulty` field: BEGINNER, INTERMEDIATE, or ADVANCED.
This is a simple classification — not a strict progression ordering.
Target landing pages group exercises by difficulty level.

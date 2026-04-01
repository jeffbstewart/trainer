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

Individual exercises with form guidance and progression ranking.
Scoped per trainer. Progression order is derived from `progression_rank`
within a target (computed in application code, not a separate table).

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| trainer_id | BIGINT FK | Owner trainer |
| name | VARCHAR(200) | |
| description | TEXT | General description |
| form_notes | TEXT | Technique guidance |
| progression_rank | INT | Higher = harder. Progression order per target derived from this. |
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

### workout_plan

A template for a workout session. Each plan has a sequence identifier
(freetext, trainer's choice — could be "#12", "Phase 3 Week 2", etc.)
and a type (upper/lower/full/custom).

After 3-4 sessions of the same plan, the trainer creates the next plan.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| trainee_id | BIGINT FK | Which client this plan is for |
| trainer_id | BIGINT FK | Which trainer created it (survives reassignment) |
| name | VARCHAR(200) | e.g., "Upper Body" |
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

Individual sets within an exercise in a session.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| session_exercise_id | BIGINT FK | Points to workout_session_exercise |
| set_number | INT | 1, 2, 3, ... |
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

## Progression Notes

Exercise progressions are **not stored as relationships** in the database.
Instead, progression order within a target is derived at query time from
`exercise.progression_rank` grouped by target (via `exercise_target`).

For a given target, the progression is:
```
SELECT e.* FROM exercise e
JOIN exercise_target et ON et.exercise_id = e.id
WHERE et.target_id = ? AND e.trainer_id = ?
ORDER BY e.progression_rank ASC
```

Lower rank = easier, higher rank = harder. The "next" exercise in a
progression is the next higher rank for the same target.

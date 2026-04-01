# Role-Based Access Control

## Roles

| Role | Level | Created By | Description |
|------|-------|------------|-------------|
| **Admin** | 4 | Setup page (first account) or another Admin | Full system access. Can impersonate any account. Cannot delete the last admin. |
| **Manager** | 3 | Admin | Creates trainer accounts. Moves trainees between trainers. Views org-level reports. |
| **Trainer** | 2 | Manager or Admin | Plans and tracks workouts for their trainees. Owns exercises, targets, and media. Creates trainee accounts. |
| **Trainee** | 1 | Trainer, Manager, or Admin | Views their own workouts and history. Views exercise pages for exercises assigned to them. |

## Data Ownership

### Trainer-scoped data (isolation by trainer)

Each trainer has their own independent set of:
- **Targets** — muscles, muscle groups, objectives (e.g., "glutes", "cardio", "stability")
- **Exercises** — individual exercises with form notes, progression rank, target associations
- **Exercise progressions** — ordered sequences of exercises per target
- **Exercise media** — photos and videos of proper technique (per-exercise)

Trainers cannot see or modify each other's exercises, targets, or progressions.

### Trainee-scoped data

- **Workouts** — a dated plan (upper body, lower body) with 6-7 exercises per circuit
- **Workout sessions** — a completed instance of a workout, recording weights, reps, set style, and resistance annotations per exercise
- **Trainee media** — per-trainee photos and videos captured by the trainer (form checks, progress photos)

### Ownership survival

When a trainee is moved to a different trainer:
- Historical workouts and sessions retain the original trainer reference
- The trainee can see all their historical workouts regardless of which trainer created them

When a trainer account is deleted:
- Exercises, targets, and progressions are **not deleted** — they are orphaned but preserved for historical workout integrity
- Historical workouts and sessions remain intact
- The deleted trainer's exercises become read-only (no one can edit them, but they appear in workout history)
- A manager or admin must reassign active trainees before deletion is allowed

## Permissions Matrix

| Action | Trainee | Trainer | Manager | Admin |
|--------|---------|---------|---------|-------|
| **Own Profile** | | | | |
| View own profile | yes | yes | yes | yes |
| Change own password | yes | yes | yes | yes |
| **Workouts** | | | | |
| View own workout history | yes | yes | yes | yes |
| View trainee workout history | — | own trainees | all trainees | all trainees |
| Create/edit workout plan | — | own trainees | — | via impersonation |
| Record workout session | — | own trainees | — | via impersonation |
| **Exercises** | | | | |
| View exercise page | assigned only | own exercises | — | all exercises |
| Create/edit exercise | — | own exercises | — | via impersonation |
| Create/edit target | — | own targets | — | via impersonation |
| View exercise media | assigned only | own exercises | — | all |
| Upload exercise media | — | own exercises | — | via impersonation |
| **Trainee Media** | | | | |
| View own trainee media | yes | own trainees | — | all |
| Upload trainee media | — | own trainees | — | via impersonation |
| **Accounts** | | | | |
| Create trainee account | — | yes | yes | yes |
| Create trainer account | — | — | yes | yes |
| Create manager account | — | — | — | yes |
| Create admin account | — | — | — | yes |
| Move trainee to another trainer | — | — | yes | yes |
| Delete trainee account | — | own trainees | any trainee | any trainee |
| Delete trainer account | — | — | yes (if no active trainees) | yes (if no active trainees) |
| Delete admin account | — | — | — | yes (not last admin) |
| **Impersonation** | | | | |
| Impersonate any user | — | — | — | yes (audit logged) |

## Impersonation

Admins can impersonate any user to perform actions as that user. This is useful for:
- Debugging issues a user reports
- Performing operations on behalf of a trainer or trainee

All impersonated actions are recorded in an audit log with:
- The admin's user ID
- The impersonated user's ID
- The action performed
- Timestamp

The UI should clearly indicate when impersonation is active.

## Account Lifecycle

1. **Setup**: First account created via `/setup` page is an Admin (access_level = 4)
2. **Trainer creation**: Manager or Admin creates a trainer account
3. **Trainee creation**: Trainer creates accounts for their clients
4. **Trainer departure**: Manager reassigns trainees, then deletes trainer account. Historical data survives.
5. **Trainee departure**: Trainer or Manager deletes trainee. Historical workout data may be retained or purged per policy.

## "Assigned" Exercise Visibility (Trainees)

A trainee can view an exercise page if any of:
- The exercise appears in any of their current or historical workout plans
- The exercise is linked as a harder/easier variant of an assigned exercise (one level of traversal)

This allows trainees to explore their progression path without seeing the trainer's full exercise library.

package net.stewart.trainer.armeria

import com.github.vokorm.findAll
import com.google.gson.Gson
import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.ServiceRequestContext
import com.linecorp.armeria.server.annotation.Blocking
import com.linecorp.armeria.server.annotation.Delete
import com.linecorp.armeria.server.annotation.Get
import com.linecorp.armeria.server.annotation.Param
import com.linecorp.armeria.server.annotation.Post
import net.stewart.trainer.entity.*
import java.time.LocalDate
import java.time.LocalDateTime

@Blocking
class ProgramHttpService {

    private val gson = Gson()

    /** List programs for the trainer's trainees. */
    @Get("/api/v1/programs")
    fun list(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val traineeIds = AppUser.findAll()
            .filter { it.trainer_id == user.id }
            .mapNotNull { it.id }
            .toSet()

        val programs = Program.findAll()
            .filter { it.trainer_id == user.id || it.trainee_id in traineeIds }
            .sortedWith(compareByDescending<Program> { it.created_at })

        val trainees = AppUser.findAll().associateBy { it.id }

        val rows = programs.map { p ->
            mapOf(
                "id" to p.id,
                "name" to p.name,
                "sequence" to p.sequence,
                "trainee_id" to p.trainee_id,
                "trainee_name" to (trainees[p.trainee_id]?.username ?: "Unknown"),
                "started_at" to p.started_at?.toString(),
                "ended_at" to p.ended_at?.toString(),
                "active" to (p.ended_at == null)
            )
        }
        return json(mapOf("programs" to rows))
    }

    /** Create a new program. */
    @Post("/api/v1/programs")
    fun create(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val name = (body["name"] as? String)?.trim() ?: return badRequest("name required")
        val traineeId = (body["trainee_id"] as? Number)?.toLong() ?: return badRequest("trainee_id required")
        val sequence = (body["sequence"] as? String)?.trim()

        val trainee = AppUser.findById(traineeId)
        if (trainee == null || trainee.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val program = Program(
            trainee_id = traineeId,
            trainer_id = user.id!!,
            name = name,
            sequence = sequence,
            started_at = LocalDate.now(),
            created_at = LocalDateTime.now()
        )
        program.save()
        return json(mapOf("ok" to true, "id" to program.id))
    }

    /** Get full program detail with workouts and session grid data. */
    @Get("/api/v1/programs/{programId}")
    fun detail(ctx: ServiceRequestContext, @Param("programId") programId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val program = Program.findById(programId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (program.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val trainee = AppUser.findById(program.trainee_id)
        val workouts = WorkoutPlan.findAll().filter { it.program_id == programId }
            .sortedBy { it.plan_type }

        val allExercises = Exercise.findAll().associateBy { it.id }
        val allPlanExercises = WorkoutPlanExercise.findAll()
        val allSessions = WorkoutSession.findAll().filter { it.workout_plan_id in workouts.mapNotNull { w -> w.id } }
        val allSessionExercises = WorkoutSessionExercise.findAll()
        val allSets = WorkoutSessionSet.findAll()

        val workoutData = workouts.map { wp ->
            val planExercises = allPlanExercises
                .filter { it.workout_plan_id == wp.id }
                .sortedBy { it.sort_order }

            val sessions = allSessions
                .filter { it.workout_plan_id == wp.id }
                .sortedBy { it.session_date }

            val sessionData = sessions.map { session ->
                val sessionExercises = allSessionExercises.filter { it.workout_session_id == session.id }
                val exerciseData = planExercises.map { pe ->
                    val se = sessionExercises.firstOrNull { it.exercise_id == pe.exercise_id }
                    val sets = if (se != null) {
                        allSets.filter { it.session_exercise_id == se.id }
                            .sortedBy { it.round_number }
                            .map { s ->
                                mapOf(
                                    "id" to s.id,
                                    "round_number" to s.round_number,
                                    "weight" to s.weight?.toDouble(),
                                    "reps" to s.reps
                                )
                            }
                    } else emptyList()

                    mapOf(
                        "exercise_id" to pe.exercise_id,
                        "set_style" to se?.set_style,
                        "resistance_note" to se?.resistance_note,
                        "notes" to se?.notes,
                        "sets" to sets
                    )
                }

                mapOf(
                    "id" to session.id,
                    "session_date" to session.session_date?.toString(),
                    "notes" to session.notes,
                    "exercises" to exerciseData
                )
            }

            mapOf(
                "id" to wp.id,
                "name" to wp.name,
                "plan_type" to wp.plan_type,
                "exercises" to planExercises.map { pe ->
                    val ex = allExercises[pe.exercise_id]
                    mapOf("id" to pe.exercise_id, "name" to (ex?.name ?: "Unknown"), "sort_order" to pe.sort_order)
                },
                "sessions" to sessionData
            )
        }

        val result = mapOf(
            "id" to program.id,
            "name" to program.name,
            "sequence" to program.sequence,
            "trainee_id" to program.trainee_id,
            "trainee_name" to (trainee?.username ?: "Unknown"),
            "started_at" to program.started_at?.toString(),
            "ended_at" to program.ended_at?.toString(),
            "workouts" to workoutData
        )
        return json(result)
    }

    /** Add a workout plan to a program. */
    @Post("/api/v1/programs/{programId}/workouts")
    fun addWorkout(ctx: ServiceRequestContext, @Param("programId") programId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val program = Program.findById(programId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (program.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val name = (body["name"] as? String)?.trim() ?: return badRequest("name required")
        val planType = (body["plan_type"] as? String)?.uppercase() ?: "CUSTOM"

        val wp = WorkoutPlan(
            program_id = programId,
            trainee_id = program.trainee_id,
            trainer_id = user.id!!,
            name = name,
            plan_type = planType,
            created_at = LocalDateTime.now()
        )
        wp.save()
        return json(mapOf("ok" to true, "id" to wp.id))
    }

    /** Add an exercise to a workout plan. */
    @Post("/api/v1/programs/{programId}/workouts/{workoutId}/exercises")
    fun addExercise(ctx: ServiceRequestContext, @Param("programId") programId: Long, @Param("workoutId") workoutId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val wp = WorkoutPlan.findById(workoutId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (wp.trainer_id != user.id || wp.program_id != programId) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val exerciseId = (body["exercise_id"] as? Number)?.toLong() ?: return badRequest("exercise_id required")

        val exercise = Exercise.findById(exerciseId)
        if (exercise == null || exercise.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val maxOrder = WorkoutPlanExercise.findAll()
            .filter { it.workout_plan_id == workoutId }
            .maxOfOrNull { it.sort_order } ?: -1

        WorkoutPlanExercise(
            workout_plan_id = workoutId,
            exercise_id = exerciseId,
            sort_order = maxOrder + 1
        ).save()

        return json(mapOf("ok" to true))
    }

    /** Remove an exercise from a workout plan. */
    @Delete("/api/v1/programs/{programId}/workouts/{workoutId}/exercises/{exerciseId}")
    fun removeExercise(
        ctx: ServiceRequestContext,
        @Param("programId") programId: Long,
        @Param("workoutId") workoutId: Long,
        @Param("exerciseId") exerciseId: Long
    ): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val wp = WorkoutPlan.findById(workoutId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (wp.trainer_id != user.id || wp.program_id != programId) return HttpResponse.of(HttpStatus.FORBIDDEN)

        WorkoutPlanExercise.findAll()
            .filter { it.workout_plan_id == workoutId && it.exercise_id == exerciseId }
            .forEach { it.delete() }

        return json(mapOf("ok" to true))
    }

    /** Record a new session for a workout plan. */
    @Post("/api/v1/programs/{programId}/workouts/{workoutId}/sessions")
    fun addSession(ctx: ServiceRequestContext, @Param("programId") programId: Long, @Param("workoutId") workoutId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val wp = WorkoutPlan.findById(workoutId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (wp.trainer_id != user.id || wp.program_id != programId) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val dateStr = body["session_date"] as? String
        val sessionDate = dateStr?.let { LocalDate.parse(it) } ?: LocalDate.now()

        val session = WorkoutSession(
            workout_plan_id = workoutId,
            trainee_id = wp.trainee_id,
            trainer_id = user.id!!,
            session_date = sessionDate,
            notes = (body["notes"] as? String)?.trim(),
            created_at = LocalDateTime.now()
        )
        session.save()

        // Pre-create session_exercise rows for each plan exercise
        val planExercises = WorkoutPlanExercise.findAll().filter { it.workout_plan_id == workoutId }
        for (pe in planExercises) {
            WorkoutSessionExercise(
                workout_session_id = session.id!!,
                exercise_id = pe.exercise_id
            ).save()
        }

        return json(mapOf("ok" to true, "id" to session.id))
    }

    /** Record a set for an exercise in a session. */
    @Post("/api/v1/sessions/{sessionId}/exercises/{exerciseId}/sets")
    fun recordSet(ctx: ServiceRequestContext, @Param("sessionId") sessionId: Long, @Param("exerciseId") exerciseId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val session = WorkoutSession.findById(sessionId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (session.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val se = WorkoutSessionExercise.findAll()
            .firstOrNull { it.workout_session_id == sessionId && it.exercise_id == exerciseId }
            ?: return HttpResponse.of(HttpStatus.NOT_FOUND)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val roundNumber = (body["round_number"] as? Number)?.toInt() ?: return badRequest("round_number required")
        val weight = (body["weight"] as? Number)?.toDouble()?.let { java.math.BigDecimal.valueOf(it) }
        val reps = (body["reps"] as? Number)?.toInt()

        // Find existing set for this round, or create new
        val existing = WorkoutSessionSet.findAll()
            .firstOrNull { it.session_exercise_id == se.id && it.round_number == roundNumber }

        if (existing != null) {
            existing.weight = weight
            existing.reps = reps
            existing.save()
        } else {
            val setNumber = WorkoutSessionSet.findAll()
                .filter { it.session_exercise_id == se.id }
                .maxOfOrNull { it.set_number }?.plus(1) ?: 1

            WorkoutSessionSet(
                session_exercise_id = se.id!!,
                set_number = setNumber,
                round_number = roundNumber,
                weight = weight,
                reps = reps
            ).save()
        }

        return json(mapOf("ok" to true))
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

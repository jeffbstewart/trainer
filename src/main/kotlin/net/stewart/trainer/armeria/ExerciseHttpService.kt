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
import net.stewart.trainer.entity.Equipment
import net.stewart.trainer.entity.Exercise
import net.stewart.trainer.entity.ExerciseEquipment
import net.stewart.trainer.entity.ExerciseTarget
import net.stewart.trainer.entity.Target
import net.stewart.trainer.entity.WorkoutPlanExercise
import java.time.LocalDateTime

@Blocking
class ExerciseHttpService {

    private val gson = Gson()

    /** List exercises. Defaults to current user's exercises. Admins/managers can pass trainer_id. */
    @Get("/api/v1/exercises")
    fun list(ctx: ServiceRequestContext, @com.linecorp.armeria.server.annotation.Param("trainer_id") @com.linecorp.armeria.server.annotation.Default("0") trainerId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val effectiveTrainerId = if (trainerId > 0 && user.isManager()) trainerId else user.id!!
        val exercises = Exercise.findAll().filter { it.trainer_id == effectiveTrainerId }
        val allTargets = Target.findAll().filter { it.trainer_id == effectiveTrainerId }.associateBy { it.id }
        val allEquipment = Equipment.findAll().filter { it.trainer_id == user.id }.associateBy { it.id }
        val allTargetLinks = ExerciseTarget.findAll()
        val allEquipLinks = ExerciseEquipment.findAll()

        val rows = exercises.sortedBy { it.name.lowercase() }.map { ex ->
            val targetIds = allTargetLinks.filter { it.exercise_id == ex.id }.map { it.target_id }
            val targets = targetIds.mapNotNull { allTargets[it] }.map { mapOf("id" to it.id, "name" to it.name) }
            val equipIds = allEquipLinks.filter { it.exercise_id == ex.id }.map { it.equipment_id }
            val equipment = equipIds.mapNotNull { allEquipment[it] }.map { mapOf("id" to it.id, "name" to it.name) }
            mapOf(
                "id" to ex.id,
                "name" to ex.name,
                "description" to ex.description,
                "form_notes" to ex.form_notes,
                "equipment" to equipment,
                "difficulty" to ex.difficulty,
                "targets" to targets
            )
        }
        return json(mapOf("exercises" to rows))
    }

    /** Get a single exercise with full detail. */
    @Get("/api/v1/exercises/{exerciseId}")
    fun detail(ctx: ServiceRequestContext, @Param("exerciseId") exerciseId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val ex = Exercise.findById(exerciseId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (ex.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val targetIds = ExerciseTarget.findAll().filter { it.exercise_id == exerciseId }.map { it.target_id }
        val targets = Target.findAll().filter { it.id in targetIds }.map { mapOf("id" to it.id, "name" to it.name, "category" to it.category) }

        val equipIds = ExerciseEquipment.findAll().filter { it.exercise_id == exerciseId }.map { it.equipment_id }
        val equipment = Equipment.findAll().filter { it.id in equipIds }.map { mapOf("id" to it.id, "name" to it.name) }

        val result = mapOf(
            "id" to ex.id,
            "name" to ex.name,
            "description" to ex.description,
            "form_notes" to ex.form_notes,
            "equipment" to equipment,
            "difficulty" to ex.difficulty,
            "targets" to targets
        )
        return json(result)
    }

    /** Create a new exercise. */
    @Post("/api/v1/exercises")
    fun create(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val name = (body["name"] as? String)?.trim() ?: return badRequest("name required")
        if (name.isEmpty()) return badRequest("Name cannot be empty")

        val now = LocalDateTime.now()
        val ex = Exercise(
            trainer_id = user.id!!,
            name = name,
            description = (body["description"] as? String)?.trim(),
            form_notes = (body["form_notes"] as? String)?.trim(),
            difficulty = (body["difficulty"] as? String)?.uppercase() ?: "INTERMEDIATE",
            created_at = now,
            updated_at = now
        )
        ex.save()

        // Associate targets
        @Suppress("UNCHECKED_CAST")
        val targetIds = (body["target_ids"] as? List<Number>)?.map { it.toLong() }
        if (targetIds != null && targetIds.isNotEmpty()) {
            for (tid in targetIds) {
                val target = Target.findById(tid)
                if (target != null && target.trainer_id == user.id) {
                    ExerciseTarget(exercise_id = ex.id!!, target_id = tid).save()
                }
            }
        } else {
            // No targets specified — assign TBD
            val tbdId = TargetHttpService.ensureTbdTarget(user.id!!)
            ExerciseTarget(exercise_id = ex.id!!, target_id = tbdId).save()
        }

        // Associate equipment
        @Suppress("UNCHECKED_CAST")
        val equipIds = (body["equipment_ids"] as? List<Number>)?.map { it.toLong() } ?: emptyList()
        for (eid in equipIds) {
            val equip = Equipment.findById(eid)
            if (equip != null && equip.trainer_id == user.id) {
                ExerciseEquipment(exercise_id = ex.id!!, equipment_id = eid).save()
            }
        }

        return json(mapOf("ok" to true, "id" to ex.id))
    }

    /** Update an exercise. */
    @Post("/api/v1/exercises/{exerciseId}")
    fun update(ctx: ServiceRequestContext, @Param("exerciseId") exerciseId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val ex = Exercise.findById(exerciseId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (ex.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        if (body.containsKey("name")) {
            val name = (body["name"] as String).trim()
            if (name.isEmpty()) return badRequest("Name cannot be empty")
            ex.name = name
        }
        if (body.containsKey("description")) ex.description = (body["description"] as? String)?.trim()
        if (body.containsKey("form_notes")) ex.form_notes = (body["form_notes"] as? String)?.trim()
        if (body.containsKey("difficulty")) ex.difficulty = (body["difficulty"] as String).uppercase()
        ex.updated_at = LocalDateTime.now()
        ex.save()

        // Update target associations if provided
        if (body.containsKey("target_ids")) {
            @Suppress("UNCHECKED_CAST")
            val targetIds = (body["target_ids"] as? List<Number>)?.map { it.toLong() } ?: emptyList()
            ExerciseTarget.findAll().filter { it.exercise_id == exerciseId }.forEach { it.delete() }
            for (tid in targetIds) {
                val target = Target.findById(tid)
                if (target != null && target.trainer_id == user.id) {
                    ExerciseTarget(exercise_id = exerciseId, target_id = tid).save()
                }
            }
        }

        // Update equipment associations if provided
        if (body.containsKey("equipment_ids")) {
            @Suppress("UNCHECKED_CAST")
            val equipIds = (body["equipment_ids"] as? List<Number>)?.map { it.toLong() } ?: emptyList()
            ExerciseEquipment.findAll().filter { it.exercise_id == exerciseId }.forEach { it.delete() }
            for (eid in equipIds) {
                val equip = Equipment.findById(eid)
                if (equip != null && equip.trainer_id == user.id) {
                    ExerciseEquipment(exercise_id = exerciseId, equipment_id = eid).save()
                }
            }
        }

        return json(mapOf("ok" to true))
    }

    /** Delete an exercise. */
    @Delete("/api/v1/exercises/{exerciseId}")
    fun delete(ctx: ServiceRequestContext, @Param("exerciseId") exerciseId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val ex = Exercise.findById(exerciseId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (ex.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        // Block deletion if exercise is used in any workout plan
        val usedInPlans = WorkoutPlanExercise.findAll().any { it.exercise_id == exerciseId }
        if (usedInPlans) return badRequest("Cannot delete exercise that is used in a workout plan")

        ExerciseTarget.findAll().filter { it.exercise_id == exerciseId }.forEach { it.delete() }
        ExerciseEquipment.findAll().filter { it.exercise_id == exerciseId }.forEach { it.delete() }
        ex.delete()
        return json(mapOf("ok" to true))
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

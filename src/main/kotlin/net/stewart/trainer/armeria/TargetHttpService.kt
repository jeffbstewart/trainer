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
import net.stewart.trainer.entity.ExerciseTarget
import net.stewart.trainer.entity.Target
import java.time.LocalDateTime

@Blocking
class TargetHttpService {

    private val gson = Gson()

    @Get("/api/v1/targets")
    fun list(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val targets = Target.findAll()
            .filter { it.trainer_id == user.id }
            .sortedBy { it.name.lowercase() }

        val exerciseCounts = ExerciseTarget.findAll()
            .filter { et -> targets.any { it.id == et.target_id } }
            .groupBy { it.target_id }
            .mapValues { it.value.size }

        val rows = targets.map { t ->
            mapOf(
                "id" to t.id,
                "name" to t.name,
                "category" to t.category,
                "exercise_count" to (exerciseCounts[t.id] ?: 0)
            )
        }
        return json(mapOf("targets" to rows))
    }

    @Post("/api/v1/targets")
    fun create(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val name = (body["name"] as? String)?.trim() ?: return badRequest("name required")
        val category = (body["category"] as? String)?.uppercase() ?: "MUSCLE"

        if (name.isEmpty()) return badRequest("Name cannot be empty")
        if (category !in setOf("MUSCLE", "MUSCLE_GROUP", "OBJECTIVE")) return badRequest("Invalid category")

        // Check uniqueness within trainer
        if (Target.findAll().any { it.trainer_id == user.id && it.name.equals(name, ignoreCase = true) }) {
            return badRequest("You already have a target named \"$name\"")
        }

        val target = Target(
            trainer_id = user.id!!,
            name = name,
            category = category,
            created_at = LocalDateTime.now()
        )
        target.save()
        return json(mapOf("ok" to true, "id" to target.id))
    }

    @Post("/api/v1/targets/{targetId}")
    fun update(ctx: ServiceRequestContext, @Param("targetId") targetId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val target = Target.findById(targetId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (target.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        if (body.containsKey("name")) {
            val name = (body["name"] as String).trim()
            if (name.isEmpty()) return badRequest("Name cannot be empty")
            if (Target.findAll().any { it.trainer_id == user.id && it.name.equals(name, ignoreCase = true) && it.id != targetId }) {
                return badRequest("You already have a target named \"$name\"")
            }
            target.name = name
        }
        if (body.containsKey("category")) target.category = (body["category"] as String).uppercase()
        target.save()
        return json(mapOf("ok" to true))
    }

    @Delete("/api/v1/targets/{targetId}")
    fun delete(ctx: ServiceRequestContext, @Param("targetId") targetId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val target = Target.findById(targetId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (target.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        // Remove exercise associations first
        ExerciseTarget.findAll().filter { it.target_id == targetId }.forEach { it.delete() }
        target.delete()
        return json(mapOf("ok" to true))
    }

    /** Ensures a "TBD" target exists for this trainer. Returns its ID. */
    companion object {
        fun ensureTbdTarget(trainerId: Long): Long {
            val existing = Target.findAll().firstOrNull {
                it.trainer_id == trainerId && it.name.equals("TBD", ignoreCase = true)
            }
            if (existing != null) return existing.id!!

            val tbd = Target(
                trainer_id = trainerId,
                name = "TBD",
                category = "OBJECTIVE",
                created_at = LocalDateTime.now()
            )
            tbd.save()
            return tbd.id!!
        }
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

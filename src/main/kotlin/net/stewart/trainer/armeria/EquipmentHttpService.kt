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
import net.stewart.trainer.entity.ExerciseEquipment
import java.time.LocalDateTime

@Blocking
class EquipmentHttpService {

    private val gson = Gson()

    @Get("/api/v1/equipment")
    fun list(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val items = Equipment.findAll()
            .filter { it.trainer_id == user.id }
            .sortedBy { it.name.lowercase() }

        val exerciseCounts = ExerciseEquipment.findAll()
            .filter { ee -> items.any { it.id == ee.equipment_id } }
            .groupBy { it.equipment_id }
            .mapValues { it.value.size }

        val rows = items.map { e ->
            mapOf("id" to e.id, "name" to e.name, "exercise_count" to (exerciseCounts[e.id] ?: 0))
        }
        return json(mapOf("equipment" to rows))
    }

    @Post("/api/v1/equipment")
    fun create(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val name = (body["name"] as? String)?.trim() ?: return badRequest("name required")
        if (name.isEmpty()) return badRequest("Name cannot be empty")

        if (Equipment.findAll().any { it.trainer_id == user.id && it.name.equals(name, ignoreCase = true) }) {
            return badRequest("You already have equipment named \"$name\"")
        }

        val item = Equipment(trainer_id = user.id!!, name = name, created_at = LocalDateTime.now())
        item.save()
        return json(mapOf("ok" to true, "id" to item.id))
    }

    @Post("/api/v1/equipment/{equipmentId}")
    fun update(ctx: ServiceRequestContext, @Param("equipmentId") equipmentId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val item = Equipment.findById(equipmentId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (item.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val name = (body["name"] as? String)?.trim() ?: return badRequest("name required")
        if (name.isEmpty()) return badRequest("Name cannot be empty")
        if (Equipment.findAll().any { it.trainer_id == user.id && it.name.equals(name, ignoreCase = true) && it.id != equipmentId }) {
            return badRequest("You already have equipment named \"$name\"")
        }
        item.name = name
        item.save()
        return json(mapOf("ok" to true))
    }

    @Delete("/api/v1/equipment/{equipmentId}")
    fun delete(ctx: ServiceRequestContext, @Param("equipmentId") equipmentId: Long): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val item = Equipment.findById(equipmentId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (item.trainer_id != user.id) return HttpResponse.of(HttpStatus.FORBIDDEN)

        // Block deletion if equipment is used by any exercise
        val usedByExercises = ExerciseEquipment.findAll().any { it.equipment_id == equipmentId }
        if (usedByExercises) return badRequest("Cannot delete equipment that is used by an exercise")

        item.delete()
        return json(mapOf("ok" to true))
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

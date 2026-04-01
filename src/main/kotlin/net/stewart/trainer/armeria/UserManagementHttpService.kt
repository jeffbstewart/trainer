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
import net.stewart.auth.PasswordService
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.ServiceRegistry
import net.stewart.trainer.service.TempPasswordGenerator
import net.stewart.trainer.service.UsernameValidator
import java.time.LocalDateTime

@Blocking
class UserManagementHttpService {

    private val gson = Gson()

    /** List users visible to the current user based on role. */
    @Get("/api/v1/users")
    fun listUsers(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireTrainer(ctx)
        if (user == null) return err!!

        val allUsers = AppUser.findAll()
        val visible = when {
            user.isAdmin() -> allUsers
            user.isManager() -> allUsers.filter { it.access_level < 4 } // managers see everyone except admins
            user.isTrainer() -> allUsers.filter { it.trainer_id == user.id } // trainers see only their trainees
            else -> emptyList()
        }

        val rows = visible.sortedBy { it.username.lowercase() }.map { u ->
            mapOf(
                "id" to u.id,
                "username" to u.username,
                "access_level" to u.access_level,
                "role" to roleName(u.access_level),
                "trainer_id" to u.trainer_id,
                "locked" to u.locked,
                "must_change_password" to u.must_change_password,
                "created_at" to u.created_at?.toString()
            )
        }
        return json(mapOf("users" to rows))
    }

    /** Create a new user. Role-gated: trainers create trainees, managers create trainers, admins create anyone. */
    @Post("/api/v1/users")
    fun createUser(ctx: ServiceRequestContext): HttpResponse {
        val (creator, err) = AuthDecorator.requireTrainer(ctx)
        if (creator == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val username = (body["username"] as? String)?.trim() ?: return badRequest("username required")
        val accessLevel = (body["access_level"] as? Number)?.toInt() ?: 1

        UsernameValidator.validate(username)?.let { return badRequest(it) }

        // Role enforcement: admins can create anyone (including other admins),
        // others can only create below their own level
        if (!creator.isAdmin() && accessLevel >= creator.access_level) {
            return json(mapOf("error" to "Cannot create a user at or above your own access level"), HttpStatus.FORBIDDEN)
        }
        if (!creator.isManager() && accessLevel >= 2) {
            return json(mapOf("error" to "Only managers and admins can create trainer accounts"), HttpStatus.FORBIDDEN)
        }

        // Check uniqueness
        if (AppUser.findAll().any { it.username.equals(username, ignoreCase = true) }) {
            return badRequest("Username already exists")
        }

        val tempPassword = TempPasswordGenerator.generate()
        val now = LocalDateTime.now()
        val newUser = AppUser(
            username = username,
            password_hash = PasswordService.hash(tempPassword),
            access_level = accessLevel,
            must_change_password = true,
            trainer_id = if (accessLevel == 1) creator.id else null, // trainees assigned to creating trainer
            created_by = creator.id,
            created_at = now,
            updated_at = now
        )
        newUser.save()

        return json(mapOf(
            "ok" to true,
            "id" to newUser.id,
            "username" to username,
            "temporary_password" to tempPassword
        ))
    }

    /** Reset a user's password. Returns the temporary password. */
    @Post("/api/v1/users/{userId}/reset-password")
    fun resetPassword(ctx: ServiceRequestContext, @Param("userId") userId: Long): HttpResponse {
        val (actor, err) = AuthDecorator.requireTrainer(ctx)
        if (actor == null) return err!!

        val target = AppUser.findById(userId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (!canManageUser(actor, target)) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val tempPassword = TempPasswordGenerator.generate()
        target.password_hash = PasswordService.hash(tempPassword)
        target.must_change_password = true
        target.updated_at = LocalDateTime.now()
        target.save()

        ServiceRegistry.sessions.revokeAllForUser(userId)

        return json(mapOf("ok" to true, "temporary_password" to tempPassword))
    }

    /** Reassign a trainee to a different trainer. Manager+ only. */
    @Post("/api/v1/users/{userId}/reassign")
    fun reassign(ctx: ServiceRequestContext, @Param("userId") userId: Long): HttpResponse {
        val (actor, err) = AuthDecorator.requireManager(ctx)
        if (actor == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val newTrainerId = (body["trainer_id"] as? Number)?.toLong() ?: return badRequest("trainer_id required")

        val trainee = AppUser.findById(userId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (trainee.access_level != 1) return badRequest("Only trainees can be reassigned")

        val newTrainer = AppUser.findById(newTrainerId)
        if (newTrainer == null || !newTrainer.isTrainer()) return badRequest("Target must be a trainer")

        trainee.trainer_id = newTrainerId
        trainee.updated_at = LocalDateTime.now()
        trainee.save()

        return json(mapOf("ok" to true))
    }

    /** Delete a user account. */
    @Delete("/api/v1/users/{userId}")
    fun deleteUser(ctx: ServiceRequestContext, @Param("userId") userId: Long): HttpResponse {
        val (actor, err) = AuthDecorator.requireTrainer(ctx)
        if (actor == null) return err!!

        val target = AppUser.findById(userId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (!canManageUser(actor, target)) return HttpResponse.of(HttpStatus.FORBIDDEN)
        if (target.id == actor.id) return badRequest("Cannot delete your own account")

        // Guard: cannot delete last admin
        if (target.isAdmin()) {
            val adminCount = AppUser.findAll().count { it.isAdmin() }
            if (adminCount <= 1) return badRequest("Cannot delete the last admin account")
        }

        // Guard: trainer with active trainees
        if (target.isTrainer()) {
            val traineeCount = AppUser.findAll().count { it.trainer_id == target.id }
            if (traineeCount > 0) return badRequest("Reassign ${traineeCount} trainee(s) before deleting this trainer")
        }

        ServiceRegistry.sessions.revokeAllForUser(userId)
        target.delete()

        return json(mapOf("ok" to true))
    }

    /** List sessions for a user. */
    @Get("/api/v1/users/{userId}/sessions")
    fun listSessions(ctx: ServiceRequestContext, @Param("userId") userId: Long): HttpResponse {
        val (actor, err) = AuthDecorator.requireTrainer(ctx)
        if (actor == null) return err!!

        val target = AppUser.findById(userId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (actor.id != userId && !canManageUser(actor, target)) return HttpResponse.of(HttpStatus.FORBIDDEN)

        val sessions = com.gitlab.mvysny.jdbiorm.JdbiOrm.jdbi().withHandle<List<Map<String, Any?>>, Exception> { handle ->
            handle.createQuery("SELECT id, user_agent, created_at, expires_at, last_used_at FROM session_token WHERE user_id = :uid ORDER BY last_used_at DESC")
                .bind("uid", userId)
                .map { rs, _ ->
                    mapOf(
                        "id" to rs.getLong("id"),
                        "user_agent" to rs.getString("user_agent"),
                        "created_at" to rs.getTimestamp("created_at")?.toString(),
                        "expires_at" to rs.getTimestamp("expires_at")?.toString(),
                        "last_used_at" to rs.getTimestamp("last_used_at")?.toString()
                    )
                }.list()
        }

        return json(mapOf("sessions" to sessions))
    }

    /** Revoke a specific session for a user. */
    @Delete("/api/v1/users/{userId}/sessions/{sessionId}")
    fun revokeSession(ctx: ServiceRequestContext, @Param("userId") userId: Long, @Param("sessionId") sessionId: Long): HttpResponse {
        val (actor, err) = AuthDecorator.requireTrainer(ctx)
        if (actor == null) return err!!

        val target = AppUser.findById(userId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (actor.id != userId && !canManageUser(actor, target)) return HttpResponse.of(HttpStatus.FORBIDDEN)

        com.gitlab.mvysny.jdbiorm.JdbiOrm.jdbi().withHandle<Int, Exception> { handle ->
            handle.createUpdate("DELETE FROM session_token WHERE id = :id AND user_id = :uid")
                .bind("id", sessionId).bind("uid", userId).execute()
        }

        return json(mapOf("ok" to true))
    }

    /** Revoke all sessions for a user. */
    @Post("/api/v1/users/{userId}/sessions/revoke-all")
    fun revokeAllSessions(ctx: ServiceRequestContext, @Param("userId") userId: Long): HttpResponse {
        val (actor, err) = AuthDecorator.requireTrainer(ctx)
        if (actor == null) return err!!

        val target = AppUser.findById(userId) ?: return HttpResponse.of(HttpStatus.NOT_FOUND)
        if (actor.id != userId && !canManageUser(actor, target)) return HttpResponse.of(HttpStatus.FORBIDDEN)

        ServiceRegistry.sessions.revokeAllForUser(userId)

        return json(mapOf("ok" to true))
    }

    /** Can this actor manage (reset password, view sessions, delete) the target user? */
    private fun canManageUser(actor: AppUser, target: AppUser): Boolean {
        if (actor.isAdmin()) return true
        if (actor.isManager() && target.access_level < actor.access_level) return true
        if (actor.isTrainer() && target.trainer_id == actor.id) return true
        return false
    }

    private fun roleName(level: Int): String = when (level) {
        1 -> "Trainee"
        2 -> "Trainer"
        3 -> "Manager"
        4 -> "Admin"
        else -> "Unknown"
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

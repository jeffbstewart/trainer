package net.stewart.trainer.armeria

import com.gitlab.mvysny.jdbiorm.JdbiOrm
import com.google.gson.Gson
import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.ServiceRequestContext
import com.linecorp.armeria.server.annotation.Blocking
import com.linecorp.armeria.server.annotation.Param
import com.linecorp.armeria.server.annotation.Post
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.ServiceRegistry
import org.slf4j.LoggerFactory
import java.time.LocalDateTime

/**
 * Admin impersonation via dual-cookie pattern.
 *
 * Start: admin's original session stays in `trainer_session` cookie.
 * A second cookie `trainer_impersonation` is set with a new session for the target user.
 * The AuthDecorator checks `trainer_impersonation` first.
 *
 * End: clears the impersonation cookie. Admin's original session resumes.
 */
@Blocking
class ImpersonationHttpService {

    private val log = LoggerFactory.getLogger(ImpersonationHttpService::class.java)
    private val gson = Gson()

    companion object {
        const val IMPERSONATION_COOKIE = "trainer_impersonation"
    }

    /** Start impersonating a user. Admin only. */
    @Post("/api/v1/auth/impersonate/{userId}")
    fun startImpersonation(ctx: ServiceRequestContext, @Param("userId") userId: Long): HttpResponse {
        val (admin, err) = AuthDecorator.requireAdmin(ctx)
        if (admin == null) return err!!

        val target = AppUser.findById(userId)
            ?: return HttpResponse.of(HttpStatus.NOT_FOUND)

        if (target.id == admin.id) {
            return json(mapOf("error" to "Cannot impersonate yourself"), HttpStatus.BAD_REQUEST)
        }

        // Create a session for the target user
        val ua = "Impersonation by ${admin.username}"
        val token = ServiceRegistry.sessions.createSession(target.toAuthUser(), ua)
        val secure = ctx.request().scheme() == "https"

        // Record in audit log
        JdbiOrm.jdbi().withHandle<Int, Exception> { handle ->
            handle.createUpdate(
                "INSERT INTO impersonation_log (admin_id, impersonated_id, started_at) VALUES (:aid, :iid, :now)"
            ).bind("aid", admin.id).bind("iid", userId).bind("now", LocalDateTime.now()).execute()
        }

        log.info("AUDIT: Admin '{}' (id={}) started impersonating '{}' (id={})",
            admin.username, admin.id, target.username, target.id)

        val maxAge = (ServiceRegistry.sessions.sessionDays * 24 * 60 * 60).toInt()
        val cookie = buildString {
            append("$IMPERSONATION_COOKIE=$token; Path=/; Max-Age=$maxAge; HttpOnly; SameSite=Lax")
            if (secure) append("; Secure")
        }

        return HttpResponse.builder()
            .status(HttpStatus.OK)
            .content(MediaType.JSON_UTF_8, gson.toJson(mapOf(
                "ok" to true,
                "impersonating" to target.username
            )))
            .header("Set-Cookie", cookie)
            .build()
    }

    /** End impersonation. Clears the impersonation cookie. */
    @Post("/api/v1/auth/end-impersonate")
    fun endImpersonation(ctx: ServiceRequestContext): HttpResponse {
        // Revoke the impersonation session
        val cookieHeader = ctx.request().headers().get("cookie") ?: ""
        val impToken = cookieHeader.split(";")
            .map { it.trim() }
            .firstOrNull { it.startsWith("$IMPERSONATION_COOKIE=") }
            ?.substringAfter("=")

        if (impToken != null) {
            val impUser = ServiceRegistry.sessions.revokeByToken(impToken)

            // Find and close the audit log entry
            val adminUser = AuthDecorator.getUser(ctx)
            if (adminUser != null && impUser != null) {
                JdbiOrm.jdbi().withHandle<Int, Exception> { handle ->
                    handle.createUpdate(
                        """UPDATE impersonation_log SET ended_at = :now
                           WHERE admin_id = :aid AND impersonated_id = :iid AND ended_at IS NULL"""
                    ).bind("now", LocalDateTime.now())
                        .bind("aid", adminUser.id)
                        .bind("iid", impUser.id)
                        .execute()
                }
                log.info("AUDIT: Admin '{}' ended impersonation of user id={}",
                    adminUser.username, impUser.id)
            }
        }

        // Clear the impersonation cookie
        val expireCookie = "$IMPERSONATION_COOKIE=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"

        return HttpResponse.builder()
            .status(HttpStatus.OK)
            .content(MediaType.JSON_UTF_8, """{"ok":true}""")
            .header("Set-Cookie", expireCookie)
            .build()
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))
}

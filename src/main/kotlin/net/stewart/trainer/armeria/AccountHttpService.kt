package net.stewart.trainer.armeria

import com.google.gson.Gson
import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.ServiceRequestContext
import com.linecorp.armeria.server.annotation.Blocking
import com.linecorp.armeria.server.annotation.Post
import net.stewart.auth.PasswordService
import net.stewart.trainer.service.LegalService
import net.stewart.trainer.service.ServiceRegistry
import java.time.LocalDateTime

/**
 * Endpoints that require an authenticated session but must remain accessible
 * even when must_change_password or legal compliance blocks normal API access.
 *
 * These are registered behind the AuthDecorator, which has an allowlist for
 * these paths in its must_change_password and legal compliance checks.
 */
@Blocking
class AccountHttpService {

    private val gson = Gson()

    @Post("/api/v1/auth/change-password")
    fun changePassword(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireUser(ctx)
        if (user == null) return err!!

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val currentPassword = body["current_password"] as? String ?: return badRequest("current_password required")
        val newPassword = body["new_password"] as? String ?: return badRequest("new_password required")

        if (!PasswordService.verify(currentPassword, user.password_hash)) {
            return json(mapOf("ok" to false, "error" to "Current password is incorrect"))
        }

        val violations = PasswordService.validate(newPassword, user.username, user.password_hash)
        if (violations.isNotEmpty()) {
            return json(mapOf("ok" to false, "error" to violations.first()))
        }

        user.password_hash = PasswordService.hash(newPassword)
        user.must_change_password = false
        user.updated_at = LocalDateTime.now()
        user.save()

        ServiceRegistry.sessions.revokeAllForUser(user.id!!)

        return json(mapOf("ok" to true))
    }

    @Post("/api/v1/auth/accept-legal")
    fun acceptLegal(ctx: ServiceRequestContext): HttpResponse {
        val (user, err) = AuthDecorator.requireUser(ctx)
        if (user == null) return err!!

        val now = LocalDateTime.now()
        if (LegalService.requiredPrivacyPolicyVersion > 0) {
            user.privacy_policy_version = LegalService.requiredPrivacyPolicyVersion
            user.privacy_policy_agreed_at = now
        }
        if (LegalService.requiredTermsOfUseVersion > 0) {
            user.terms_of_use_version = LegalService.requiredTermsOfUseVersion
            user.terms_of_use_agreed_at = now
        }
        user.updated_at = now
        user.save()

        return json(mapOf("ok" to true))
    }

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

package net.stewart.trainer.armeria

import com.github.vokorm.findAll
import com.google.gson.Gson
import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.ServiceRequestContext
import com.linecorp.armeria.server.annotation.Blocking
import com.linecorp.armeria.server.annotation.Get
import com.linecorp.armeria.server.annotation.Post
import net.stewart.auth.LoginResult
import net.stewart.auth.PasswordService
import net.stewart.auth.SessionService
import net.stewart.trainer.entity.AppConfig
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.ServiceRegistry
import java.time.LocalDateTime

@Blocking
class AuthHttpService {

    private val gson = Gson()

    @Get("/api/auth/discover")
    fun discover(): HttpResponse {
        val setupRequired = !ServiceRegistry.userRepository.hasUsers()
        val configs = AppConfig.findAll()
        val result = mutableMapOf<String, Any>(
            "setup_required" to setupRequired
        )
        configs.firstOrNull { it.config_key == "terms_of_use_url" }?.let { result["terms_of_use_url"] = it.config_val }
        configs.firstOrNull { it.config_key == "privacy_policy_url" }?.let { result["privacy_policy_url"] = it.config_val }
        return json(result)
    }

    @Post("/api/auth/login")
    fun login(ctx: ServiceRequestContext): HttpResponse {
        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val username = body["username"] as? String ?: return badRequest("username required")
        val password = body["password"] as? String ?: return badRequest("password required")
        val ip = ctx.remoteAddress().address?.hostAddress ?: "unknown"

        return when (val result = ServiceRegistry.loginService.login(username, password, ip)) {
            is LoginResult.Success -> {
                val authUser = result.user
                val appUser = AppUser.findById(authUser.id)!!
                val ua = ctx.request().headers().get("user-agent") ?: "unknown"
                val token = ServiceRegistry.sessions.createSession(authUser, ua)
                val secure = ctx.request().scheme() == "https"

                val response = mutableMapOf<String, Any?>(
                    "ok" to true,
                    "password_change_required" to appUser.must_change_password
                )

                HttpResponse.builder()
                    .status(HttpStatus.OK)
                    .content(MediaType.JSON_UTF_8, gson.toJson(response))
                    .header("Set-Cookie", ServiceRegistry.sessions.buildCookieHeader(token, secure))
                    .build()
            }
            is LoginResult.RateLimited ->
                json(mapOf("error" to "Too many attempts", "retry_after" to result.retryAfterSeconds), HttpStatus.TOO_MANY_REQUESTS)
            is LoginResult.Failed ->
                json(mapOf("error" to "Invalid credentials"), HttpStatus.UNAUTHORIZED)
        }
    }

    @Post("/api/auth/setup")
    fun setup(ctx: ServiceRequestContext): HttpResponse {
        if (ServiceRegistry.userRepository.hasUsers()) {
            return json(mapOf("error" to "Setup already completed"), HttpStatus.FORBIDDEN)
        }

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val username = (body["username"] as? String)?.trim() ?: return badRequest("username required")
        val password = body["password"] as? String ?: return badRequest("password required")

        val violations = PasswordService.validate(password, username)
        if (violations.isNotEmpty()) return badRequest(violations.first())

        val now = LocalDateTime.now()
        val user = AppUser(
            username = username,
            password_hash = PasswordService.hash(password),
            access_level = 4, // first user is admin
            created_at = now,
            updated_at = now
        )
        user.save()

        // Store legal document URLs in app_config (only https:// and about:blank allowed)
        val termsUrl = (body["terms_of_use_url"] as? String)?.trim()
        val privacyUrl = (body["privacy_policy_url"] as? String)?.trim()
        if (!termsUrl.isNullOrBlank()) {
            if (!isValidLegalUrl(termsUrl)) return badRequest("Terms URL must be https:// or about:blank")
            AppConfig(config_key = "terms_of_use_url", config_val = termsUrl).save()
        }
        if (!privacyUrl.isNullOrBlank()) {
            if (!isValidLegalUrl(privacyUrl)) return badRequest("Privacy URL must be https:// or about:blank")
            AppConfig(config_key = "privacy_policy_url", config_val = privacyUrl).save()
        }

        val ua = ctx.request().headers().get("user-agent") ?: "unknown"
        val token = ServiceRegistry.sessions.createSession(user.toAuthUser(), ua)
        val secure = ctx.request().scheme() == "https"

        return HttpResponse.builder()
            .status(HttpStatus.OK)
            .content(MediaType.JSON_UTF_8, gson.toJson(mapOf("ok" to true)))
            .header("Set-Cookie", ServiceRegistry.sessions.buildCookieHeader(token, secure))
            .build()
    }

    @Post("/api/auth/logout")
    fun logout(ctx: ServiceRequestContext): HttpResponse {
        val cookieHeader = ctx.request().headers().get("cookie") ?: ""
        val token = cookieHeader.split(";")
            .map { it.trim() }
            .firstOrNull { it.startsWith("${ServiceRegistry.sessions.cookieName}=") }
            ?.substringAfter("=")

        if (token != null) {
            ServiceRegistry.sessions.revokeByToken(token)
        }

        return HttpResponse.builder()
            .status(HttpStatus.OK)
            .content(MediaType.JSON_UTF_8, """{"ok":true}""")
            .header("Set-Cookie", ServiceRegistry.sessions.buildExpireCookieHeader())
            .build()
    }

    @Post("/api/auth/change-password")
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

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun isValidLegalUrl(url: String): Boolean =
        url == "about:blank" || url.startsWith("https://")

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

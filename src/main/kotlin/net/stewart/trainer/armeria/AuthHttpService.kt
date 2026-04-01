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
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.ServiceRegistry
import java.time.LocalDateTime

@Blocking
class AuthHttpService {

    private val gson = Gson()

    @Get("/api/auth/discover")
    fun discover(): HttpResponse {
        val setupRequired = !ServiceRegistry.userRepository.hasUsers()
        return json(mapOf("setup_required" to setupRequired))
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
            access_level = 2, // first user is admin
            created_at = now,
            updated_at = now
        )
        user.save()

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

    private fun json(data: Any, status: HttpStatus = HttpStatus.OK): HttpResponse =
        HttpResponse.of(status, MediaType.JSON_UTF_8, gson.toJson(data))

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

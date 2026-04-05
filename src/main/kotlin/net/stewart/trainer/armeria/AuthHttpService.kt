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
import net.stewart.auth.WebAuthnAuthResult
import net.stewart.trainer.entity.AppConfig
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.LegalService
import net.stewart.trainer.service.ServiceRegistry
import net.stewart.trainer.service.UsernameValidator
import java.time.LocalDateTime

@Blocking
class AuthHttpService {

    private val gson = Gson()

    @Get("/api/v1/auth/discover")
    fun discover(): HttpResponse {
        val setupRequired = !ServiceRegistry.userRepository.hasUsers()
        val result = mutableMapOf<String, Any>(
            "setup_required" to setupRequired
        )
        if (LegalService.termsOfUseUrl != null) result["terms_of_use_url"] = LegalService.termsOfUseUrl!!
        if (LegalService.privacyPolicyUrl != null) result["privacy_policy_url"] = LegalService.privacyPolicyUrl!!
        if (LegalService.requiredTermsOfUseVersion > 0) result["terms_of_use_version"] = LegalService.requiredTermsOfUseVersion
        if (LegalService.requiredPrivacyPolicyVersion > 0) result["privacy_policy_version"] = LegalService.requiredPrivacyPolicyVersion
        val wa = ServiceRegistry.webAuthnService
        if (wa != null) result["passkeys_available"] = wa.anyPasskeysExist()
        return json(result)
    }

    @Post("/api/v1/auth/login")
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
                    "password_change_required" to appUser.must_change_password,
                    "legal_acceptance_required" to !LegalService.isCompliant(appUser)
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

    @Post("/api/v1/auth/setup")
    fun setup(ctx: ServiceRequestContext): HttpResponse {
        if (ServiceRegistry.userRepository.hasUsers()) {
            return json(mapOf("error" to "Setup already completed"), HttpStatus.FORBIDDEN)
        }

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val username = (body["username"] as? String)?.trim() ?: return badRequest("username required")
        val password = body["password"] as? String ?: return badRequest("password required")

        UsernameValidator.validate(username)?.let { return badRequest(it) }

        val violations = PasswordService.validate(password, username)
        if (violations.isNotEmpty()) return badRequest(violations.first())

        val now = LocalDateTime.now()
        val user = AppUser(
            username = username,
            password_hash = PasswordService.hash(password),
            access_level = net.stewart.trainer.entity.Role.ADMIN,
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
            AppConfig(config_key = "terms_of_use_version", config_val = "1").save()
        }
        if (!privacyUrl.isNullOrBlank()) {
            if (!isValidLegalUrl(privacyUrl)) return badRequest("Privacy URL must be https:// or about:blank")
            AppConfig(config_key = "privacy_policy_url", config_val = privacyUrl).save()
            AppConfig(config_key = "privacy_policy_version", config_val = "1").save()
        }
        LegalService.refresh()

        val ua = ctx.request().headers().get("user-agent") ?: "unknown"
        val token = ServiceRegistry.sessions.createSession(user.toAuthUser(), ua)
        val secure = ctx.request().scheme() == "https"

        return HttpResponse.builder()
            .status(HttpStatus.OK)
            .content(MediaType.JSON_UTF_8, gson.toJson(mapOf("ok" to true)))
            .header("Set-Cookie", ServiceRegistry.sessions.buildCookieHeader(token, secure))
            .build()
    }

    // --- Passkey authentication ---

    @Post("/api/v1/auth/passkey/authentication-options")
    fun passkeyAuthenticationOptions(): HttpResponse {
        val wa = ServiceRegistry.webAuthnService
            ?: return json(mapOf("error" to "Passkeys not configured"), HttpStatus.SERVICE_UNAVAILABLE)
        val opts = wa.generateAuthenticationOptions()
        return json(mapOf("challenge" to opts.signedChallenge, "options" to opts.optionsJson))
    }

    @Post("/api/v1/auth/passkey/authenticate")
    fun passkeyAuthenticate(ctx: ServiceRequestContext): HttpResponse {
        val wa = ServiceRegistry.webAuthnService
            ?: return json(mapOf("error" to "Passkeys not configured"), HttpStatus.SERVICE_UNAVAILABLE)

        val body = gson.fromJson(ctx.request().aggregate().join().contentUtf8(), Map::class.java)
        val challenge = body["challenge"] as? String ?: return badRequest("challenge required")
        @Suppress("UNCHECKED_CAST")
        val credential = body["credential"] as? Map<String, Any> ?: return badRequest("credential required")
        @Suppress("UNCHECKED_CAST")
        val response = credential["response"] as? Map<String, Any> ?: return badRequest("credential.response required")

        val result = wa.verifyAuthentication(
            signedChallenge = challenge,
            credentialId = credential["id"] as? String ?: return badRequest("credential.id required"),
            clientDataJSON = response["clientDataJSON"] as? String ?: return badRequest("clientDataJSON required"),
            authenticatorData = response["authenticatorData"] as? String ?: return badRequest("authenticatorData required"),
            signature = response["signature"] as? String ?: return badRequest("signature required"),
            userHandle = response["userHandle"] as? String,
        )

        return when (result) {
            is WebAuthnAuthResult.Success -> {
                val appUser = AppUser.findById(result.user.id)!!
                val ua = ctx.request().headers().get("user-agent") ?: "unknown"
                val token = ServiceRegistry.sessions.createSession(result.user, ua)
                val secure = ctx.request().scheme() == "https"

                HttpResponse.builder()
                    .status(HttpStatus.OK)
                    .content(MediaType.JSON_UTF_8, gson.toJson(mapOf(
                        "ok" to true,
                        "password_change_required" to appUser.must_change_password,
                        "legal_acceptance_required" to !LegalService.isCompliant(appUser),
                    )))
                    .header("Set-Cookie", ServiceRegistry.sessions.buildCookieHeader(token, secure))
                    .build()
            }
            is WebAuthnAuthResult.Failed ->
                json(mapOf("error" to "Passkey authentication failed"), HttpStatus.UNAUTHORIZED)
        }
    }

    @Post("/api/v1/auth/logout")
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

    private fun isValidLegalUrl(url: String): Boolean =
        url == "about:blank" || url.startsWith("https://")

    private fun badRequest(msg: String): HttpResponse =
        json(mapOf("error" to msg), HttpStatus.BAD_REQUEST)
}

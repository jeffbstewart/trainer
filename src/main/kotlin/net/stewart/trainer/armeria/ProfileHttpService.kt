package net.stewart.trainer.armeria

import com.google.gson.Gson
import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.ServiceRequestContext
import com.linecorp.armeria.server.annotation.Blocking
import com.linecorp.armeria.server.annotation.Get
import net.stewart.trainer.service.ServiceRegistry

@Blocking
class ProfileHttpService {

    private val gson = Gson()

    @Get("/api/v1/profile")
    fun profile(ctx: ServiceRequestContext): HttpResponse {
        val user = AuthDecorator.getUser(ctx) ?: return HttpResponse.of(HttpStatus.UNAUTHORIZED)
        val realAdmin = AuthDecorator.getRealAdmin(ctx)
        val profile = mutableMapOf<String, Any?>(
            "id" to user.id,
            "username" to user.username,
            "access_level" to user.access_level,
            "role" to when {
                user.isAdmin() -> "Admin"
                user.isManager() -> "Manager"
                user.isTrainer() -> "Trainer"
                else -> "Trainee"
            },
            "is_impersonating" to (realAdmin != null),
            "passkeys_enabled" to (ServiceRegistry.webAuthnService != null),
        )
        if (realAdmin != null) {
            profile["real_admin_username"] = realAdmin.username
        }
        return HttpResponse.of(HttpStatus.OK, MediaType.JSON_UTF_8, gson.toJson(profile))
    }
}

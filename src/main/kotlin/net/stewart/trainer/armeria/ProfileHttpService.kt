package net.stewart.trainer.armeria

import com.google.gson.Gson
import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.common.MediaType
import com.linecorp.armeria.server.ServiceRequestContext
import com.linecorp.armeria.server.annotation.Blocking
import com.linecorp.armeria.server.annotation.Get

@Blocking
class ProfileHttpService {

    private val gson = Gson()

    @Get("/api/profile")
    fun profile(ctx: ServiceRequestContext): HttpResponse {
        val user = AuthDecorator.getUser(ctx) ?: return HttpResponse.of(HttpStatus.UNAUTHORIZED)
        val profile = mapOf(
            "id" to user.id,
            "username" to user.username,
            "is_admin" to user.isAdmin()
        )
        return HttpResponse.of(HttpStatus.OK, MediaType.JSON_UTF_8, gson.toJson(profile))
    }
}

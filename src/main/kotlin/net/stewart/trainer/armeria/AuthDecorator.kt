package net.stewart.trainer.armeria

import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.server.DecoratingHttpServiceFunction
import com.linecorp.armeria.server.HttpService
import com.linecorp.armeria.server.ServiceRequestContext
import net.stewart.auth.SessionService
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.ServiceRegistry

/**
 * Armeria decorator that validates session cookies on every request.
 * Sets the authenticated user on the request context for downstream services.
 */
class AuthDecorator : DecoratingHttpServiceFunction {

    companion object {
        private val USER_ATTR = io.netty.util.AttributeKey.valueOf<AppUser>("auth.user")

        fun getUser(ctx: ServiceRequestContext): AppUser? =
            ctx.attr(USER_ATTR)
    }

    override fun serve(delegate: HttpService, ctx: ServiceRequestContext, req: com.linecorp.armeria.common.HttpRequest): HttpResponse {
        val sessions = ServiceRegistry.sessions

        // Try cookie auth
        val cookieHeader = req.headers().get("cookie") ?: ""
        val token = cookieHeader.split(";")
            .map { it.trim() }
            .firstOrNull { it.startsWith("${sessions.cookieName}=") }
            ?.substringAfter("=")

        val authUser = token?.let { sessions.validateToken(it) }
        val user = authUser?.let { AppUser.findById(it.id) }
        if (user != null) {
            ctx.setAttr(USER_ATTR, user)
            return delegate.serve(ctx, req)
        }

        // No users yet → allow through (first-user setup)
        if (!ServiceRegistry.userRepository.hasUsers()) {
            return delegate.serve(ctx, req)
        }

        return HttpResponse.of(HttpStatus.UNAUTHORIZED)
    }
}

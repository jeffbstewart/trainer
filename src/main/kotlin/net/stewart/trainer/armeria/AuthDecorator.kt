package net.stewart.trainer.armeria

import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.server.DecoratingHttpServiceFunction
import com.linecorp.armeria.server.HttpService
import com.linecorp.armeria.server.ServiceRequestContext
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.ServiceRegistry

/**
 * Armeria decorator that validates session cookies on every request.
 * Sets the authenticated user on the request context for downstream services.
 *
 * Role-checking utilities:
 * - [getUser] — returns the authenticated user or null
 * - [requireUser] — returns user or 401
 * - [requireTrainer] — returns user if trainer+ or 403
 * - [requireManager] — returns user if manager+ or 403
 * - [requireAdmin] — returns user if admin or 403
 */
class AuthDecorator : DecoratingHttpServiceFunction {

    companion object {
        private val USER_ATTR = io.netty.util.AttributeKey.valueOf<AppUser>("auth.user")

        /** Returns the authenticated user, or null if not authenticated. */
        fun getUser(ctx: ServiceRequestContext): AppUser? =
            ctx.attr(USER_ATTR)

        /** Returns the authenticated user, or an UNAUTHORIZED response. */
        fun requireUser(ctx: ServiceRequestContext): Pair<AppUser?, HttpResponse?> {
            val user = getUser(ctx) ?: return null to HttpResponse.of(HttpStatus.UNAUTHORIZED)
            return user to null
        }

        /** Returns the user if they are a trainer or higher, or a FORBIDDEN response. */
        fun requireTrainer(ctx: ServiceRequestContext): Pair<AppUser?, HttpResponse?> {
            val user = getUser(ctx) ?: return null to HttpResponse.of(HttpStatus.UNAUTHORIZED)
            if (!user.isTrainer()) return null to HttpResponse.of(HttpStatus.FORBIDDEN)
            return user to null
        }

        /** Returns the user if they are a manager or higher, or a FORBIDDEN response. */
        fun requireManager(ctx: ServiceRequestContext): Pair<AppUser?, HttpResponse?> {
            val user = getUser(ctx) ?: return null to HttpResponse.of(HttpStatus.UNAUTHORIZED)
            if (!user.isManager()) return null to HttpResponse.of(HttpStatus.FORBIDDEN)
            return user to null
        }

        /** Returns the user if they are an admin, or a FORBIDDEN response. */
        fun requireAdmin(ctx: ServiceRequestContext): Pair<AppUser?, HttpResponse?> {
            val user = getUser(ctx) ?: return null to HttpResponse.of(HttpStatus.UNAUTHORIZED)
            if (!user.isAdmin()) return null to HttpResponse.of(HttpStatus.FORBIDDEN)
            return user to null
        }
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
            // Block users who must change password (except password-change endpoint)
            if (user.must_change_password) {
                val path = ctx.path()
                if (path != "/api/auth/change-password" && path != "/api/auth/logout") {
                    return HttpResponse.of(HttpStatus.FORBIDDEN)
                }
            }
            // CSRF: require X-Requested-With header on state-changing methods.
            // Browsers don't send custom headers on cross-origin form POSTs.
            val method = req.method().name
            if (method in setOf("POST", "PUT", "DELETE", "PATCH")) {
                if (req.headers().get("x-requested-with") == null) {
                    return HttpResponse.of(HttpStatus.FORBIDDEN)
                }
            }

            ctx.setAttr(USER_ATTR, user)
            return delegate.serve(ctx, req)
        }

        // No users yet — allow through (first-user setup)
        if (!ServiceRegistry.userRepository.hasUsers()) {
            return delegate.serve(ctx, req)
        }

        return HttpResponse.of(HttpStatus.UNAUTHORIZED)
    }
}

package net.stewart.trainer.armeria

import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.server.DecoratingHttpServiceFunction
import com.linecorp.armeria.server.HttpService
import com.linecorp.armeria.server.ServiceRequestContext
import net.stewart.trainer.entity.AppUser
import net.stewart.trainer.service.LegalService
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
        private val REAL_ADMIN_ATTR = io.netty.util.AttributeKey.valueOf<AppUser>("auth.real_admin")

        /** Returns the effective user (impersonated user if active, otherwise the real user). */
        fun getUser(ctx: ServiceRequestContext): AppUser? =
            ctx.attr(USER_ATTR)

        /** Returns the real admin behind an impersonation, or null if not impersonating. */
        fun getRealAdmin(ctx: ServiceRequestContext): AppUser? =
            ctx.attr(REAL_ADMIN_ATTR)

        /** Returns true if the current request is under impersonation. */
        fun isImpersonating(ctx: ServiceRequestContext): Boolean =
            ctx.attr(REAL_ADMIN_ATTR) != null

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
        val cookieHeader = req.headers().get("cookie") ?: ""

        fun extractCookie(name: String): String? =
            cookieHeader.split(";").map { it.trim() }
                .firstOrNull { it.startsWith("$name=") }?.substringAfter("=")

        // Check impersonation cookie first (dual-cookie pattern)
        val impToken = extractCookie(ImpersonationHttpService.IMPERSONATION_COOKIE)
        val mainToken = extractCookie(sessions.cookieName)

        if (impToken != null && mainToken != null) {
            val impUser = impToken.let { sessions.validateToken(it) }?.let { AppUser.findById(it.id) }
            val realAdmin = mainToken.let { sessions.validateToken(it) }?.let { AppUser.findById(it.id) }
            if (impUser != null && realAdmin != null && realAdmin.isAdmin()) {
                ctx.setAttr(USER_ATTR, impUser)
                ctx.setAttr(REAL_ADMIN_ATTR, realAdmin)
                return delegate.serve(ctx, req)
            }
        }

        // Normal auth
        val token = mainToken

        val authUser = token?.let { sessions.validateToken(it) }
        val user = authUser?.let { AppUser.findById(it.id) }
        if (user != null) {
            val path = ctx.path()
            val allowedPaths = setOf(
                "/api/v1/auth/change-password", "/api/v1/auth/logout", "/api/v1/auth/accept-legal",
            )
            fun isAllowed(p: String) = p in allowedPaths || p.startsWith("/api/v1/auth/passkeys")

            // Password change required — block everything except password change and logout
            if (user.must_change_password && !isAllowed(path)) {
                return HttpResponse.of(HttpStatus.FORBIDDEN)
            }

            // Legal compliance — block everything except legal acceptance, password change, and logout
            if (!user.must_change_password && !LegalService.isCompliant(user) && !isAllowed(path)) {
                return HttpResponse.of(HttpStatus.FORBIDDEN)
            }

            // CSRF: require X-Requested-With header on state-changing methods
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

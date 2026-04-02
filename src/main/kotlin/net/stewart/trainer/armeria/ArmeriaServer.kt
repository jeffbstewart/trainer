package net.stewart.trainer.armeria

import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.common.HttpStatus
import com.linecorp.armeria.server.DecoratingHttpServiceFunction
import com.linecorp.armeria.server.Server
import com.linecorp.armeria.server.file.FileService
import com.linecorp.armeria.server.file.HttpFile
import org.slf4j.LoggerFactory
import java.nio.file.Path

object ArmeriaServer {

    private val log = LoggerFactory.getLogger(ArmeriaServer::class.java)
    private var server: Server? = null

    fun start(port: Int, internalPort: Int = 0) {
        val authDecorator = AuthDecorator()

        val sb = Server.builder()

        // Main port: HTTPS with self-signed certificate
        sb.https(port)
        sb.tlsSelfSigned()
        log.info("TLS: using self-signed certificate on port {}", port)

        // Health check (no auth — available on both ports)
        sb.annotatedService(HealthHttpService())

        // Auth endpoints (no decorator — own validation)
        sb.annotatedService(AuthHttpService())

        // Impersonation (behind auth — needs admin check)
        sb.annotatedService().decorator(authDecorator).build(ImpersonationHttpService())

        // Account endpoints (behind auth, but allowed through must_change_password/legal blocks)
        sb.annotatedService().decorator(authDecorator).build(AccountHttpService())

        // Authenticated API endpoints
        sb.annotatedService().decorator(authDecorator).build(ProfileHttpService())
        sb.annotatedService().decorator(authDecorator).build(TargetHttpService())
        sb.annotatedService().decorator(authDecorator).build(ExerciseHttpService())
        sb.annotatedService().decorator(authDecorator).build(EquipmentHttpService())
        sb.annotatedService().decorator(authDecorator).build(UserManagementHttpService())

        // Angular SPA at /app/
        val spaDir = Path.of("spa")
        if (spaDir.toFile().exists()) {
            val fileService = FileService.of(spaDir)
            val indexService = HttpFile.of(spaDir.resolve("index.html")).asService()

            val spaDirNormalized = spaDir.toAbsolutePath().normalize()
            sb.serviceUnder("/app/") { ctx, req ->
                val mappedPath = ctx.mappedPath().removePrefix("/")
                val file = spaDir.resolve(mappedPath).toAbsolutePath().normalize()
                if (mappedPath.isNotEmpty() && file.startsWith(spaDirNormalized) && file.toFile().isFile) {
                    fileService.serve(ctx, req)
                } else {
                    indexService.serve(ctx, req)
                }
            }
            log.info("Angular SPA enabled at /app/ from {}", spaDir.toAbsolutePath())
        }

        // Root redirect
        sb.service("/") { _, _ -> HttpResponse.ofRedirect("/app/") }

        // Internal port: plain HTTP for health checks and metrics (LAN only)
        if (internalPort > 0) {
            sb.http(internalPort)

            val internalOnly = internalOnlyDecorator(internalPort)
            sb.annotatedService().decorator(internalOnly).build(HealthHttpService())
        }

        server = sb.build()
        server!!.start().join()

        if (internalPort > 0) {
            log.info("Armeria server started: HTTPS on {}, internal HTTP on {}", port, internalPort)
        } else {
            log.info("Armeria server started: HTTPS on {}", port)
        }
    }

    fun stop() {
        server?.stop()?.join()
        log.info("Armeria server stopped")
    }

    private fun internalOnlyDecorator(allowedPort: Int) = DecoratingHttpServiceFunction { delegate, ctx, req ->
        if (ctx.localAddress().port == allowedPort) {
            delegate.serve(ctx, req)
        } else {
            HttpResponse.of(HttpStatus.NOT_FOUND)
        }
    }
}

package net.stewart.trainer.armeria

import com.linecorp.armeria.common.HttpResponse
import com.linecorp.armeria.server.Server
import com.linecorp.armeria.server.file.FileService
import com.linecorp.armeria.server.file.HttpFile
import org.slf4j.LoggerFactory
import java.nio.file.Path

object ArmeriaServer {

    private val log = LoggerFactory.getLogger(ArmeriaServer::class.java)
    private var server: Server? = null

    fun start(port: Int) {
        val authDecorator = AuthDecorator()

        val sb = Server.builder().http(port)

        // Health check (no auth)
        sb.annotatedService(HealthHttpService())

        // Auth endpoints (no decorator — own validation)
        sb.annotatedService(AuthHttpService())

        // Authenticated API endpoints
        sb.annotatedService().decorator(authDecorator).build(ProfileHttpService())

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

        server = sb.build()
        server!!.start().join()
        log.info("Armeria server started on port {}", port)
    }

    fun stop() {
        server?.stop()?.join()
        log.info("Armeria server stopped")
    }
}

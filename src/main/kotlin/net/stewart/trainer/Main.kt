package net.stewart.trainer

import com.gitlab.mvysny.jdbiorm.JdbiOrm
import net.stewart.h2toolkit.H2Config
import net.stewart.h2toolkit.H2Database
import net.stewart.trainer.armeria.ArmeriaServer
import net.stewart.trainer.service.ServiceRegistry
import org.slf4j.LoggerFactory
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

fun main(args: Array<String>) {
    val log = LoggerFactory.getLogger("net.stewart.trainer.Main")

    // Load .env file
    val envFile = File("secrets/.env")
    if (envFile.exists()) {
        var count = 0
        envFile.readLines().forEach { line ->
            val trimmed = line.trim()
            if (trimmed.isBlank() || trimmed.startsWith("#")) return@forEach
            val eqIndex = trimmed.indexOf('=')
            if (eqIndex <= 0) return@forEach
            val key = trimmed.substring(0, eqIndex).trim()
            val value = trimmed.substring(eqIndex + 1).trim()
            if (value.isNotEmpty()) { System.setProperty(key, value); count++ }
        }
        log.info("Loaded {} properties from secrets/.env", count)
    }

    val port = args.indexOf("--port").let { if (it >= 0) args.getOrNull(it + 1)?.toIntOrNull() else null } ?: 9090

    // Initialize database
    val h2Password = System.getProperty("H2_PASSWORD") ?: System.getenv("H2_PASSWORD")
        ?: throw RuntimeException("H2_PASSWORD required")
    val h2FilePassword = System.getProperty("H2_FILE_PASSWORD") ?: System.getenv("H2_FILE_PASSWORD")
        ?: throw RuntimeException("H2_FILE_PASSWORD required")

    val db = H2Database(H2Config(
        basePath = "./data/trainer",
        password = h2Password,
        filePassword = h2FilePassword,
        priorPassword = System.getProperty("H2_PRIOR_PASSWORD") ?: System.getenv("H2_PRIOR_PASSWORD") ?: "",
        poolName = "trainer",
        flywayLocations = listOf("classpath:db/migration"),
    ))
    db.init()
    JdbiOrm.setDataSource(db.dataSource)
    log.info("Database initialized")

    // Initialize services
    ServiceRegistry.init(db.dataSource)

    // Periodic cleanup
    val scheduler = Executors.newSingleThreadScheduledExecutor { r ->
        Thread(r, "maintenance").apply { isDaemon = true }
    }
    // Run cleanup immediately at startup, then every 24 hours
    val cleanupTask = Runnable {
        try {
            ServiceRegistry.sessions.cleanupExpired()
            ServiceRegistry.loginService.cleanupOldAttempts()
        } catch (e: Exception) {
            log.warn("Cleanup failed: {}", e.message)
        }
    }
    cleanupTask.run()
    scheduler.scheduleAtFixedRate(cleanupTask, 24, 24, TimeUnit.HOURS)

    // Start server
    ArmeriaServer.start(port)
    Runtime.getRuntime().addShutdownHook(Thread {
        ArmeriaServer.stop()
        db.destroy()
    })

    log.info("Trainer started on port {}", port)
    Thread.currentThread().join()
}

package net.stewart.trainer.service

import net.stewart.auth.JwtService
import net.stewart.auth.LoginService
import net.stewart.auth.SessionService
import net.stewart.auth.WebAuthnConfig
import net.stewart.auth.WebAuthnService
import org.slf4j.LoggerFactory
import javax.sql.DataSource

/**
 * Holds shared service instances initialized at startup.
 * Avoids passing services through every constructor.
 */
object ServiceRegistry {
    private val log = LoggerFactory.getLogger(ServiceRegistry::class.java)

    lateinit var sessions: SessionService
    lateinit var loginService: LoginService
    var webAuthnService: WebAuthnService? = null; private set
    val userRepository = AppUserRepository

    // JwtService is only used internally for WebAuthn challenge signing key
    private lateinit var jwtService: JwtService

    fun init(dataSource: DataSource) {
        sessions = SessionService(
            dataSource = dataSource,
            userRepository = userRepository,
            cookieName = "trainer_session",
        )
        loginService = LoginService(
            dataSource = dataSource,
            userRepository = userRepository,
        )
        jwtService = JwtService(
            dataSource = dataSource,
            userRepository = userRepository,
        )

        // WebAuthn is optional — only enabled if WEBAUTHN_RP_ID env var is set
        val rpId = System.getProperty("WEBAUTHN_RP_ID") ?: System.getenv("WEBAUTHN_RP_ID")
        if (!rpId.isNullOrBlank()) {
            val rpOrigin = System.getProperty("WEBAUTHN_RP_ORIGIN") ?: System.getenv("WEBAUTHN_RP_ORIGIN")
            val rpName = System.getProperty("WEBAUTHN_RP_NAME") ?: System.getenv("WEBAUTHN_RP_NAME") ?: "Trainer"
            webAuthnService = WebAuthnService(
                dataSource = dataSource,
                userRepository = userRepository,
                signingKeyProvider = { jwtService.signingKeyBytes() },
                config = WebAuthnConfig(rpId = rpId, rpOrigin = rpOrigin, rpName = rpName),
            )
            log.info("WebAuthn enabled: rpId={} rpOrigin={} rpName={}", rpId, rpOrigin ?: "(default)", rpName)
        } else {
            log.info("WebAuthn disabled (WEBAUTHN_RP_ID not set)")
        }
    }
}

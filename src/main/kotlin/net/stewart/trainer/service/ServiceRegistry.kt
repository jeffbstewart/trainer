package net.stewart.trainer.service

import net.stewart.auth.LoginService
import net.stewart.auth.SessionService
import javax.sql.DataSource

/**
 * Holds shared service instances initialized at startup.
 * Avoids passing services through every constructor.
 */
object ServiceRegistry {
    lateinit var sessions: SessionService
    lateinit var loginService: LoginService
    val userRepository = AppUserRepository

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
    }
}

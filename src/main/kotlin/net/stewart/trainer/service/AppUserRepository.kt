package net.stewart.trainer.service

import com.github.vokorm.findAll
import net.stewart.auth.AuthUser
import net.stewart.auth.UserRepository
import net.stewart.trainer.entity.AppUser
import java.time.LocalDateTime

object AppUserRepository : UserRepository {

    override fun findById(id: Long): AuthUser? = AppUser.findById(id)?.toAuthUser()

    override fun findByUsername(username: String): AuthUser? =
        AppUser.findAll().firstOrNull { it.username.equals(username, ignoreCase = true) }?.toAuthUser()

    override fun hasUsers(): Boolean = AppUser.findAll().any()

    override fun lockUser(id: Long) {
        val user = AppUser.findById(id) ?: return
        user.locked = true
        user.updated_at = LocalDateTime.now()
        user.save()
    }
}

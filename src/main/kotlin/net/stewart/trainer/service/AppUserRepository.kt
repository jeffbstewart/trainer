package net.stewart.trainer.service

import com.gitlab.mvysny.jdbiorm.JdbiOrm
import net.stewart.auth.AuthUser
import net.stewart.auth.UserRepository
import net.stewart.trainer.entity.AppUser
import java.time.LocalDateTime

object AppUserRepository : UserRepository {

    override fun findById(id: Long): AuthUser? = AppUser.findById(id)?.toAuthUser()

    override fun findByUsername(username: String): AuthUser? {
        val id = JdbiOrm.jdbi().withHandle<Long?, Exception> { handle ->
            handle.createQuery("SELECT id FROM app_user WHERE LOWER(username) = LOWER(:u) LIMIT 1")
                .bind("u", username)
                .mapTo(Long::class.java)
                .firstOrNull()
        }
        return id?.let { AppUser.findById(it)?.toAuthUser() }
    }

    override fun hasUsers(): Boolean {
        val count = JdbiOrm.jdbi().withHandle<Long, Exception> { handle ->
            handle.createQuery("SELECT COUNT(*) FROM app_user")
                .mapTo(Long::class.java)
                .one()
        }
        return count > 0
    }

    override fun lockUser(id: Long) {
        val user = AppUser.findById(id) ?: return
        user.locked = true
        user.updated_at = LocalDateTime.now()
        user.save()
    }
}

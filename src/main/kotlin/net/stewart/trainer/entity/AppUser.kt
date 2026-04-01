package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import net.stewart.auth.AuthUser
import java.time.LocalDateTime

@Table("app_user")
data class AppUser(
    override var id: Long? = null,
    var username: String = "",
    var password_hash: String = "",
    var access_level: Int = 1,
    var locked: Boolean = false,
    var must_change_password: Boolean = false,
    var created_at: LocalDateTime? = null,
    var updated_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<AppUser, Long>(AppUser::class.java)

    fun isAdmin(): Boolean = access_level >= 2

    fun toAuthUser(): AuthUser = object : AuthUser {
        override val id: Long get() = this@AppUser.id!!
        override val username: String get() = this@AppUser.username
        override val passwordHash: String get() = this@AppUser.password_hash
        override val isLocked: Boolean get() = this@AppUser.locked
        override val mustChangePassword: Boolean get() = this@AppUser.must_change_password
    }
}

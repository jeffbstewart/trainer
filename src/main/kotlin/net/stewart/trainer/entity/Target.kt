package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.time.LocalDateTime

@Table("target")
data class Target(
    override var id: Long? = null,
    var trainer_id: Long = 0,
    var name: String = "",
    var category: String = "MUSCLE",
    var created_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<Target, Long>(Target::class.java)
}

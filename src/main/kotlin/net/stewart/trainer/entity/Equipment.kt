package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.time.LocalDateTime

@Table("equipment")
data class Equipment(
    override var id: Long? = null,
    var trainer_id: Long = 0,
    var name: String = "",
    var created_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<Equipment, Long>(Equipment::class.java)
}

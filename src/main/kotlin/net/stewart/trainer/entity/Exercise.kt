package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.time.LocalDateTime

@Table("exercise")
data class Exercise(
    override var id: Long? = null,
    var trainer_id: Long = 0,
    var name: String = "",
    var description: String? = null,
    var form_notes: String? = null,
    var difficulty: String = "INTERMEDIATE",
    var created_at: LocalDateTime? = null,
    var updated_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<Exercise, Long>(Exercise::class.java)
}

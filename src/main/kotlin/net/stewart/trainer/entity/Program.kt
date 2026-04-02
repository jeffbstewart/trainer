package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.time.LocalDate
import java.time.LocalDateTime

@Table("program")
data class Program(
    override var id: Long? = null,
    var trainee_id: Long = 0,
    var trainer_id: Long = 0,
    var name: String = "",
    var sequence: String? = null,
    var started_at: LocalDate? = null,
    var ended_at: LocalDate? = null,
    var created_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<Program, Long>(Program::class.java)
}

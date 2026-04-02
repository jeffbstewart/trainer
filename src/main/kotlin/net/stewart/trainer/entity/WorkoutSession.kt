package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.time.LocalDate
import java.time.LocalDateTime

@Table("workout_session")
data class WorkoutSession(
    override var id: Long? = null,
    var workout_plan_id: Long = 0,
    var trainee_id: Long = 0,
    var trainer_id: Long = 0,
    var session_date: LocalDate? = null,
    var notes: String? = null,
    var created_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<WorkoutSession, Long>(WorkoutSession::class.java)
}

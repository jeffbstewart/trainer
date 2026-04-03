package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.math.BigDecimal

@Table("workout_session_set")
data class WorkoutSessionSet(
    override var id: Long? = null,
    var session_exercise_id: Long = 0,
    var set_number: Int = 0,
    var round_number: Int = 0,
    var weight: BigDecimal? = null,
    var reps: BigDecimal? = null,
    var unit: String = "lbs",
    var weight_direction: String? = null,
    var weight_marker: String? = null,
    var reps_marker: String? = null,
    var skipped: Boolean = false
) : KEntity<Long> {
    companion object : Dao<WorkoutSessionSet, Long>(WorkoutSessionSet::class.java)
}

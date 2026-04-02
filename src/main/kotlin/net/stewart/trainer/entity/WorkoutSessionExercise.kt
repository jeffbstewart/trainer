package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table

@Table("workout_session_exercise")
data class WorkoutSessionExercise(
    override var id: Long? = null,
    var workout_session_id: Long = 0,
    var exercise_id: Long = 0,
    var set_style: String? = null,
    var resistance_note: String? = null,
    var notes: String? = null
) : KEntity<Long> {
    companion object : Dao<WorkoutSessionExercise, Long>(WorkoutSessionExercise::class.java)
}

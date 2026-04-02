package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table

@Table("workout_plan_exercise")
data class WorkoutPlanExercise(
    override var id: Long? = null,
    var workout_plan_id: Long = 0,
    var exercise_id: Long = 0,
    var sort_order: Int = 0
) : KEntity<Long> {
    companion object : Dao<WorkoutPlanExercise, Long>(WorkoutPlanExercise::class.java)
}

package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table
import java.time.LocalDateTime

@Table("workout_plan")
data class WorkoutPlan(
    override var id: Long? = null,
    var program_id: Long? = null,
    var trainee_id: Long = 0,
    var trainer_id: Long = 0,
    var name: String = "",
    var sequence: String? = null,
    var plan_type: String = "CUSTOM",
    var sort_order: Int = 0,
    var created_at: LocalDateTime? = null
) : KEntity<Long> {
    companion object : Dao<WorkoutPlan, Long>(WorkoutPlan::class.java)
}

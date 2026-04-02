package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table

@Table("exercise_target")
data class ExerciseTarget(
    override var id: Long? = null,
    var exercise_id: Long = 0,
    var target_id: Long = 0
) : KEntity<Long> {
    companion object : Dao<ExerciseTarget, Long>(ExerciseTarget::class.java)
}

package net.stewart.trainer.entity

import com.github.vokorm.KEntity
import com.gitlab.mvysny.jdbiorm.Dao
import com.gitlab.mvysny.jdbiorm.Table

@Table("exercise_equipment")
data class ExerciseEquipment(
    override var id: Long? = null,
    var exercise_id: Long = 0,
    var equipment_id: Long = 0
) : KEntity<Long> {
    companion object : Dao<ExerciseEquipment, Long>(ExerciseEquipment::class.java)
}

package com.tamlili.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CallDao {
    @Query("SELECT * FROM calls ORDER BY startedAt DESC")
    fun observeAll(): Flow<List<CallEntity>>

    @Query("SELECT * FROM calls WHERE id = :id")
    fun observe(id: Long): Flow<CallEntity?>

    @Query("SELECT * FROM calls WHERE id = :id")
    suspend fun get(id: Long): CallEntity?

    /** מחזיר -1 אם originKey כבר קיים. */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(call: CallEntity): Long

    @Query("SELECT EXISTS(SELECT 1 FROM calls WHERE originKey = :key)")
    suspend fun existsOrigin(key: String): Boolean

    @Query("DELETE FROM calls WHERE id = :id")
    suspend fun delete(id: Long)
}

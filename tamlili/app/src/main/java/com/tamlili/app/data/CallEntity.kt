package com.tamlili.app.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

object CallSource {
    /** הקובץ הגיע ממקליט השיחות המובנה של שיאומי. */
    const val SYSTEM_RECORDER = "SYSTEM_RECORDER"
    /** תמלילי הקליטה בעצמה. */
    const val OWN_RECORDER = "OWN_RECORDER"
    /** קובץ שמע שהמשתמש ייבא ידנית (שלב 7). */
    const val FILE_IMPORT = "FILE_IMPORT"
}

object CallDirection {
    const val INCOMING = "INCOMING"
    const val OUTGOING = "OUTGOING"
    const val UNKNOWN = "UNKNOWN"
}

@Entity(tableName = "calls", indices = [Index(value = ["originKey"], unique = true)])
data class CallEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val phoneNumber: String?,
    val contactName: String?,
    val direction: String,
    val startedAt: Long,
    val durationSec: Long,
    /** נתיב מקומי לקובץ השמע (בתוך אחסון האפליקציה). */
    val audioPath: String?,
    val source: String,
    /** שם הקובץ המקורי / מקור השמע שבו הוקלט. */
    val sourceDetail: String?,
    /** מזהה ייחודי של המקור, מונע ייבוא כפול. */
    val originKey: String?,
    val transcript: String? = null,
    val summary: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)

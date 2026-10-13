package com.tamlili.app.data

import android.content.Context
import android.media.MediaRecorder

/** איך מקבלים את השמע של השיחה. */
enum class RecordingMode(val label: String) {
    SYSTEM("מקליט השיחות של שיאומי (מומלץ — שני הצדדים)"),
    OWN("הקלטה של תמלילי"),
    BOTH("שניהם (לבדיקה)"),
}

class Prefs(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("tamlili", Context.MODE_PRIVATE)

    fun ensureInitialized() {
        if (!sp.contains(KEY_IMPORT_SINCE)) {
            // בהתקנה ראשונה מייבאים רק הקלטות מהיום והלאה; ישנות — דרך מסך הבדיקה.
            sp.edit().putLong(KEY_IMPORT_SINCE, System.currentTimeMillis() - DAY_MS).apply()
        }
    }

    var recordingMode: RecordingMode
        get() = runCatching { RecordingMode.valueOf(sp.getString(KEY_MODE, null)!!) }
            .getOrDefault(RecordingMode.SYSTEM)
        set(v) = sp.edit().putString(KEY_MODE, v.name).apply()

    var ownAudioSource: Int
        get() = sp.getInt(KEY_SOURCE, MediaRecorder.AudioSource.VOICE_RECOGNITION)
        set(v) = sp.edit().putInt(KEY_SOURCE, v).apply()

    /** מייבאים הקלטות מערכת שנוצרו מהזמן הזה והלאה. */
    var importSince: Long
        get() = sp.getLong(KEY_IMPORT_SINCE, System.currentTimeMillis() - DAY_MS)
        set(v) = sp.edit().putLong(KEY_IMPORT_SINCE, v).apply()

    // מצב השיחה נשמר כאן כי התהליך יכול למות בין שידורי PHONE_STATE.
    var callState: String
        get() = sp.getString(KEY_CALL_STATE, "IDLE")!!
        set(v) = sp.edit().putString(KEY_CALL_STATE, v).apply()
    var callNumber: String?
        get() = sp.getString(KEY_CALL_NUMBER, null)
        set(v) = sp.edit().putString(KEY_CALL_NUMBER, v).apply()
    var callIncoming: Boolean
        get() = sp.getBoolean(KEY_CALL_INCOMING, false)
        set(v) = sp.edit().putBoolean(KEY_CALL_INCOMING, v).apply()
    var callStartedAt: Long
        get() = sp.getLong(KEY_CALL_STARTED, 0L)
        set(v) = sp.edit().putLong(KEY_CALL_STARTED, v).apply()

    companion object {
        private const val DAY_MS = 24L * 60 * 60 * 1000
        private const val KEY_MODE = "recordingMode"
        private const val KEY_SOURCE = "ownAudioSource"
        private const val KEY_IMPORT_SINCE = "importSince"
        private const val KEY_CALL_STATE = "callState"
        private const val KEY_CALL_NUMBER = "callNumber"
        private const val KEY_CALL_INCOMING = "callIncoming"
        private const val KEY_CALL_STARTED = "callStartedAt"
    }
}

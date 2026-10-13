package com.tamlili.app.importer

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.core.content.ContextCompat
import com.tamlili.app.data.CallDirection
import kotlin.math.abs

data class CallLogEntry(
    val number: String?,
    val cachedName: String?,
    val direction: String,
    val startedAt: Long,
    val durationSec: Long,
)

/** מוצא ביומן השיחות את השיחה שהקלטה שייכת אליה, לפי זמן הסיום של הקובץ. */
object CallLogMatcher {
    fun match(context: Context, fileEndedAt: Long, numberHint: String?): CallLogEntry? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG)
            != PackageManager.PERMISSION_GRANTED
        ) return null
        val from = fileEndedAt - 4 * 60 * 60 * 1000L
        val to = fileEndedAt + 2 * 60 * 1000L
        val entries = mutableListOf<CallLogEntry>()
        runCatching {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE,
                    CallLog.Calls.DATE, CallLog.Calls.DURATION,
                ),
                "${CallLog.Calls.DATE} BETWEEN ? AND ? AND ${CallLog.Calls.DURATION} > 0",
                arrayOf(from.toString(), to.toString()),
                "${CallLog.Calls.DATE} DESC",
            )?.use { c ->
                while (c.moveToNext()) {
                    val type = c.getInt(2)
                    entries += CallLogEntry(
                        number = c.getString(0),
                        cachedName = c.getString(1),
                        direction = when (type) {
                            CallLog.Calls.INCOMING_TYPE -> CallDirection.INCOMING
                            CallLog.Calls.OUTGOING_TYPE -> CallDirection.OUTGOING
                            else -> CallDirection.UNKNOWN
                        },
                        startedAt = c.getLong(3),
                        durationSec = c.getLong(4),
                    )
                }
            }
        }
        if (entries.isEmpty()) return null
        val hintDigits = numberHint?.let { normalize(it) }
        val byNumber = if (hintDigits != null) entries.filter { e -> e.number?.let { normalize(it) } == hintDigits } else emptyList()
        val pool = byNumber.ifEmpty { entries }
        return pool.minByOrNull { abs(it.startedAt + it.durationSec * 1000 - fileEndedAt) }
    }

    /** 050-123-4567 / +972501234567 → 501234567, להשוואה בלבד. */
    fun normalize(number: String): String {
        val digits = number.filter { it.isDigit() }
        return when {
            digits.startsWith("972") -> digits.removePrefix("972")
            digits.startsWith("0") -> digits.removePrefix("0")
            else -> digits
        }
    }
}

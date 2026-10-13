package com.tamlili.app.call

import android.content.Context
import android.telephony.TelephonyManager
import com.tamlili.app.data.Prefs
import com.tamlili.app.data.RecordingMode
import com.tamlili.app.diag.DiagLog
import com.tamlili.app.importer.ImportScheduler
import com.tamlili.app.record.RecorderService

/** מכונת מצבים של שיחה: IDLE → (RINGING) → OFFHOOK → IDLE. */
object CallSession {
    private val IDLE = TelephonyManager.EXTRA_STATE_IDLE
    private val RINGING = TelephonyManager.EXTRA_STATE_RINGING
    private val OFFHOOK = TelephonyManager.EXTRA_STATE_OFFHOOK

    @Synchronized
    fun onPhoneState(context: Context, state: String, number: String?) {
        val prefs = Prefs(context)
        val previous = prefs.callState
        if (!number.isNullOrBlank()) prefs.callNumber = number

        if (state == previous) return // השידור הכפול
        prefs.callState = state
        DiagLog.log(context, "מצב שיחה: $previous → $state ${number ?: ""}")

        when (state) {
            RINGING -> {
                prefs.callIncoming = true
                if (number.isNullOrBlank()) prefs.callNumber = null
            }
            OFFHOOK -> {
                if (previous == IDLE) {
                    prefs.callIncoming = false
                    if (number.isNullOrBlank()) prefs.callNumber = null
                }
                prefs.callStartedAt = System.currentTimeMillis()
                if (prefs.recordingMode != RecordingMode.SYSTEM) {
                    RecorderService.start(context)
                }
            }
            IDLE -> {
                if (previous == OFFHOOK) {
                    if (prefs.recordingMode != RecordingMode.SYSTEM) RecorderService.stop(context)
                    if (prefs.recordingMode != RecordingMode.OWN) ImportScheduler.afterCall(context)
                } else {
                    DiagLog.log(context, "שיחה שלא נענתה — מתעלמים")
                }
            }
        }
    }
}

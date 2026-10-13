package com.tamlili.app.record

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.tamlili.app.Notifications
import com.tamlili.app.data.AppDatabase
import com.tamlili.app.data.CallDirection
import com.tamlili.app.data.CallEntity
import com.tamlili.app.data.CallSource
import com.tamlili.app.data.Prefs
import com.tamlili.app.diag.DiagLog
import com.tamlili.app.importer.ContactLookup
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File

/** שירות חזיתי שמקליט את השיחה בעצמו (שיטת גיבוי למקליט של שיאומי). */
class RecorderService : Service() {
    private var recorder: WavRecorder? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> begin()
            ACTION_STOP -> finish()
        }
        return START_NOT_STICKY
    }

    private fun begin() {
        try {
            ServiceCompat.startForeground(
                this, Notifications.ID_RECORDING, Notifications.recording(this),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } catch (e: Exception) {
            DiagLog.log(this, "startForeground נכשל: ${e.javaClass.simpleName} ${e.message}")
        }
        if (recorder != null) return
        val prefs = Prefs(this)
        val file = File(filesDir, "recordings/own_${System.currentTimeMillis()}.wav")
        val r = WavRecorder(file, prefs.ownAudioSource)
        if (r.start()) {
            recorder = r
            DiagLog.log(this, "הקלטה עצמית התחילה: ${WavRecorder.sourceName(r.audioSource)}")
        } else {
            DiagLog.log(this, "הקלטה עצמית נכשלה: ${r.error}")
            stopSelf()
        }
    }

    private fun finish() {
        val r = recorder ?: run { stopSelf(); return }
        recorder = null
        val seconds = r.stop()
        val prefs = Prefs(this)
        val number = prefs.callNumber
        val file = r.file
        DiagLog.log(this, "הקלטה עצמית נעצרה: ${seconds}ש׳, שיא ${r.peak}" + if (r.peak == 0) " (שקט מוחלט — המערכת חסמה)" else "")
        scope.launch {
            val name = number?.let { ContactLookup.nameFor(this@RecorderService, it) }
            val id = AppDatabase.get(this@RecorderService).calls().insert(
                CallEntity(
                    phoneNumber = number,
                    contactName = name,
                    direction = if (prefs.callIncoming) CallDirection.INCOMING else CallDirection.OUTGOING,
                    startedAt = prefs.callStartedAt,
                    durationSec = seconds,
                    audioPath = file.absolutePath,
                    source = CallSource.OWN_RECORDER,
                    sourceDetail = WavRecorder.sourceName(r.audioSource),
                    originKey = file.name,
                )
            )
            if (id > 0) Notifications.callSaved(this@RecorderService, id, "שיחה עם ${name ?: number ?: "מספר לא ידוע"} הוקלטה")
            stopSelf()
        }
    }

    override fun onDestroy() {
        recorder?.stop()
        super.onDestroy()
    }

    companion object {
        private const val ACTION_START = "start"
        private const val ACTION_STOP = "stop"

        fun start(context: Context) {
            try {
                ContextCompat.startForegroundService(
                    context, Intent(context, RecorderService::class.java).setAction(ACTION_START)
                )
            } catch (e: Exception) {
                // אנדרואיד 12+ חוסם הפעלת שירות חזיתי מהרקע. זה בדיוק מה שהבדיקה בשלב 1 צריכה לגלות.
                DiagLog.log(context, "לא ניתן להפעיל הקלטה מהרקע: ${e.javaClass.simpleName} ${e.message}")
            }
        }

        fun stop(context: Context) {
            try {
                context.startService(Intent(context, RecorderService::class.java).setAction(ACTION_STOP))
            } catch (e: Exception) {
                DiagLog.log(context, "עצירת הקלטה נכשלה: ${e.javaClass.simpleName} ${e.message}")
            }
        }
    }
}

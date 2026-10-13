package com.tamlili.app.importer

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.tamlili.app.data.Prefs
import com.tamlili.app.diag.DiagLog
import java.util.concurrent.TimeUnit

class ImportWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val n = SystemRecordingImporter.importNew(applicationContext, Prefs(applicationContext).importSince)
        if (n > 0 || tags.contains(TAG_AFTER_CALL)) DiagLog.log(applicationContext, "סריקת הקלטות: יובאו $n")
        return Result.success()
    }

    companion object {
        const val TAG_AFTER_CALL = "after-call"
    }
}

object ImportScheduler {
    /** אחרי שיחה: סורקים אחרי 8 שניות ושוב אחרי דקה (למקרה שהמקליט של שיאומי סיים לכתוב באיחור). */
    fun afterCall(context: Context) {
        val wm = WorkManager.getInstance(context)
        listOf(8L to "import-after-call", 60L to "import-after-call-late").forEach { (delay, name) ->
            wm.enqueueUniqueWork(
                name, ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<ImportWorker>()
                    .setInitialDelay(delay, TimeUnit.SECONDS)
                    .addTag(ImportWorker.TAG_AFTER_CALL)
                    .build()
            )
        }
    }

    fun schedulePeriodic(context: Context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "import-periodic", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<ImportWorker>(1, TimeUnit.HOURS).build()
        )
    }
}

package com.tamlili.app

import android.app.Application
import com.tamlili.app.data.Prefs
import com.tamlili.app.diag.DiagLog
import com.tamlili.app.importer.ImportScheduler

class TamliliApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        Prefs(this).ensureInitialized()
        ImportScheduler.schedulePeriodic(this)
        DiagLog.log(this, "האפליקציה עלתה")
    }
}

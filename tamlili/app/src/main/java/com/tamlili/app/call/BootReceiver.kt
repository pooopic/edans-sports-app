package com.tamlili.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.tamlili.app.data.Prefs
import com.tamlili.app.importer.ImportScheduler

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        Prefs(context).callState = "IDLE"
        ImportScheduler.schedulePeriodic(context)
    }
}

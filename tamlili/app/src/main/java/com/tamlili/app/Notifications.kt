package com.tamlili.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object Notifications {
    const val CHANNEL_CALLS = "calls"
    const val CHANNEL_RECORDING = "recording"
    const val ID_RECORDING = 1001
    const val EXTRA_CALL_ID = "callId"

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_CALLS, "סיכומי שיחות", NotificationManager.IMPORTANCE_DEFAULT)
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_RECORDING, "הקלטה פעילה", NotificationManager.IMPORTANCE_LOW)
        )
    }

    fun recording(context: Context): Notification =
        NotificationCompat.Builder(context, CHANNEL_RECORDING)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("תמלילי מקליט את השיחה")
            .setOngoing(true)
            .setContentIntent(openApp(context, null))
            .build()

    fun callSaved(context: Context, callId: Long, title: String) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) return
        val n = NotificationCompat.Builder(context, CHANNEL_CALLS)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(title)
            .setAutoCancel(true)
            .setContentIntent(openApp(context, callId))
            .build()
        NotificationManagerCompat.from(context).notify(callId.toInt() + 2000, n)
    }

    private fun openApp(context: Context, callId: Long?): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (callId != null) putExtra(EXTRA_CALL_ID, callId)
        }
        return PendingIntent.getActivity(
            context, (callId ?: 0L).toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}

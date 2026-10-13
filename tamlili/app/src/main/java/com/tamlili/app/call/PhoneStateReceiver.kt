package com.tamlili.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

/**
 * מקבל את שידור PHONE_STATE (פטור ממגבלות שידורים מרומזים, עובד גם כשהאפליקציה סגורה).
 * אנדרואיד שולח כל מעבר פעמיים — פעם אחת עם מספר (כשיש READ_CALL_LOG) ופעם בלי; CallSession מטפל בכפילות.
 */
class PhoneStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        @Suppress("DEPRECATION")
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
        CallSession.onPhoneState(context.applicationContext, state, number)
    }
}

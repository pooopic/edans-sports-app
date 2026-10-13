package com.tamlili.app.call

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import com.tamlili.app.diag.DiagLog

/**
 * שירות נגישות "ריק": לא קורא את המסך. הוא קיים כי אנדרואיד 10+ מאפשר לאפליקציה עם שירות נגישות פעיל
 * להקליט מהמיקרופון במקביל לשיחה, וגם שומר על התהליך חי ברקע (חשוב ב-HyperOS שהורג אפליקציות).
 */
class TamliliAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        super.onServiceConnected()
        DiagLog.log(this, "שירות הנגישות מחובר")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    companion object {
        fun isEnabled(context: Context): Boolean {
            val expected = ComponentName(context, TamliliAccessibilityService::class.java).flattenToString()
            val enabled = Settings.Secure.getString(
                context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            return enabled.split(':').any { it.equals(expected, ignoreCase = true) }
        }
    }
}

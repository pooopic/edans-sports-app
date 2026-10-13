package com.tamlili.app.ui

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.tamlili.app.call.TamliliAccessibilityService

/** הרשאה אחת במסך ההרשאות: מה היא, למה צריך אותה, ואיך מאשרים. */
data class PermissionItem(
    val title: String,
    val why: String,
    val runtime: List<String> = emptyList(),
    val settingsIntent: ((Context) -> Intent)? = null,
    val extraHint: String? = null,
    val required: Boolean = true,
    val isGranted: (Context) -> Boolean,
)

object AppPermissions {
    private fun granted(c: Context, p: String) =
        ContextCompat.checkSelfPermission(c, p) == PackageManager.PERMISSION_GRANTED

    private fun appDetails(c: Context) =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${c.packageName}"))

    val all: List<PermissionItem> = listOf(
        PermissionItem(
            title = "טלפון ויומן שיחות",
            why = "כדי לדעת מתי שיחה מתחילה ונגמרת, ומי היה בצד השני.",
            runtime = listOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.READ_CALL_LOG),
            isGranted = { granted(it, Manifest.permission.READ_PHONE_STATE) && granted(it, Manifest.permission.READ_CALL_LOG) },
        ),
        PermissionItem(
            title = "קבצי שמע",
            why = "כדי לקרוא את ההקלטות שמקליט השיחות של שיאומי שומר.",
            runtime = listOf(
                if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO
                else Manifest.permission.READ_EXTERNAL_STORAGE
            ),
            isGranted = {
                granted(it, if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO else Manifest.permission.READ_EXTERNAL_STORAGE)
            },
        ),
        PermissionItem(
            title = "גישה לכל הקבצים",
            why = "גיבוי לקריאת הקבצים: חלק מגרסאות HyperOS לא מכניסות את הקלטות השיחה לספריית המדיה.",
            settingsIntent = {
                Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${it.packageName}"))
            },
            isGranted = { Environment.isExternalStorageManager() },
        ),
        PermissionItem(
            title = "אנשי קשר",
            why = "כדי להציג שם במקום מספר, ובהמשך להציע לשמור מספר חדש כאיש קשר.",
            runtime = listOf(Manifest.permission.READ_CONTACTS),
            isGranted = { granted(it, Manifest.permission.READ_CONTACTS) },
        ),
        PermissionItem(
            title = "התראות",
            why = "כדי להודיע לך בסוף כל שיחה שהסיכום מוכן.",
            runtime = if (Build.VERSION.SDK_INT >= 33) listOf(Manifest.permission.POST_NOTIFICATIONS) else emptyList(),
            isGranted = { Build.VERSION.SDK_INT < 33 || granted(it, Manifest.permission.POST_NOTIFICATIONS) },
        ),
        PermissionItem(
            title = "מיקרופון",
            why = "רק להקלטה עצמית (שיטת הגיבוי, אם המקליט של שיאומי לא זמין).",
            runtime = listOf(Manifest.permission.RECORD_AUDIO),
            required = false,
            isGranted = { granted(it, Manifest.permission.RECORD_AUDIO) },
        ),
        PermissionItem(
            title = "שירות נגישות",
            why = "רק להקלטה עצמית: מאפשר להקליט ברקע תוך כדי שיחה. השירות לא קורא את המסך.",
            settingsIntent = { Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS) },
            extraHint = "אם האפשרות אפורה (\"הגדרה מוגבלת\"): פרטי האפליקציה ← ⋮ למעלה ← \"אפשר הגדרות מוגבלות\", ואז לחזור לכאן.",
            required = false,
            isGranted = { TamliliAccessibilityService.isEnabled(it) },
        ),
        PermissionItem(
            title = "ריצה ברקע (סוללה)",
            why = "HyperOS סוגר אפליקציות ברקע. בלי זה תמלילי עלולה לפספס שיחות.",
            settingsIntent = {
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${it.packageName}"))
            },
            extraHint = "מומלץ גם: פרטי האפליקציה ← \"הפעלה אוטומטית\" ← להפעיל.",
            isGranted = {
                it.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(it.packageName)
            },
        ),
    )

    fun missingRequired(context: Context): Int = all.count { it.required && !it.isGranted(context) }

    /** מסך ההפעלה האוטומטית של שיאומי (לא קיים במכשירים אחרים). */
    fun xiaomiAutostartIntent(): Intent = Intent().setComponent(
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
    )

    fun appDetailsIntent(context: Context) = appDetails(context)
}

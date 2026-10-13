package com.tamlili.app.diag

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telecom.TelecomManager

object DeviceInfo {
    @SuppressLint("PrivateApi")
    private fun sysProp(name: String): String? = runCatching {
        val c = Class.forName("android.os.SystemProperties")
        (c.getMethod("get", String::class.java).invoke(null, name) as String).ifBlank { null }
    }.getOrNull()

    data class Row(val label: String, val value: String)

    fun rows(context: Context): List<Row> = listOf(
        Row("דגם", "${Build.MANUFACTURER} ${Build.MODEL} (${Build.DEVICE})"),
        Row("אנדרואיד", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"),
        Row("HyperOS", sysProp("ro.mi.os.version.incremental") ?: sysProp("ro.build.version.incremental") ?: "?"),
        Row("גרסת ממשק MIUI", sysProp("ro.miui.ui.version.name") ?: "—"),
        Row("אזור ROM", sysProp("ro.miui.region") ?: sysProp("ro.product.locale.region") ?: "?"),
        Row("חייגן ברירת מחדל", defaultDialer(context) ?: "?"),
        Row("חייגן שיאומי מותקן", yesNo(isInstalled(context, "com.android.incallui"))),
        Row("חייגן גוגל מותקן", yesNo(isInstalled(context, "com.google.android.dialer"))),
    )

    fun defaultDialer(context: Context): String? =
        runCatching { context.getSystemService(TelecomManager::class.java).defaultDialerPackage }.getOrNull()

    fun isInstalled(context: Context, pkg: String): Boolean = try {
        context.packageManager.getPackageInfo(pkg, 0); true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }

    private fun yesNo(b: Boolean) = if (b) "כן" else "לא"
}

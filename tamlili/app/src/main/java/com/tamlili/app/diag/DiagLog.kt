package com.tamlili.app.diag

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** יומן אבחון קטן בקובץ — כדי לראות מה קרה בפועל במכשיר בזמן שיחה. */
object DiagLog {
    private const val MAX_LINES = 400
    private val fmt = SimpleDateFormat("dd/MM HH:mm:ss", Locale.US)

    private fun file(context: Context) = File(context.filesDir, "diag.log")

    @Synchronized
    fun log(context: Context, message: String) {
        Log.i("Tamlili", message)
        val f = file(context)
        val lines = if (f.exists()) f.readLines() else emptyList()
        val updated = (lines + "${fmt.format(Date())}  $message").takeLast(MAX_LINES)
        f.writeText(updated.joinToString("\n"))
    }

    @Synchronized
    fun read(context: Context): List<String> {
        val f = file(context)
        return if (f.exists()) f.readLines().reversed() else emptyList()
    }

    @Synchronized
    fun clear(context: Context) {
        file(context).delete()
    }
}

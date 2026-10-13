package com.tamlili.app.importer

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import com.tamlili.app.Notifications
import com.tamlili.app.data.AppDatabase
import com.tamlili.app.data.CallDirection
import com.tamlili.app.data.CallEntity
import com.tamlili.app.data.CallSource
import com.tamlili.app.diag.DiagLog
import java.io.File

/**
 * מייבא את ההקלטות שמקליט השיחות המובנה של שיאומי (HyperOS) שומר.
 * זו השיטה המומלצת: המקליט של המערכת הוא אפליקציה מערכתית ולכן מקבל את שני צדי השיחה.
 */
object SystemRecordingImporter {

    /** תיקיות ידועות של הקלטות שיחה (שיאומי בגרסאות שונות + חייגן גוגל). רק מהן מייבאים. */
    val CALL_DIRS = listOf(
        "MIUI/sound_recorder/call_rec",
        "Recordings/Call",
        "Recordings/call_rec",
        "Recordings/Call recordings",
        "Music/Recordings/Call Recordings",
        "Call",
        "CallRecordings",
    )

    /** תיקיות שמוצגות במסך הבדיקה בלבד (מכילות גם הקלטות קול רגילות). */
    private val STATUS_ONLY_DIRS = listOf("MIUI/sound_recorder", "Recordings", "Music/Recordings")

    private val AUDIO_EXT = setOf("mp3", "m4a", "aac", "amr", "wav", "ogg", "opus", "3gp")

    data class Found(
        val key: String,
        val displayName: String,
        val relativeDir: String,
        val uri: Uri?,
        val file: File?,
        val modifiedAt: Long,
        val size: Long,
    )

    data class FolderStatus(val path: String, val exists: Boolean, val audioFiles: Int)

    fun folderStatus(): List<FolderStatus> {
        val root = Environment.getExternalStorageDirectory()
        return (CALL_DIRS + STATUS_ONLY_DIRS).map { dir ->
            val f = File(root, dir)
            val count = f.listFiles()?.count { it.isFile && it.extension.lowercase() in AUDIO_EXT } ?: 0
            FolderStatus(dir, f.isDirectory, count)
        }
    }

    /** מחפש הקלטות שיחה שנוצרו אחרי [since]; משלב MediaStore וסריקת תיקיות (אם יש "גישה לכל הקבצים"). */
    fun findCandidates(context: Context, since: Long): List<Found> {
        val result = linkedMapOf<String, Found>()
        queryMediaStore(context, since).forEach { result[it.key] = it }
        if (Environment.isExternalStorageManager()) {
            scanFolders(since).forEach { result.putIfAbsent(it.key, it) }
        }
        return result.values.sortedBy { it.modifiedAt }
    }

    private fun queryMediaStore(context: Context, since: Long): List<Found> {
        val out = mutableListOf<Found>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.RELATIVE_PATH,
            MediaStore.Audio.Media.DATE_MODIFIED,
            MediaStore.Audio.Media.SIZE,
        )
        val rp = MediaStore.Audio.Media.RELATIVE_PATH
        val selection = "$rp LIKE ? AND ${MediaStore.Audio.Media.DATE_MODIFIED} >= ?"
        val args = arrayOf("%call%", (since / 1000).toString())
        runCatching {
            context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, args, null
            )?.use { c ->
                while (c.moveToNext()) {
                    val id = c.getLong(0)
                    val name = c.getString(1) ?: continue
                    val size = c.getLong(4)
                    out += Found(
                        key = "$name|$size",
                        displayName = name,
                        relativeDir = c.getString(2) ?: "",
                        uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id),
                        file = null,
                        modifiedAt = c.getLong(3) * 1000,
                        size = size,
                    )
                }
            }
        }.onFailure { DiagLog.log(context, "שאילתת MediaStore נכשלה: ${it.message}") }
        return out
    }

    private fun scanFolders(since: Long): List<Found> {
        val root = Environment.getExternalStorageDirectory()
        return CALL_DIRS.flatMap { dir ->
            File(root, dir).listFiles().orEmpty()
                .filter { it.isFile && it.extension.lowercase() in AUDIO_EXT && it.lastModified() >= since }
                .map {
                    Found(
                        key = "${it.name}|${it.length()}",
                        displayName = it.name,
                        relativeDir = dir,
                        uri = null,
                        file = it,
                        modifiedAt = it.lastModified(),
                        size = it.length(),
                    )
                }
        }
    }

    /** מייבא את כל ההקלטות החדשות. מחזיר כמה יובאו. */
    suspend fun importNew(context: Context, since: Long): Int {
        val dao = AppDatabase.get(context).calls()
        var imported = 0
        for (f in findCandidates(context, since)) {
            if (dao.existsOrigin(f.key)) continue
            // דילוג על קבצים שעדיין נכתבים
            if (System.currentTimeMillis() - f.modifiedAt < 3000) continue

            val numberHint = parseNumber(f.displayName)
            val log = CallLogMatcher.match(context, f.modifiedAt, numberHint)
            val number = numberHint ?: log?.number
            val name = number?.let { ContactLookup.nameFor(context, it) } ?: log?.cachedName

            val dest = File(context.filesDir, "recordings/sys_${f.modifiedAt}_${f.displayName}")
            val copied = runCatching {
                dest.parentFile?.mkdirs()
                val input = f.uri?.let { context.contentResolver.openInputStream(it) } ?: f.file?.inputStream()
                input?.use { i -> dest.outputStream().use { o -> i.copyTo(o) } } != null
            }.getOrDefault(false)
            if (!copied) {
                DiagLog.log(context, "העתקה נכשלה: ${f.displayName}")
                continue
            }

            val id = dao.insert(
                CallEntity(
                    phoneNumber = number,
                    contactName = name,
                    direction = log?.direction ?: CallDirection.UNKNOWN,
                    startedAt = log?.startedAt ?: f.modifiedAt,
                    durationSec = log?.durationSec ?: 0,
                    audioPath = dest.absolutePath,
                    source = CallSource.SYSTEM_RECORDER,
                    sourceDetail = "${f.relativeDir.trimEnd('/')}/${f.displayName}",
                    originKey = f.key,
                )
            )
            if (id > 0) {
                imported++
                DiagLog.log(context, "יובאה הקלטה: ${f.displayName} → ${name ?: number ?: "לא זוהה"}")
                Notifications.callSaved(context, id, "שיחה עם ${name ?: number ?: "מספר לא ידוע"} נשמרה")
            } else {
                dest.delete()
            }
        }
        return imported
    }

    /**
     * מחלץ מספר טלפון משם הקובץ. דוגמאות של שיאומי:
     * "call_rec_0501234567_20251012143000.mp3", "אמא(0501234567)_20251012143000.mp3".
     * חותמות זמן מתחילות ב-20 ולכן לא נתפסות (מספרים מתחילים ב-0, + או 972).
     */
    fun parseNumber(fileName: String): String? {
        val base = fileName.substringBeforeLast('.')
        return Regex("""(\+?\d[\d\- ]{6,15}\d)""").findAll(base)
            .map { it.value.replace("-", "").replace(" ", "") }
            .firstOrNull { it.startsWith("+") || it.startsWith("0") || it.startsWith("972") }
    }
}

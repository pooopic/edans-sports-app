package com.tamlili.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Environment
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.tamlili.app.call.TamliliAccessibilityService
import com.tamlili.app.data.Prefs
import com.tamlili.app.data.RecordingMode
import com.tamlili.app.diag.DeviceInfo
import com.tamlili.app.diag.DiagLog
import com.tamlili.app.importer.SystemRecordingImporter
import com.tamlili.app.record.WavRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private const val TEST_SECONDS = 8

/** תוצאת בדיקה של מקור שמע אחד. */
private data class SourceResult(
    val source: Int,
    val started: Boolean,
    val peak: Int,
    val seconds: Long,
    val error: String?,
    val path: String?,
) {
    val verdict: String
        get() = when {
            !started -> "חסום: ${error ?: ""}"
            peak == 0 -> "הוקלט שקט מוחלט — המערכת השתיקה"
            peak < 300 -> "חלש מאוד (שיא $peak)"
            else -> "הוקלט (שיא $peak) — האזן: שומעים את שני הצדדים?"
        }
}

@Composable
fun DiagnosticsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { Prefs(context) }
    val scope = rememberCoroutineScope()
    var refresh by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { refresh++ }

    var mode by remember { mutableStateOf(prefs.recordingMode) }
    var ownSource by remember { mutableIntStateOf(prefs.ownAudioSource) }
    val results = remember { mutableStateListOf<SourceResult>() }
    var testing by remember { mutableStateOf<String?>(null) }
    var importMsg by remember { mutableStateOf<String?>(null) }
    var folderLines by remember { mutableStateOf<List<String>>(emptyList()) }
    var log by remember { mutableStateOf<List<String>>(emptyList()) }

    LaunchedEffect(refresh) {
        withContext(Dispatchers.IO) {
            val all = Environment.isExternalStorageManager()
            val folders = if (all) SystemRecordingImporter.folderStatus()
                .filter { it.exists }
                .map { "${it.path}  —  ${it.audioFiles} קבצים" }
                .ifEmpty { listOf("לא נמצאה אף תיקייה מוכרת") }
            else listOf("כדי לסרוק תיקיות צריך \"גישה לכל הקבצים\" (מסך הרשאות)")
            val recent = SystemRecordingImporter.findCandidates(context, System.currentTimeMillis() - 30L * 86_400_000)
            folderLines = folders + "הקלטות שיחה שנמצאו ב-30 יום: ${recent.size}" +
                recent.takeLast(3).map { "  • ${it.relativeDir.trimEnd('/')}/${it.displayName}" }
            log = DiagLog.read(context).take(60)
        }
    }

    val micLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { refresh++ }
    fun hasMic() = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED

    fun runTests(sources: List<Int>) {
        if (!hasMic()) { micLauncher.launch(Manifest.permission.RECORD_AUDIO); return }
        scope.launch {
            for (src in sources) {
                testing = WavRecorder.sourceName(src)
                val r = withContext(Dispatchers.IO) {
                    val file = File(context.cacheDir, "tests/src_$src.wav")
                    val rec = WavRecorder(file, src)
                    if (rec.start()) {
                        delay(TEST_SECONDS * 1000L)
                        val sec = rec.stop()
                        SourceResult(src, true, rec.peak, sec, null, file.absolutePath)
                    } else SourceResult(src, false, 0, 0, rec.error, null)
                }
                results.removeAll { it.source == src }
                results.add(r)
                DiagLog.log(context, "בדיקת מקור ${WavRecorder.sourceName(src)}: ${r.verdict}")
            }
            testing = null
            refresh++
        }
    }

    Scaffold(topBar = { BackTopBar("בדיקת הקלטה", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SectionCard("המכשיר") {
                DeviceInfo.rows(context).forEach { row ->
                    Text("${row.label}: ${row.value}", style = MaterialTheme.typography.bodyMedium)
                }
                Text(
                    "שירות נגישות: " + if (refresh >= 0 && TamliliAccessibilityService.isEnabled(context)) "פעיל" else "כבוי",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            SectionCard("שיטה 1 (מומלצת): מקליט השיחות של שיאומי") {
                Text(
                    "המקליט המובנה הוא אפליקציית מערכת, ולכן מקליט את שני הצדדים באיכות טובה. " +
                        "תמלילי רק אוספת את הקבצים שלו אחרי כל שיחה.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "להפעלה: אפליקציית הטלפון ← ⋮ ← הגדרות ← הקלטת שיחות ← \"הקלט שיחות אוטומטית\" ← כל המספרים.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(10.dp))
                folderLines.forEach { Text(it, style = MaterialTheme.typography.bodySmall) }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = {
                        scope.launch {
                            importMsg = "סורק…"
                            val n = withContext(Dispatchers.IO) {
                                SystemRecordingImporter.importNew(context, System.currentTimeMillis() - 30L * 86_400_000)
                            }
                            importMsg = "יובאו $n הקלטות חדשות"
                            refresh++
                        }
                    }) { Text("ייבוא 30 יום אחרונים") }
                    OutlinedButton(onClick = {
                        safeStart(context, Intent(Intent.ACTION_DIAL))
                    }) { Text("פתח חייגן") }
                }
                importMsg?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            }

            SectionCard("שיטה 2: הקלטה של תמלילי") {
                Text(
                    "בדיקה: התקשר למישהו (או לתא הקולי), עבור לתמלילי באמצע השיחה ולחץ \"בדוק את כל המקורות\". " +
                        "כל מקור מוקלט $TEST_SECONDS שניות. אחר כך האזן — באיזה מקור שומעים את שני הצדדים?",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "טיפ: שירות הנגישות פעיל משפר את הסיכוי. רמקול פתוח עוזר למקורות המיקרופון לקלוט את הצד השני.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                Button(
                    enabled = testing == null,
                    onClick = { runTests(WavRecorder.SOURCES.map { it.first }) },
                ) { Text(if (testing == null) "בדוק את כל המקורות" else "מקליט: $testing") }
                Spacer(Modifier.height(8.dp))
                WavRecorder.SOURCES.forEach { (src, name) ->
                    val res = results.firstOrNull { it.source == src }
                    HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    Text(name, style = MaterialTheme.typography.bodyLarge)
                    res?.let {
                        Text(it.verdict, style = MaterialTheme.typography.bodyMedium)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            it.path?.let { p -> AudioPlayer(p, "האזנה") }
                            Spacer(Modifier.width(8.dp))
                            if (it.started && ownSource != src) {
                                TextButton(onClick = { prefs.ownAudioSource = src; ownSource = src }) { Text("לבחור במקור הזה") }
                            }
                        }
                    }
                    if (ownSource == src) Text("✓ המקור שנבחר להקלטה עצמית", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                }
            }

            SectionCard("איך להקליט שיחות") {
                RecordingMode.entries.forEach { m ->
                    Row(
                        Modifier.fillMaxWidth().selectable(selected = mode == m, onClick = {
                            mode = m; prefs.recordingMode = m
                        }).padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = mode == m, onClick = null)
                        Spacer(Modifier.width(8.dp))
                        Text(m.label, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }

            SectionCard("יומן אבחון") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = {
                        val text = DiagLog.read(context).reversed().joinToString("\n")
                        val share = Intent(Intent.ACTION_SEND).setType("text/plain")
                            .putExtra(Intent.EXTRA_TEXT, DeviceInfo.rows(context).joinToString("\n") { "${it.label}: ${it.value}" } + "\n\n" + text)
                        safeStart(context, Intent.createChooser(share, "שיתוף יומן"))
                    }) { Text("שיתוף") }
                    OutlinedButton(onClick = { DiagLog.clear(context); refresh++ }) { Text("ניקוי") }
                    OutlinedButton(onClick = { refresh++ }) { Text("רענון") }
                }
                Spacer(Modifier.height(8.dp))
                if (log.isEmpty()) Text("ריק", style = MaterialTheme.typography.bodySmall)
                log.forEach { Text(it, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace) }
            }
        }
    }
}

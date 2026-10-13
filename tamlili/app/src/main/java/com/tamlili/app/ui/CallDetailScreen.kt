package com.tamlili.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tamlili.app.data.AppDatabase
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun CallDetailScreen(callId: Long, onBack: () -> Unit) {
    val context = LocalContext.current
    val dao = remember { AppDatabase.get(context).calls() }
    val call by remember(callId) { dao.observe(callId) }.collectAsStateWithLifecycle(initialValue = null)
    val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf(false) }

    Scaffold(topBar = { BackTopBar(call?.let { callTitle(it) } ?: "שיחה", onBack) }) { pad ->
        val c = call ?: return@Scaffold
        Column(
            Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SectionCard("פרטי השיחה") {
                Text(formatDate(c.startedAt), style = MaterialTheme.typography.bodyLarge)
                if (c.durationSec > 0) Text("משך: " + formatDuration(c.durationSec), style = MaterialTheme.typography.bodyLarge)
                Text(directionLabel(c.direction), style = MaterialTheme.typography.bodyLarge)
                c.phoneNumber?.let { Text("מספר: $it", style = MaterialTheme.typography.bodyLarge) }
                Text("מקור: " + sourceLabel(c.source), style = MaterialTheme.typography.bodyMedium)
                c.sourceDetail?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            c.audioPath?.let { path ->
                SectionCard("הקלטה") {
                    if (File(path).exists()) AudioPlayer(path) else Text("קובץ השמע נמחק", style = MaterialTheme.typography.bodyMedium)
                }
            }
            SectionCard("תמלול וסיכום") {
                Text(
                    c.transcript ?: "התמלול המקומי (Whisper) יתווסף בשלב 2.",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { confirmDelete = true }) { Text("מחיקת השיחה") }
        }

        if (confirmDelete) {
            AlertDialog(
                onDismissRequest = { confirmDelete = false },
                title = { Text("למחוק את השיחה?") },
                text = { Text("ההקלטה והפרטים יימחקו מהטלפון.") },
                confirmButton = {
                    TextButton(onClick = {
                        scope.launch {
                            c.audioPath?.let { File(it).delete() }
                            dao.delete(c.id)
                            onBack()
                        }
                    }) { Text("מחיקה") }
                },
                dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("ביטול") } },
            )
        }
    }
}

package com.tamlili.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.tamlili.app.data.AppDatabase
import com.tamlili.app.data.CallDirection
import com.tamlili.app.data.CallEntity
import com.tamlili.app.data.CallSource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onOpenCall: (Long) -> Unit, onOpenPermissions: () -> Unit, onOpenDiagnostics: () -> Unit) {
    val context = LocalContext.current
    val calls by remember { AppDatabase.get(context).calls().observeAll() }
        .collectAsStateWithLifecycle(initialValue = emptyList())
    var missing by remember { mutableIntStateOf(AppPermissions.missingRequired(context)) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { missing = AppPermissions.missingRequired(context) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("תמלילי", style = MaterialTheme.typography.headlineMedium) },
                actions = {
                    IconButton(onClick = onOpenPermissions) { Icon(Icons.Outlined.Security, "הרשאות") }
                    IconButton(onClick = onOpenDiagnostics) { Icon(Icons.Outlined.Build, "בדיקת הקלטה") }
                },
            )
        },
    ) { pad ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (missing > 0) {
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                        Column(Modifier.padding(18.dp)) {
                            Text("חסרות $missing הרשאות", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(6.dp))
                            Text("בלעדיהן תמלילי לא תוכל לקלוט שיחות.", style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = onOpenPermissions) { Text("להגדרת הרשאות") }
                        }
                    }
                }
            }
            if (calls.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                        Text(
                            "עדיין אין שיחות.\nאחרי השיחה הבאה היא תופיע כאן.\n\nלבדיקה ראשונה: מסך \"בדיקת הקלטה\" 🔧",
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            items(calls, key = { it.id }) { call -> CallRow(call, onClick = { onOpenCall(call.id) }) }
        }
    }
}

@Composable
private fun CallRow(call: CallEntity, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(18.dp)) {
            Text(callTitle(call), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            Text(
                formatDate(call.startedAt) + (if (call.durationSec > 0) " · " + formatDuration(call.durationSec) else ""),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                directionLabel(call.direction) + " · " + sourceLabel(call.source),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

fun callTitle(call: CallEntity) = call.contactName ?: call.phoneNumber ?: "מספר לא ידוע"

fun directionLabel(d: String) = when (d) {
    CallDirection.INCOMING -> "נכנסת"
    CallDirection.OUTGOING -> "יוצאת"
    else -> "שיחה"
}

fun sourceLabel(s: String) = when (s) {
    CallSource.SYSTEM_RECORDER -> "מקליט שיאומי"
    CallSource.OWN_RECORDER -> "הקלטת תמלילי"
    CallSource.FILE_IMPORT -> "קובץ מיובא"
    else -> s
}

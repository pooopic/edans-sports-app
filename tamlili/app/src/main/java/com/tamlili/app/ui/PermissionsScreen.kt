package com.tamlili.app.ui

import android.content.Context
import android.content.Intent
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

@Composable
fun PermissionsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    // מונה רענון: עולה בכל חזרה למסך (למשל מהגדרות המערכת) כדי לבדוק מחדש מה אושר.
    var refresh by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { refresh++ }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { refresh++ }

    Scaffold(topBar = { BackTopBar("הרשאות", onBack) }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                "כל הרשאה מוסברת. ההרשאות של Google (יומן, משימות, Gmail, Drive) יתווספו בשלב החיבור לגוגל.",
                style = MaterialTheme.typography.bodyLarge,
            )
            AppPermissions.all.forEach { item ->
                // קריאה ל-refresh כדי שהקומפוזיציה תתעדכן כשהוא משתנה
                val ok = refresh >= 0 && item.isGranted(context)
                PermissionRow(item, ok, onGrant = {
                    when {
                        item.runtime.isNotEmpty() -> launcher.launch(item.runtime.toTypedArray())
                        item.settingsIntent != null -> safeStart(context, item.settingsIntent.invoke(context))
                    }
                })
            }
            SectionCard("שיאומי: הפעלה אוטומטית") {
                Text("כדי ש-HyperOS לא יסגור את תמלילי, כדאי לאפשר \"הפעלה אוטומטית\".", style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = {
                        if (!safeStart(context, AppPermissions.xiaomiAutostartIntent())) {
                            safeStart(context, AppPermissions.appDetailsIntent(context))
                        }
                    }) { Text("הפעלה אוטומטית") }
                    OutlinedButton(onClick = { safeStart(context, AppPermissions.appDetailsIntent(context)) }) {
                        Text("פרטי האפליקציה")
                    }
                }
            }
        }
    }
}

@Composable
private fun PermissionRow(item: PermissionItem, granted: Boolean, onGrant: () -> Unit) {
    SectionCard(item.title + if (item.required) "" else " (אופציונלי)") {
        Text(item.why, style = MaterialTheme.typography.bodyMedium)
        item.extraHint?.let {
            Spacer(Modifier.height(6.dp))
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Icon(
                if (granted) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
                contentDescription = null,
                tint = if (granted) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(28.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(if (granted) "מאושר" else "לא מאושר", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            if (!granted) Button(onClick = onGrant) { Text("לאשר") }
        }
    }
}

fun safeStart(context: Context, intent: Intent): Boolean = try {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true
} catch (_: Exception) {
    false
}

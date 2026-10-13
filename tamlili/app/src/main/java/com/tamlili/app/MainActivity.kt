package com.tamlili.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.tamlili.app.ui.AppNav
import com.tamlili.app.ui.theme.TamliliTheme

class MainActivity : ComponentActivity() {
    private val openCallId = mutableStateOf<Long?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        readIntent(intent)
        setContent {
            TamliliTheme {
                AppNav(openCallId = openCallId.value, onCallOpened = { openCallId.value = null })
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readIntent(intent)
    }

    private fun readIntent(intent: Intent?) {
        val id = intent?.getLongExtra(Notifications.EXTRA_CALL_ID, -1L) ?: -1L
        if (id > 0) openCallId.value = id
    }
}

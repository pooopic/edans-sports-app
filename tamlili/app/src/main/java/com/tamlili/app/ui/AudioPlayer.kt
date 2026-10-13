package com.tamlili.app.ui

import android.media.MediaPlayer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** נגן פשוט לקובץ מקומי. */
@Composable
fun AudioPlayer(path: String, label: String = "השמעה") {
    var player by remember(path) { mutableStateOf<MediaPlayer?>(null) }
    var playing by remember(path) { mutableStateOf(false) }
    var error by remember(path) { mutableStateOf<String?>(null) }

    DisposableEffect(path) {
        onDispose { player?.release(); player = null }
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        FilledTonalButton(onClick = {
            val p = player
            if (playing && p != null) {
                p.pause(); playing = false
            } else {
                try {
                    val mp = p ?: MediaPlayer().apply {
                        setDataSource(path)
                        prepare()
                        setOnCompletionListener { playing = false }
                    }.also { player = it }
                    mp.start(); playing = true; error = null
                } catch (e: Exception) {
                    error = "לא ניתן להשמיע: ${e.message}"
                }
            }
        }) {
            Icon(if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, contentDescription = null)
            Spacer(Modifier.width(6.dp))
            Text(if (playing) "השהיה" else label)
        }
        error?.let { Spacer(Modifier.width(10.dp)); Text(it) }
    }
}

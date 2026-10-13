package com.tamlili.app.record

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.io.File
import java.io.RandomAccessFile
import kotlin.math.abs
import kotlin.math.max

/**
 * מקליט PCM 16kHz מונו לקובץ WAV — בדיוק הפורמט ש-Whisper צריך, כך שבשלב 2 אין צורך בהמרה.
 */
class WavRecorder(val file: File, val audioSource: Int) {
    private var record: AudioRecord? = null
    private var thread: Thread? = null
    @Volatile private var running = false

    /** השיא הגבוה ביותר שנמדד (0..32767). 0 = המערכת השתיקה את ההקלטה. */
    @Volatile var peak: Int = 0
        private set
    @Volatile var dataBytes: Long = 0
        private set
    var error: String? = null
        private set

    @SuppressLint("MissingPermission")
    fun start(): Boolean {
        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING)
        if (minBuf <= 0) {
            error = "getMinBufferSize=$minBuf"
            return false
        }
        val r = try {
            AudioRecord(audioSource, SAMPLE_RATE, CHANNEL, ENCODING, max(minBuf, SAMPLE_RATE))
        } catch (e: Exception) {
            error = e.javaClass.simpleName + ": " + e.message
            return false
        }
        if (r.state != AudioRecord.STATE_INITIALIZED) {
            error = "AudioRecord לא אותחל (המקור חסום)"
            r.release()
            return false
        }
        try {
            r.startRecording()
        } catch (e: Exception) {
            error = e.javaClass.simpleName + ": " + e.message
            r.release()
            return false
        }
        if (r.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
            error = "ההקלטה לא התחילה (המיקרופון תפוס?)"
            r.release()
            return false
        }
        record = r
        running = true
        file.parentFile?.mkdirs()
        thread = Thread({ loop(r) }, "wav-recorder").also { it.start() }
        return true
    }

    private fun loop(r: AudioRecord) {
        RandomAccessFile(file, "rw").use { out ->
            out.setLength(0)
            out.write(ByteArray(HEADER_SIZE))
            val buf = ShortArray(SAMPLE_RATE / 10)
            val bytes = ByteArray(buf.size * 2)
            while (running) {
                val n = r.read(buf, 0, buf.size)
                if (n <= 0) continue
                var p = peak
                for (i in 0 until n) {
                    val s = buf[i].toInt()
                    p = max(p, abs(s))
                    bytes[i * 2] = (s and 0xff).toByte()
                    bytes[i * 2 + 1] = ((s shr 8) and 0xff).toByte()
                }
                peak = p
                out.write(bytes, 0, n * 2)
                dataBytes += n * 2
            }
            writeHeader(out, dataBytes)
        }
    }

    /** עוצר ומחזיר את משך ההקלטה בשניות. */
    fun stop(): Long {
        running = false
        thread?.join(3000)
        record?.let {
            runCatching { it.stop() }
            it.release()
        }
        record = null
        return dataBytes / (SAMPLE_RATE * 2)
    }

    private fun writeHeader(out: RandomAccessFile, dataLen: Long) {
        fun le32(v: Long) = byteArrayOf(v.toByte(), (v shr 8).toByte(), (v shr 16).toByte(), (v shr 24).toByte())
        fun le16(v: Int) = byteArrayOf(v.toByte(), (v shr 8).toByte())
        out.seek(0)
        out.write("RIFF".toByteArray()); out.write(le32(36 + dataLen))
        out.write("WAVE".toByteArray())
        out.write("fmt ".toByteArray()); out.write(le32(16))
        out.write(le16(1)); out.write(le16(1)) // PCM, mono
        out.write(le32(SAMPLE_RATE.toLong())); out.write(le32(SAMPLE_RATE * 2L))
        out.write(le16(2)); out.write(le16(16))
        out.write("data".toByteArray()); out.write(le32(dataLen))
    }

    companion object {
        const val SAMPLE_RATE = 16000
        private const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        private const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
        private const val HEADER_SIZE = 44

        /** מקורות שמע לבדיקה, לפי סדר הסיכוי להקליט את שני הצדדים. */
        val SOURCES: List<Pair<Int, String>> = listOf(
            MediaRecorder.AudioSource.VOICE_CALL to "VOICE_CALL (שני הצדדים, בדרך כלל חסום)",
            MediaRecorder.AudioSource.VOICE_DOWNLINK to "VOICE_DOWNLINK (הצד השני)",
            MediaRecorder.AudioSource.VOICE_UPLINK to "VOICE_UPLINK (הצד שלי)",
            MediaRecorder.AudioSource.VOICE_RECOGNITION to "VOICE_RECOGNITION (מיקרופון, Callrex)",
            MediaRecorder.AudioSource.VOICE_COMMUNICATION to "VOICE_COMMUNICATION (מיקרופון שיחה)",
            MediaRecorder.AudioSource.MIC to "MIC (מיקרופון רגיל)",
            MediaRecorder.AudioSource.UNPROCESSED to "UNPROCESSED (מיקרופון גולמי)",
        )

        fun sourceName(source: Int) = SOURCES.firstOrNull { it.first == source }?.second ?: "מקור $source"
    }
}

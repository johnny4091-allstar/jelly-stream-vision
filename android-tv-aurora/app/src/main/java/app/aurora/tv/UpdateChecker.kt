package app.aurora.tv

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Checks /api/public/tv-version on launch and at most every 6 hours on resume.
 * Downloads the APK only from our allowlisted host, verifies its sha256, then prompts to install.
 */
class UpdateChecker(private val activity: Activity) {
    private val prefs = activity.getSharedPreferences("updates", Context.MODE_PRIVATE)
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var running = false
    @Volatile private var cancelled = false

    fun cancel() { cancelled = true }

    fun checkIfDue(force: Boolean) {
        val last = prefs.getLong("last", 0L)
        if (running || (!force && System.currentTimeMillis() - last < 6 * 3600_000L)) return
        running = true
        Thread {
            try { run() } catch (_: Exception) { } finally { running = false }
        }.start()
    }

    private fun run() {
        prefs.edit().putLong("last", System.currentTimeMillis()).apply()
        val json = JSONObject(httpText(BuildConfig.VERSION_URL))
        val code = json.optInt("versionCode", 0)
        val name = json.optString("versionName", "")
        val sha = json.optString("sha256", "").lowercase()
        val url = Uri.parse(json.optString("downloadUrl", ""))
        if (code <= BuildConfig.VERSION_CODE || sha.length != 64 || !HostPolicy.isAllowed(url)) return
        if (prefs.getInt("skipped", 0) == code) return

        val dir = File(activity.cacheDir, "updates").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val apk = File(dir, "aurora-tv-$code.apk")
        download(url.toString(), apk)
        if (cancelled) return
        if (sha256(apk) != sha) { apk.delete(); return } // tampered or truncated: never offer it
        main.post { prompt(apk, name, code) }
    }

    private fun prompt(apk: File, name: String, code: Int) {
        if (activity.isFinishing || cancelled) return
        AlertDialog.Builder(activity)
            .setTitle("Update available")
            .setMessage("Aurora $name is ready to install.")
            .setPositiveButton("Install") { _, _ -> install(apk) }
            .setNegativeButton("Later", null)
            .setNeutralButton("Skip this version") { _, _ -> prefs.edit().putInt("skipped", code).apply() }
            .show()
            .getButton(AlertDialog.BUTTON_POSITIVE)?.requestFocus()
    }

    private fun install(apk: File) {
        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
            )
            return
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", apk)
        activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    private fun open(url: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = false
        }

    private fun httpText(url: String): String {
        val c = open(url)
        try {
            if (c.responseCode != 200) throw IllegalStateException("http ${c.responseCode}")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally { c.disconnect() }
    }

    private fun download(url: String, out: File) {
        val c = open(url)
        try {
            if (c.responseCode != 200) throw IllegalStateException("http ${c.responseCode}")
            c.inputStream.use { i -> out.outputStream().use { o -> i.copyTo(o) } }
        } finally { c.disconnect() }
    }

    private fun sha256(f: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { i ->
            val buf = ByteArray(64 * 1024)
            while (true) { val n = i.read(buf); if (n < 0) break; md.update(buf, 0, n) }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
}

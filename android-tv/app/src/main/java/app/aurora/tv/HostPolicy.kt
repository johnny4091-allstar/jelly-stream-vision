package app.aurora.tv

import android.net.Uri

/** Strict allowlist: our domain and its real subdomains only. No wildcard suffix tricks. */
object HostPolicy {
    private val ROOTS = listOf("jelly-stream-vision.lovable.app")

    fun isAllowed(uri: Uri?): Boolean {
        if (uri == null || uri.scheme != "https") return false
        val host = uri.host?.lowercase() ?: return false
        return ROOTS.any { root -> host == root || host.endsWith(".$root") }
    }
}

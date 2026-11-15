package org.cihof.remote

import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

/** Something the display, or the way to it, said no to: the words are for staff. */
class DisplayProblem(message: String, val stale: Boolean = false) : Exception(message)

/**
 * A display reached over the museum's network with the address and pairing
 * code its admin panel shows: the phone's side of apps/kiosk-app/src/
 * connection.mjs, as apps/review/server/display-connection.mjs is the desktop
 * portal's. It asks what the display shows, sends it a display update the
 * desktop portal made, and applies it when staff choose to.
 *
 * Every request is signed, and no answer is believed unless the display
 * signed it for that request.
 */
class Display private constructor(val base: String, val name: String, private val key: ByteArray) {

    companion object {
        const val DEFAULT_PORT = 5190
        /** Where a display is on its own Wi-Fi hotspot: Windows always gives it this address. */
        const val OWN_WIFI = "192.168.137.1:5190"

        /** "192.168.1.40:5190", "192.168.1.40" or "http://…": the address as typed. */
        fun base(address: String): String {
            val text = address.trim()
            if (text.isEmpty()) throw DisplayProblem("Type the address the display's admin panel shows.")
            val withScheme = if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(text)) text else "http://$text"
            val uri = try { URI(withScheme) } catch (_: Exception) { throw DisplayProblem("$text is not an address.") }
            val host = uri.host ?: throw DisplayProblem("$text is not an address.")
            val port = if (uri.port > 0) uri.port else DEFAULT_PORT
            return "${uri.scheme.lowercase()}://$host:$port"
        }

        /** Says hello, turns the code into the key with the display's salt, and asks what it shows. */
        fun connect(address: String, code: String): Pair<Display, JSONObject> {
            val base = base(address)
            if (Auth.normaliseCode(code).isEmpty()) throw DisplayProblem("Type the code the display's admin panel shows.")
            val hello = try {
                val connection = open("$base/cihof/hello", "GET", 8_000)
                try { JSONObject(connection.inputStream.bufferedReader().readText()) } finally { connection.disconnect() }
            } catch (_: Exception) {
                throw DisplayProblem("No display answered at ${base.removePrefix("http://")}. Check the address, that this phone is on the museum's network, and that the display's staff connection is open.")
            }
            val salt = hello.optString("salt")
            if (hello.optString("product") != "cihof-display" || !Regex("^[0-9a-f]{32}$").matches(salt)) {
                throw DisplayProblem("Whatever answered there is not a CIHOF display.")
            }
            val display = Display(base, hello.optString("name", "CIHOF display"), Auth.keyFrom(code, salt))
            return display to display.state()
        }

        private fun open(url: String, method: String, timeoutMs: Int): HttpURLConnection =
            (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 8_000
                readTimeout = timeoutMs
                useCaches = false
                instanceFollowRedirects = false
            }
    }

    val address: String get() = base.removePrefix("http://")

    /** What the display shows: its app, the content version it serves, and the versions before. */
    fun state(): JSONObject = call("GET", "/cihof/state")

    /**
     * Sends an update. `stream` is asked for twice: once to work out the
     * checksum the request is signed with, once to send it. The display checks
     * it and says what it would change, without applying it.
     */
    fun sendUpdate(stream: () -> InputStream): JSONObject {
        val (checksum, size) = stream().use { Auth.sha256(it) }
        if (size == 0L) throw DisplayProblem("That file is empty: it is not a display update.")
        val timeout = maxOf(60_000L, size / 1_000).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        return call("POST", "/cihof/updates", checksum, timeout) { connection ->
            connection.doOutput = true
            connection.setFixedLengthStreamingMode(size)
            connection.setRequestProperty("content-type", "application/octet-stream")
            stream().use { input -> connection.outputStream.use { input.copyTo(it, 1 shl 16) } }
        }
    }

    /** Applies an update the display holds: shown now, or at its next reset between visitors. */
    fun applyUpdate(id: String, now: Boolean, force: Boolean): JSONObject {
        if (!Regex("^[0-9a-f-]{36}$").matches(id)) throw DisplayProblem("That is not an update the display gave back.")
        return call("POST", "/cihof/updates/$id/apply?now=${if (now) "yes" else "no"}&force=${if (force) "yes" else "no"}", timeoutMs = 10 * 60_000)
    }

    private fun call(
        method: String,
        path: String,
        bodyChecksum: String = Auth.EMPTY_BODY,
        timeoutMs: Int = 30_000,
        write: ((HttpURLConnection) -> Unit)? = null,
    ): JSONObject {
        val headers = Auth.signRequest(key, method, path, bodyChecksum)
        val connection = open("$base$path", method, timeoutMs)
        try {
            headers.forEach(connection::setRequestProperty)
            val status: Int
            val text: String
            try {
                write?.invoke(connection)
                status = connection.responseCode
                text = (if (status >= 400) connection.errorStream else connection.inputStream)?.bufferedReader()?.readText() ?: ""
            } catch (error: IOException) {
                throw DisplayProblem("The display stopped answering. Its staff connection may have closed: look at its admin panel. ($error)")
            }
            val signed = Auth.responseIsSigned(
                key, headers.getValue(Auth.NONCE), status,
                connection.getHeaderField(Auth.SIGNATURE), connection.getHeaderField(Auth.BODY), Auth.sha256(text.toByteArray(Charsets.UTF_8)),
            )
            if (!signed) {
                throw DisplayProblem(
                    if (status == 401) "The display did not accept the pairing code. Check it against the one its admin panel shows now: it changes each time the connection is opened. Check too that this phone shows the right time."
                    else "The answer did not come from the display: it was not signed with the pairing code."
                )
            }
            val value = try { JSONObject(text) } catch (_: Exception) { throw DisplayProblem("The display's answer could not be read.") }
            if (status !in 200..299) throw DisplayProblem(value.optString("error", "The display said no ($status)."), value.optBoolean("stale"))
            return value
        } finally {
            connection.disconnect()
        }
    }
}

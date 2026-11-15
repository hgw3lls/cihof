package org.cihof.remote

import org.bouncycastle.crypto.generators.SCrypt
import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * How this phone and a display prove themselves to each other: the same
 * scheme as apps/kiosk-app/src/connection-auth.mjs, which the display and
 * the desktop staff portal share. Change one, change both.
 *
 * The pairing code never crosses the network. Each side turns it into a key
 * with the salt the display chose when its connection was opened, and signs
 * every request and every answer with that key.
 */
object Auth {
    const val TIME = "x-cihof-time"
    const val NONCE = "x-cihof-nonce"
    const val BODY = "x-cihof-body"
    const val SIGNATURE = "x-cihof-signature"

    val EMPTY_BODY: String = sha256(ByteArray(0))
    private val random = SecureRandom()

    /** The code as typed: case, spaces and the dash do not matter. */
    fun normaliseCode(code: String): String = code.uppercase().replace(Regex("[^0-9A-Z]"), "")

    /** scrypt(code, salt, N=2^15, r=8, p=1, 32 bytes): about a second and 32 MB on a phone. */
    fun keyFrom(code: String, saltHex: String): ByteArray =
        SCrypt.generate(normaliseCode(code).toByteArray(Charsets.UTF_8), hexToBytes(saltHex), 1 shl 15, 8, 1, 32)

    fun sha256(data: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(data))

    /** The checksum of a stream, and how long it was. */
    fun sha256(stream: InputStream): Pair<String, Long> {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(1 shl 16)
        var size = 0L
        while (true) {
            val read = stream.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
            size += read
        }
        return hex(digest.digest()) to size
    }

    private fun mac(key: ByteArray, text: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return hex(mac.doFinal(text.toByteArray(Charsets.UTF_8)))
    }

    fun requestText(method: String, path: String, time: Long, nonce: String, body: String) =
        listOf("request", method.uppercase(), path, time.toString(), nonce, body).joinToString("\n")

    fun responseText(nonce: String, status: Int, body: String) =
        listOf("response", nonce, status.toString(), body).joinToString("\n")

    /** The headers that sign a request. `body` is the body's checksum. */
    fun signRequest(
        key: ByteArray,
        method: String,
        path: String,
        body: String = EMPTY_BODY,
        now: Long = System.currentTimeMillis(),
        nonce: String = newNonce(),
    ): Map<String, String> = mapOf(
        TIME to now.toString(),
        NONCE to nonce,
        BODY to body,
        SIGNATURE to mac(key, requestText(method, path, now, nonce, body)),
    )

    /** Whether an answer carries the display's signature for this request and this body. */
    fun responseIsSigned(key: ByteArray, nonce: String, status: Int, signature: String?, claimedBody: String?, body: String): Boolean {
        if (signature == null || !Regex("^[0-9a-f]{64}$").matches(signature) || claimedBody != body) return false
        return MessageDigest.isEqual(mac(key, responseText(nonce, status, body)).toByteArray(), signature.toByteArray())
    }

    fun newNonce(): String = ByteArray(16).also(random::nextBytes).let(::hex)

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    fun hexToBytes(text: String): ByteArray {
        require(text.length % 2 == 0 && Regex("^[0-9a-fA-F]*$").matches(text)) { "Not hex." }
        return ByteArray(text.length / 2) { text.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
}

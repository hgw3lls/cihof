package org.cihof.remote

import org.json.JSONObject
import org.junit.AfterClass
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.BeforeClass
import org.junit.Test
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * The phone's side checked against the display's own code: signatures made by
 * apps/kiosk-app/src/connection-auth.mjs, and a real staff connection from
 * apps/kiosk-app/src/connection.mjs (run by scripts/test-display.mjs with
 * Node, which the project needs anyway).
 */
class DisplayTest {
    companion object {
        private val root = File(System.getProperty("cihof.root") ?: "../../..")
        private val script = File(root, "apps/display-remote/scripts/test-display.mjs")
        private val node = System.getProperty("cihof.node") ?: "node"
        private var display: Process? = null
        private var port = 0
        private var code = ""

        private fun node(vararg args: String): Process =
            try { ProcessBuilder(node, script.path, *args).directory(root).redirectError(ProcessBuilder.Redirect.INHERIT).start() }
            catch (error: Exception) { throw AssertionError("These tests need Node (the project's), to run the display's own code: $error") }

        @BeforeClass @JvmStatic
        fun open() {
            val process = node("serve")
            val first = process.inputStream.bufferedReader().readLine() ?: throw AssertionError("The test display did not start.")
            val opened = JSONObject(first)
            port = opened.getInt("port")
            code = opened.getString("code")
            display = process
        }

        @AfterClass @JvmStatic
        fun close() {
            display?.outputStream?.close()
            display?.waitFor()
        }
    }

    private val vectors: JSONObject by lazy {
        val process = node("vectors")
        val text = process.inputStream.bufferedReader().readText()
        assertEquals(0, process.waitFor())
        JSONObject(text)
    }

    @Test
    fun keysAndSignaturesAreTheDisplays() {
        val key = Auth.keyFrom(vectors.getString("code"), vectors.getString("salt"))
        assertEquals("the code typed in lower case with a space is the same code", vectors.getString("key"), Auth.hex(key))
        assertEquals(vectors.getString("empty"), Auth.EMPTY_BODY)
        assertEquals(vectors.getString("body"), Auth.sha256("{\"hello\":\"display\"}".toByteArray()))

        val request = vectors.getJSONObject("request")
        val signed = Auth.signRequest(key, "post", "/cihof/updates/x/apply?now=no&force=no", vectors.getString("body"), 1_700_000_000_000, request.getString(Auth.NONCE))
        assertEquals(request.getString(Auth.SIGNATURE), signed[Auth.SIGNATURE])

        val response = vectors.getJSONObject("response")
        val nonce = request.getString(Auth.NONCE)
        val body = vectors.getString("body")
        assertTrue(Auth.responseIsSigned(key, nonce, 409, response.getString(Auth.SIGNATURE), response.getString(Auth.BODY), body))
        assertFalse("another status", Auth.responseIsSigned(key, nonce, 200, response.getString(Auth.SIGNATURE), response.getString(Auth.BODY), body))
        assertFalse("another body", Auth.responseIsSigned(key, nonce, 409, response.getString(Auth.SIGNATURE), response.getString(Auth.BODY), Auth.EMPTY_BODY))
        assertFalse("another key", Auth.responseIsSigned(Auth.keyFrom("AAAA-AAAA", vectors.getString("salt")), nonce, 409, response.getString(Auth.SIGNATURE), response.getString(Auth.BODY), body))
        assertFalse("unsigned", Auth.responseIsSigned(key, nonce, 409, null, null, body))
    }

    @Test
    fun anAddressIsReadAsTheDesktopPortalReadsIt() {
        assertEquals("http://192.168.1.40:5190", Display.base(" 192.168.1.40 "))
        assertEquals("http://192.168.1.40:6000", Display.base("192.168.1.40:6000"))
        assertEquals("http://display.local:5190", Display.base("HTTP://display.local"))
        try { Display.base(""); fail() } catch (_: DisplayProblem) {}
    }

    @Test
    fun theWrongCodeIsRefusedAndSaysSo() {
        val wrong = if (code.startsWith("A")) "BBBB-BBBB" else "AAAA-AAAA"
        try {
            Display.connect("127.0.0.1:$port", wrong)
            fail("connected with the wrong code")
        } catch (problem: DisplayProblem) {
            assertTrue(problem.message, problem.message!!.contains("did not accept the pairing code"))
        }
    }

    @Test
    fun nothingThereSaysSo() {
        try {
            Display.connect("127.0.0.1:1", code)
            fail()
        } catch (problem: DisplayProblem) {
            assertTrue(problem.message!!.startsWith("No display answered at 127.0.0.1:1"))
        }
    }

    @Test
    fun anUnsignedRequestIsRefused() {
        val connection = URL("http://127.0.0.1:$port/cihof/state").openConnection() as HttpURLConnection
        assertEquals(401, connection.responseCode)
        connection.disconnect()
    }

    @Test
    fun connectsSendsChecksAndApplies() {
        // The code as somebody might type it.
        val (display, state) = Display.connect("127.0.0.1:$port", code.lowercase().replace("-", " "))
        assertEquals("Test display", display.name)
        assertTrue(Describe.state(state), Describe.state(state).startsWith("CIHOF Exhibit 9.9.9, release abc1234, 93 people."))

        val broken = display.sendUpdate { "broken update".byteInputStream() }
        assertEquals(1, Describe.problems(broken))
        assertEquals("The display will not take it: It is broken.", Describe.checked(broken))

        val stale = display.sendUpdate { "stale update".byteInputStream() }
        assertTrue(Describe.stale(stale)!!.contains("no longer shows"))
        try {
            display.applyUpdate(stale.getString("id"), now = false, force = false)
            fail("applied a stale update without being told to")
        } catch (problem: DisplayProblem) {
            assertTrue(problem.stale)
        }

        val good = display.sendUpdate { "a good update".byteInputStream() }
        assertEquals(null, Describe.stale(good))
        assertEquals(
            "The display checked it; it brings 1 film.\n" +
                "It would show content-bbbb in place of content-aaaa, made by Jane Smith on 2026-11-15 14:03 UTC.\n" +
                "  – Changed a biography.",
            Describe.checked(good),
        )
        val applied = display.applyUpdate(good.getString("id"), now = false, force = false)
        assertTrue(applied.getBoolean("applied"))
        try {
            display.applyUpdate(good.getString("id"), now = false, force = false)
            fail("applied the same update twice")
        } catch (problem: DisplayProblem) {
            assertTrue(problem.message!!.contains("not here any more"))
        }

        val after = Describe.state(display.state())
        assertTrue(after, after.contains("It shows a content update (content-bbbb), made by Jane Smith on 2026-11-15 14:03 UTC."))
        assertTrue(after, after.contains("now=false force=false"))
    }
}

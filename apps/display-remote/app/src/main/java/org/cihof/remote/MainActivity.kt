package org.cihof.remote

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * The display remote: a phone on the museum's network reaching a display's
 * staff connection. It shows what the display shows, and sends it a display
 * update made in the desktop staff portal, which the display checks exactly as
 * one loaded from a USB stick before anybody chooses to apply it.
 *
 * It decides nothing and edits nothing. The pairing code is kept only in
 * memory, for as long as the app is open; only the address is remembered.
 */
class MainActivity : Activity() {
    private val work = Executors.newSingleThreadExecutor()
    private var display: Display? = null
    private var sent: JSONObject? = null
    private var busy = false

    private lateinit var connectPanel: View
    private lateinit var address: EditText
    private lateinit var code: EditText
    private lateinit var connect: Button
    private lateinit var displayPanel: View
    private lateinit var displayTitle: TextView
    private lateinit var displayState: TextView
    private lateinit var refresh: Button
    private lateinit var disconnect: Button
    private lateinit var sendPanel: View
    private lateinit var choose: Button
    private lateinit var checked: TextView
    private lateinit var stale: TextView
    private lateinit var anyway: CheckBox
    private lateinit var applyLater: Button
    private lateinit var applyNow: Button
    private lateinit var status: TextView
    private lateinit var problem: TextView
    private lateinit var done: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.main)
        connectPanel = findViewById(R.id.connect_panel)
        address = findViewById(R.id.address)
        code = findViewById(R.id.code)
        connect = findViewById(R.id.connect)
        displayPanel = findViewById(R.id.display_panel)
        displayTitle = findViewById(R.id.display_title)
        displayState = findViewById(R.id.display_state)
        refresh = findViewById(R.id.refresh)
        disconnect = findViewById(R.id.disconnect)
        sendPanel = findViewById(R.id.send_panel)
        choose = findViewById(R.id.choose)
        checked = findViewById(R.id.checked)
        stale = findViewById(R.id.stale)
        anyway = findViewById(R.id.anyway)
        applyLater = findViewById(R.id.apply_later)
        applyNow = findViewById(R.id.apply_now)
        status = findViewById(R.id.status)
        problem = findViewById(R.id.problem)
        done = findViewById(R.id.done)

        address.setText(getPreferences(MODE_PRIVATE).getString("address", ""))
        // A display on its own Wi-Fi hotspot is always here (apps/kiosk-app/src/hotspot.mjs).
        findViewById<Button>(R.id.own_wifi).setOnClickListener { address.setText(Display.OWN_WIFI); code.requestFocus() }
        connect.setOnClickListener { connect() }
        refresh.setOnClickListener { refresh() }
        disconnect.setOnClickListener { disconnect() }
        choose.setOnClickListener { chooseUpdate() }
        anyway.setOnCheckedChangeListener { _, _ -> render() }
        applyLater.setOnClickListener { apply(now = false) }
        applyNow.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle(R.string.apply_now)
                .setMessage(R.string.apply_now_confirm)
                .setPositiveButton(R.string.apply_now) { _, _ -> apply(now = true) }
                .setNegativeButton(android.R.string.cancel, null)
                .show()
        }
        render()
    }

    override fun onDestroy() {
        work.shutdownNow()
        super.onDestroy()
    }

    private fun connect() {
        val typed = address.text.toString()
        val typedCode = code.text.toString()
        run(getString(R.string.connecting)) {
            val (next, state) = Display.connect(typed, typedCode)
            getPreferences(MODE_PRIVATE).edit().putString("address", typed.trim()).apply()
            ui {
                display = next
                code.setText("")
                showState(state)
            }
        }
    }

    private fun refresh() {
        val current = display ?: return
        run(getString(R.string.asking)) { current.state().let { ui { showState(it) } } }
    }

    private fun disconnect() {
        display = null
        sent = null
        done.text = ""
        problem.text = ""
        render()
    }

    private fun showState(state: JSONObject) {
        displayTitle.text = getString(R.string.connected_to, display?.name ?: "the display")
        displayState.text = getString(R.string.at, display?.address ?: "") + "\n\n" + Describe.state(state)
        render()
    }

    @Deprecated("Activity's own; there is no AndroidX here.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK && resultCode == RESULT_OK) data?.data?.let(::send)
    }

    @Suppress("DEPRECATION")
    private fun chooseUpdate() {
        val pick = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            // A .cihof file has no type of its own; the display checks what it is.
            type = "*/*"
        }
        startActivityForResult(pick, PICK)
    }

    private fun send(uri: Uri) {
        val current = display ?: return
        val name = nameOf(uri)
        sent = null
        done.text = ""
        run(getString(R.string.sending, name)) {
            val outcome = current.sendUpdate {
                contentResolver.openInputStream(uri) ?: throw DisplayProblem(getString(R.string.cannot_read, name))
            }
            ui {
                sent = outcome
                anyway.isChecked = false
                render()
            }
        }
    }

    private fun apply(now: Boolean) {
        val current = display ?: return
        val update = sent ?: return
        val force = anyway.isChecked
        run(getString(R.string.applying)) {
            current.applyUpdate(update.getString("id"), now, force)
            val state = current.state()
            ui {
                sent = null
                done.text = getString(if (now) R.string.applied_now else R.string.applied_later)
                showState(state)
            }
        }
    }

    /** Runs `job` off the screen's thread, saying what it is doing and, if it fails, why. */
    private fun run(what: String, job: () -> Unit) {
        if (busy) return
        busy = true
        problem.text = ""
        status.text = what
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        render()
        work.execute {
            val failure = try { job(); null } catch (error: DisplayProblem) { error.message } catch (error: Exception) { error.toString() }
            ui {
                busy = false
                status.text = ""
                problem.text = failure ?: ""
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                render()
            }
        }
    }

    private fun ui(block: () -> Unit) = runOnUiThread { if (!isDestroyed) block() }

    private fun render() {
        val connected = display != null
        connectPanel.visibility = if (connected) View.GONE else View.VISIBLE
        displayPanel.visibility = if (connected) View.VISIBLE else View.GONE
        sendPanel.visibility = if (connected) View.VISIBLE else View.GONE
        listOf(connect, refresh, disconnect, choose).forEach { it.isEnabled = !busy }

        val update = sent
        val takeable = update != null && Describe.problems(update) == 0
        val reason = update?.let(Describe::stale)
        checked.visibility = if (update != null) View.VISIBLE else View.GONE
        checked.text = update?.let(Describe::checked) ?: ""
        stale.visibility = if (takeable && reason != null) View.VISIBLE else View.GONE
        stale.text = reason ?: ""
        anyway.visibility = stale.visibility
        val mayApply = takeable && !busy && (reason == null || anyway.isChecked)
        applyLater.visibility = if (takeable) View.VISIBLE else View.GONE
        applyNow.visibility = applyLater.visibility
        applyLater.isEnabled = mayApply
        applyNow.isEnabled = mayApply
        choose.text = getString(if (update != null) R.string.choose_another else R.string.choose)

        status.visibility = if (status.text.isNullOrEmpty()) View.GONE else View.VISIBLE
        problem.visibility = if (problem.text.isNullOrEmpty()) View.GONE else View.VISIBLE
        done.visibility = if (done.text.isNullOrEmpty()) View.GONE else View.VISIBLE
    }

    private fun nameOf(uri: Uri): String =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: uri.lastPathSegment ?: "the file"

    companion object {
        private const val PICK = 1
    }
}

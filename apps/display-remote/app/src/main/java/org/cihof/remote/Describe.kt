package org.cihof.remote

import org.json.JSONArray
import org.json.JSONObject

/** What the display's answers say, in the words the admin panel and the desktop portal use. */
object Describe {

    /** From /cihof/state: which app the display runs, and what it shows now. */
    fun state(state: JSONObject): String {
        val lines = mutableListOf<String>()
        val app = state.optJSONObject("app")
        if (app != null) {
            val people = app.optInt("people", 0)
            lines += "CIHOF Exhibit ${app.optString("version", "?")}" +
                (app.optString("release").takeIf { it.isNotEmpty() && it != "unknown" }?.let { ", release $it" } ?: "") +
                (if (people > 0) ", $people people" else "") + "."
        }
        val content = state.optJSONObject("content")
        if (content != null) {
            val active = content.optString("active")
            val history = content.optJSONArray("history") ?: JSONArray()
            if (content.optBoolean("onDelivered", false)) {
                lines += "It shows the content it was installed with ($active)."
            } else {
                val current = (0 until history.length()).map(history::getJSONObject).firstOrNull { it.optString("contentVersion") == active }
                lines += "It shows a content update ($active)" + (current?.let(::madeBy) ?: "") + "."
                current?.optJSONArray("summary")?.let { lines += bullets(it) }
            }
            if (history.length() > 0) {
                lines += ""
                lines += "Updates it has had, newest first:"
                for (i in 0 until history.length()) {
                    val entry = history.getJSONObject(i)
                    val applied = entry.optString("appliedAt").takeIf { it.isNotEmpty() && it != "null" }
                    lines += "• ${entry.optString("contentVersion")}${madeBy(entry)}${applied?.let { ", applied ${day(it)}" } ?: ""}"
                }
            }
        }
        return lines.joinToString("\n")
    }

    /** From POST /cihof/updates: what the display found when it checked the update. */
    fun checked(sent: JSONObject): String {
        val problems = sent.optJSONArray("problems") ?: JSONArray()
        if (problems.length() > 0) {
            return "The display will not take it: " + (0 until problems.length()).joinToString(" ") { problems.getString(it) }
        }
        val changes = sent.optJSONObject("changes")
        val lines = mutableListOf<String>()
        val films = changes?.optInt("newFilms", 0) ?: 0
        lines += "The display checked it" + (if (films > 0) "; it brings $films film${if (films == 1) "" else "s"}" else "") + "."
        if (changes != null) {
            lines += "It would show ${changes.optString("to")} in place of ${changes.optString("from")}" + madeBy(changes) + "."
            changes.optJSONArray("summary")?.let { lines += bullets(it) }
        }
        return lines.joinToString("\n")
    }

    /** The reason the display gives for an update being built on something it no longer shows, or null. */
    fun stale(sent: JSONObject): String? =
        sent.opt("stale").let { if (it is String && it.isNotEmpty()) it else null }

    fun problems(sent: JSONObject): Int = sent.optJSONArray("problems")?.length() ?: 0

    private fun madeBy(entry: JSONObject): String {
        val by = entry.optString("createdBy").takeIf { it.isNotEmpty() && it != "null" }
        val at = entry.optString("createdAt").takeIf { it.isNotEmpty() && it != "null" }
        return when {
            by != null && at != null -> ", made by $by on ${day(at)}"
            by != null -> ", made by $by"
            at != null -> ", made on ${day(at)}"
            else -> ""
        }
    }

    private fun bullets(summary: JSONArray): List<String> = (0 until summary.length()).map { "  – ${summary.optString(it)}" }

    /** "2026-11-15T14:03:00.000Z" → "2026-11-15 14:03 UTC". */
    fun day(iso: String): String =
        Regex("^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}:\\d{2})").find(iso)?.let { "${it.groupValues[1]} ${it.groupValues[2]} UTC" } ?: iso
}

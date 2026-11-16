import Foundation

/// What the display's answers say, in the words the admin panel, the desktop
/// portal and the Android remote (Describe.kt) use.
enum Describe {
    /// From /cihof/state: which app the display runs, and what it shows now.
    static func state(_ state: Answer) -> String {
        var lines: [String] = []
        if let app = state["app"] as? Answer {
            let people = int(app["people"])
            let release = text(app["release"]).flatMap { $0 == "unknown" ? nil : $0 }
            lines.append("CIHOF Exhibit \(text(app["version"]) ?? "?")"
                + (release.map { ", release \($0)" } ?? "")
                + (people > 0 ? ", \(people) people" : "") + ".")
        }
        if let content = state["content"] as? Answer {
            let active = text(content["active"]) ?? ""
            let history = content["history"] as? [Answer] ?? []
            if content["onDelivered"] as? Bool == true {
                lines.append("It shows the content it was installed with (\(active)).")
            } else {
                let current = history.first { text($0["contentVersion"]) == active }
                lines.append("It shows a content update (\(active))" + (current.map(madeBy) ?? "") + ".")
                if let summary = current?["summary"] as? [Any] { lines += bullets(summary) }
            }
            if !history.isEmpty {
                lines.append("")
                lines.append("Updates it has had, newest first:")
                for entry in history {
                    let applied = text(entry["appliedAt"])
                    lines.append("• \(text(entry["contentVersion"]) ?? "")\(madeBy(entry))\(applied.map { ", applied \(day($0))" } ?? "")")
                }
            }
        }
        return lines.joined(separator: "\n")
    }

    /// From POST /cihof/updates: what the display found when it checked the update.
    static func checked(_ sent: Answer) -> String {
        let found = problems(sent)
        if !found.isEmpty { return "The display will not take it: " + found.joined(separator: " ") }
        let changes = sent["changes"] as? Answer
        var lines: [String] = []
        let films = int(changes?["newFilms"])
        lines.append("The display checked it" + (films > 0 ? "; it brings \(films) film\(films == 1 ? "" : "s")" : "") + ".")
        if let changes {
            lines.append("It would show \(text(changes["to"]) ?? "") in place of \(text(changes["from"]) ?? "")" + madeBy(changes) + ".")
            if let summary = changes["summary"] as? [Any] { lines += bullets(summary) }
        }
        return lines.joined(separator: "\n")
    }

    /// The reason the display gives for an update being built on something it no longer shows, or nil.
    static func stale(_ sent: Answer) -> String? { text(sent["stale"]) }

    static func problems(_ sent: Answer) -> [String] { (sent["problems"] as? [Any] ?? []).map { "\($0)" } }

    private static func madeBy(_ entry: Answer) -> String {
        switch (text(entry["createdBy"]), text(entry["createdAt"])) {
        case let (by?, at?): return ", made by \(by) on \(day(at))"
        case let (by?, nil): return ", made by \(by)"
        case let (nil, at?): return ", made on \(day(at))"
        default: return ""
        }
    }

    private static func bullets(_ summary: [Any]) -> [String] { summary.map { "  – \($0)" } }

    /// A non-empty string, or nil (JSON null, missing, or "").
    private static func text(_ value: Any?) -> String? {
        guard let value = value as? String, !value.isEmpty else { return nil }
        return value
    }

    private static func int(_ value: Any?) -> Int { (value as? NSNumber)?.intValue ?? 0 }

    /// "2026-11-15T14:03:00.000Z" → "2026-11-15 14:03 UTC".
    static func day(_ iso: String) -> String {
        guard let match = iso.range(of: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"#, options: .regularExpression) else { return iso }
        let found = iso[match]
        return "\(found.prefix(10)) \(found.suffix(5)) UTC"
    }
}

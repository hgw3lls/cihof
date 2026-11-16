import Foundation

/// Something the display, or the way to it, said no to: the words are for staff.
struct DisplayProblem: LocalizedError {
    let message: String
    var stale = false
    var errorDescription: String? { message }
}

/// What the display answered: JSON, read loosely, as the Android remote reads it.
typealias Answer = [String: Any]

/// A display reached over the museum's network with the address and pairing
/// code its admin panel shows: the phone's side of apps/kiosk-app/src/
/// connection.mjs, as Display.kt is on Android and
/// apps/review/server/display-connection.mjs is the desktop portal's. It asks
/// what the display shows, sends it a display update the desktop portal made,
/// and applies it when staff choose to.
///
/// Every request is signed, and no answer is believed unless the display
/// signed it for that request.
final class Display: @unchecked Sendable {
    static let defaultPort = 5190
    /// Where a display is on its own Wi-Fi hotspot: Windows always gives it this address.
    static let ownWifi = "192.168.137.1:5190"

    let base: URL
    let name: String
    private let key: Data

    private init(base: URL, name: String, key: Data) {
        self.base = base
        self.name = name
        self.key = key
    }

    var address: String { "\(base.host ?? ""):\(base.port ?? Display.defaultPort)" }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 24 * 60 * 60
        config.waitsForConnectivity = false
        config.urlCache = nil
        return URLSession(configuration: config)
    }()

    /// "192.168.1.40:5190", "192.168.1.40" or "http://…": the address as typed.
    static func base(_ typed: String) throws -> URL {
        var text = typed.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw DisplayProblem(message: "Type the address the display's admin panel shows.") }
        if text.range(of: "^https?://", options: [.regularExpression, .caseInsensitive]) == nil { text = "http://\(text)" }
        guard var parts = URLComponents(string: text), let host = parts.host, !host.isEmpty else {
            throw DisplayProblem(message: "\(typed.trimmingCharacters(in: .whitespacesAndNewlines)) is not an address.")
        }
        parts.scheme = parts.scheme?.lowercased()
        parts.host = host.lowercased()
        if parts.port == nil { parts.port = defaultPort }
        parts.path = ""
        parts.query = nil
        parts.fragment = nil
        guard let url = parts.url else { throw DisplayProblem(message: "\(typed) is not an address.") }
        return url
    }

    /// Says hello, turns the code into the key with the display's salt, and asks what it shows.
    static func connect(address: String, code: String) async throws -> (Display, Answer) {
        let base = try base(address)
        guard !Auth.normalise(code).isEmpty else { throw DisplayProblem(message: "Type the code the display's admin panel shows.") }
        let shown = "\(base.host ?? ""):\(base.port ?? defaultPort)"
        let hello: Answer
        do {
            var request = URLRequest(url: base.appendingPathComponent("cihof/hello"))
            request.timeoutInterval = 8
            let (data, _) = try await session.data(for: request)
            hello = (try JSONSerialization.jsonObject(with: data) as? Answer) ?? [:]
        } catch {
            throw DisplayProblem(message: "No display answered at \(shown). Check the address, that this phone is on the museum's network, and that the display's staff connection is open.")
        }
        let salt = hello["salt"] as? String ?? ""
        guard hello["product"] as? String == "cihof-display", salt.range(of: "^[0-9a-f]{32}$", options: .regularExpression) != nil else {
            throw DisplayProblem(message: "Whatever answered there is not a CIHOF display.")
        }
        // scrypt takes a moment: off the main thread.
        let key = await Task.detached(priority: .userInitiated) { Auth.keyFrom(code: code, saltHex: salt) }.value
        let display = Display(base: base, name: hello["name"] as? String ?? "CIHOF display", key: key)
        return (display, try await display.state())
    }

    /// What the display shows: its app, the content version it serves, and the versions before.
    func state() async throws -> Answer {
        try await call("GET", "/cihof/state")
    }

    /// Sends an update. The display checks it and says what it would change, without applying it.
    func sendUpdate(file: URL) async throws -> Answer {
        let (sum, size): (String, Int64)
        do {
            (sum, size) = try await Task.detached(priority: .userInitiated) { try Auth.checksum(file: file) }.value
        } catch {
            throw DisplayProblem(message: "\(file.lastPathComponent) cannot be read.")
        }
        guard size > 0 else { throw DisplayProblem(message: "That file is empty: it is not a display update.") }
        return try await call("POST", "/cihof/updates", body: sum, timeout: max(60, Double(size) / 1_000_000), file: file)
    }

    /// Applies an update the display holds: shown now, or at its next reset between visitors.
    func applyUpdate(id: String, now: Bool, force: Bool) async throws -> Answer {
        guard id.range(of: "^[0-9a-f-]{36}$", options: .regularExpression) != nil else {
            throw DisplayProblem(message: "That is not an update the display gave back.")
        }
        return try await call("POST", "/cihof/updates/\(id)/apply?now=\(now ? "yes" : "no")&force=\(force ? "yes" : "no")", timeout: 10 * 60)
    }

    private func call(_ method: String, _ path: String, body: String = Auth.emptyBody, timeout: TimeInterval = 30, file: URL? = nil) async throws -> Answer {
        let headers = Auth.signRequest(key: key, method: method, path: path, body: body)
        guard let url = URL(string: base.absoluteString + path) else { throw DisplayProblem(message: "That is not a request the display knows.") }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.httpMethod = method
        for (field, value) in headers { request.setValue(value, forHTTPHeaderField: field) }
        let data: Data
        let response: URLResponse
        do {
            if let file {
                request.setValue("application/octet-stream", forHTTPHeaderField: "content-type")
                (data, response) = try await Display.session.upload(for: request, fromFile: file)
            } else {
                (data, response) = try await Display.session.data(for: request)
            }
        } catch {
            throw DisplayProblem(message: "The display stopped answering. Its staff connection may have closed: look at its admin panel. (\(error.localizedDescription))")
        }
        guard let http = response as? HTTPURLResponse else { throw DisplayProblem(message: "The display's answer could not be read.") }
        let signed = Auth.responseIsSigned(
            key: key, nonce: headers[Auth.nonceHeader]!, status: http.statusCode,
            signature: http.value(forHTTPHeaderField: Auth.signatureHeader), claimedBody: http.value(forHTTPHeaderField: Auth.bodyHeader),
            body: Auth.checksum(data)
        )
        guard signed else {
            throw DisplayProblem(message: http.statusCode == 401
                ? "The display did not accept the pairing code. Check it against the one its admin panel shows now: it changes each time the connection is opened. Check too that this phone shows the right time."
                : "The answer did not come from the display: it was not signed with the pairing code.")
        }
        guard let value = (try? JSONSerialization.jsonObject(with: data)) as? Answer else {
            throw DisplayProblem(message: "The display's answer could not be read.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw DisplayProblem(message: value["error"] as? String ?? "The display said no (\(http.statusCode)).", stale: value["stale"] as? Bool == true)
        }
        return value
    }
}

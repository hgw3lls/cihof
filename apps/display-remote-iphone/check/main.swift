import Foundation

// The iPhone remote's own code (Auth, Display, Describe), run on this Mac and checked against
// the display's: signatures made by apps/kiosk-app/src/connection-auth.mjs, and a real staff
// connection from apps/kiosk-app/src/connection.mjs, both by apps/display-remote/scripts/
// test-display.mjs, which the Android remote's tests (DisplayTest.kt) use too. Run by check/run.sh.

let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let script = root.appendingPathComponent("apps/display-remote/scripts/test-display.mjs").path
var failures = 0

func expect(_ ok: Bool, _ what: String) {
    print("\(ok ? "ok  " : "FAIL") \(what)")
    if !ok { failures += 1 }
}

func node(_ mode: String) throws -> (Process, Pipe, Pipe) {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["node", script, mode]
    process.currentDirectoryURL = root
    let output = Pipe(), input = Pipe()
    process.standardOutput = output
    process.standardInput = input
    try process.run()
    return (process, output, input)
}

func firstLine(_ pipe: Pipe) -> String {
    var bytes = Data()
    while true {
        let one = pipe.fileHandleForReading.readData(ofLength: 1)
        if one.isEmpty || one == Data("\n".utf8) { break }
        bytes.append(one)
    }
    return String(decoding: bytes, as: UTF8.self)
}

func refused(_ what: String, _ check: (DisplayProblem) -> Bool, _ job: () async throws -> Void) async {
    do {
        try await job()
        expect(false, what)
    } catch let problem as DisplayProblem {
        expect(check(problem), "\(what): \(problem.message)")
    } catch {
        expect(false, "\(what): \(error)")
    }
}

// 1. Keys and signatures are the display's.
let (vectorsProcess, vectorsOut, _) = try node("vectors")
let vectorsData = vectorsOut.fileHandleForReading.readDataToEndOfFile()
vectorsProcess.waitUntilExit()
let vectors = try JSONSerialization.jsonObject(with: vectorsData) as! [String: Any]
let salt = vectors["salt"] as! String
let started = Date()
let key = Auth.keyFrom(code: vectors["code"] as! String, saltHex: salt)
print(String(format: "     scrypt took %.2f s", Date().timeIntervalSince(started)))
expect(key.hex == vectors["key"] as? String, "the code typed in lower case with a space is the same code")
expect(Auth.emptyBody == vectors["empty"] as? String, "the empty body's checksum")
let body = vectors["body"] as! String
expect(Auth.checksum(Data(#"{"hello":"display"}"#.utf8)) == body, "a body's checksum")
let request = vectors["request"] as! [String: String]
let nonce = request[Auth.nonceHeader]!
let signed = Auth.signRequest(key: key, method: "post", path: "/cihof/updates/x/apply?now=no&force=no", body: body, now: Date(timeIntervalSince1970: 1_700_000_000), nonce: nonce)
expect(signed[Auth.signatureHeader] == request[Auth.signatureHeader], "a request is signed as the display checks it")
expect(signed[Auth.timeHeader] == request[Auth.timeHeader], "its time is in milliseconds")
let response = vectors["response"] as! [String: String]
let signature = response[Auth.signatureHeader], claimed = response[Auth.bodyHeader]
expect(Auth.responseIsSigned(key: key, nonce: nonce, status: 409, signature: signature, claimedBody: claimed, body: body), "the display's answer is believed")
expect(!Auth.responseIsSigned(key: key, nonce: nonce, status: 200, signature: signature, claimedBody: claimed, body: body), "not with another status")
expect(!Auth.responseIsSigned(key: key, nonce: nonce, status: 409, signature: signature, claimedBody: claimed, body: Auth.emptyBody), "not with another body")
expect(!Auth.responseIsSigned(key: Auth.keyFrom(code: "AAAA-AAAA", saltHex: salt), nonce: nonce, status: 409, signature: signature, claimedBody: claimed, body: body), "not with another key")
expect(!Auth.responseIsSigned(key: key, nonce: nonce, status: 409, signature: nil, claimedBody: nil, body: body), "not unsigned")

// 2. An address is read as the desktop portal reads it.
expect((try? Display.base(" 192.168.1.40 "))?.absoluteString == "http://192.168.1.40:5190", "an address without a port")
expect((try? Display.base("192.168.1.40:6000"))?.absoluteString == "http://192.168.1.40:6000", "an address with a port")
expect((try? Display.base("HTTP://display.local"))?.absoluteString == "http://display.local:5190", "an address with a scheme")
expect((try? Display.base("")) == nil, "no address")
expect(Display.ownWifi == "192.168.137.1:5190", "the display's own Wi-Fi")

// 3. A real staff connection.
let (display, displayOut, displayIn) = try node("serve")
let opened = try JSONSerialization.jsonObject(with: Data(firstLine(displayOut).utf8)) as! [String: Any]
let port = (opened["port"] as! NSNumber).intValue
let code = opened["code"] as! String
let address = "127.0.0.1:\(port)"
let scratch = FileManager.default.temporaryDirectory.appendingPathComponent("cihof-iphone-check-\(UUID().uuidString)")
try FileManager.default.createDirectory(at: scratch, withIntermediateDirectories: true)
func file(_ name: String, _ text: String) throws -> URL {
    let url = scratch.appendingPathComponent(name)
    try Data(text.utf8).write(to: url)
    return url
}

await refused("the wrong code is refused", { $0.message.contains("did not accept the pairing code") }) {
    _ = try await Display.connect(address: address, code: code.hasPrefix("A") ? "BBBB-BBBB" : "AAAA-AAAA")
}
await refused("nothing there says so", { $0.message.hasPrefix("No display answered at 127.0.0.1:1") }) {
    _ = try await Display.connect(address: "127.0.0.1:1", code: code)
}
let (unsignedData, unsignedResponse) = try await URLSession.shared.data(from: URL(string: "http://\(address)/cihof/state")!)
expect((unsignedResponse as? HTTPURLResponse)?.statusCode == 401 && !unsignedData.isEmpty, "an unsigned request is refused")

do {
    // The code as somebody might type it.
    let (remote, state) = try await Display.connect(address: address, code: code.lowercased().replacingOccurrences(of: "-", with: " "))
    expect(remote.name == "Test display", "connects, and knows the display's name")
    let described = Describe.state(state)
    expect(described.hasPrefix("CIHOF Exhibit 9.9.9, release abc1234, 93 people."), "says what it shows: \(described.split(separator: "\n").first ?? "")")

    let broken = try await remote.sendUpdate(file: try file("broken.cihof", "broken update"))
    expect(Describe.problems(broken).count == 1, "a broken update has a problem")
    expect(Describe.checked(broken) == "The display will not take it: It is broken.", "and says so")

    let stale = try await remote.sendUpdate(file: try file("stale.cihof", "stale update"))
    expect(Describe.stale(stale)?.contains("no longer shows") == true, "a stale update says so")
    await refused("a stale update is not applied without being told to", { $0.stale }) {
        _ = try await remote.applyUpdate(id: stale["id"] as! String, now: false, force: false)
    }

    let good = try await remote.sendUpdate(file: try file("good.cihof", "a good update"))
    expect(Describe.stale(good) == nil, "a good update is not stale")
    expect(Describe.checked(good) == """
        The display checked it; it brings 1 film.
        It would show content-bbbb in place of content-aaaa, made by Jane Smith on 2026-11-15 14:03 UTC.
          – Changed a biography.
        """, "says what a good update would change")
    let applied = try await remote.applyUpdate(id: good["id"] as! String, now: false, force: false)
    expect(applied["applied"] as? Bool == true, "applies it")
    await refused("the same update is not applied twice", { $0.message.contains("not here any more") }) {
        _ = try await remote.applyUpdate(id: good["id"] as! String, now: false, force: false)
    }
    let after = Describe.state(try await remote.state())
    expect(after.contains("It shows a content update (content-bbbb), made by Jane Smith on 2026-11-15 14:03 UTC."), "the display now shows it")
    expect(after.contains("now=false force=false"), "applied at the next reset, not forced")
} catch {
    expect(false, "the staff connection: \(error.localizedDescription)")
}

try? displayIn.fileHandleForWriting.close()
display.waitUntilExit()
try? FileManager.default.removeItem(at: scratch)
print(failures == 0 ? "All checks passed." : "\(failures) check(s) failed.")
exit(failures == 0 ? 0 : 1)

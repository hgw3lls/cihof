import CommonCrypto
import CryptoKit
import Foundation

/// How this phone and a display prove themselves to each other: the same
/// scheme as apps/kiosk-app/src/connection-auth.mjs, which the display and the
/// desktop staff portal share, and apps/display-remote/…/Auth.kt on Android.
/// Change one, change them all; `check/run.sh` checks this file against the
/// display's own code.
///
/// The pairing code never crosses the network. Each side turns it into a key
/// with the salt the display chose when its connection was opened, and signs
/// every request and every answer with that key.
enum Auth {
    static let timeHeader = "x-cihof-time"
    static let nonceHeader = "x-cihof-nonce"
    static let bodyHeader = "x-cihof-body"
    static let signatureHeader = "x-cihof-signature"

    static let emptyBody = checksum(Data())

    /// The code as typed: case, spaces and the dash do not matter.
    static func normalise(_ code: String) -> String {
        String(code.uppercased().unicodeScalars.filter { ("0"..."9").contains($0) || ("A"..."Z").contains($0) }.map(Character.init))
    }

    /// scrypt(code, salt), N = 2^15, r = 8, p = 1, 32 bytes: as keyFrom() on the display.
    /// About a second and 32 MB on a phone (much longer in a debug build).
    static func keyFrom(code: String, saltHex: String) -> Data {
        let password = Array(normalise(code).utf8)
        return Data(Scrypt.derive(password: password, salt: [UInt8](Data(hex: saltHex) ?? Data()), n: 1 << 15, r: 8, p: 1, length: 32))
    }

    static func newNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).hex
    }

    static func checksum(_ body: Data) -> String {
        Data(SHA256.hash(data: body)).hex
    }

    /// The checksum of a file, read a piece at a time, and how long it is.
    static func checksum(file: URL) throws -> (sum: String, size: Int64) {
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var hash = SHA256()
        var size: Int64 = 0
        while let piece = try handle.read(upToCount: 1 << 20), !piece.isEmpty {
            hash.update(data: piece)
            size += Int64(piece.count)
        }
        return (Data(hash.finalize()).hex, size)
    }

    private static func mac(_ key: Data, _ text: String) -> String {
        Data(HMAC<SHA256>.authenticationCode(for: Data(text.utf8), using: SymmetricKey(data: key))).hex
    }

    static func requestText(method: String, path: String, time: Int64, nonce: String, body: String) -> String {
        ["request", method.uppercased(), path, String(time), nonce, body].joined(separator: "\n")
    }

    static func responseText(nonce: String, status: Int, body: String) -> String {
        ["response", nonce, String(status), body].joined(separator: "\n")
    }

    /// The headers that sign a request. `body` is the body's checksum.
    static func signRequest(key: Data, method: String, path: String, body: String = emptyBody, now: Date = Date(), nonce: String = newNonce()) -> [String: String] {
        let time = Int64((now.timeIntervalSince1970 * 1000).rounded())
        return [
            timeHeader: String(time),
            nonceHeader: nonce,
            bodyHeader: body,
            signatureHeader: mac(key, requestText(method: method, path: path, time: time, nonce: nonce, body: body)),
        ]
    }

    /// Whether an answer carries the display's signature for this request and this body.
    static func responseIsSigned(key: Data, nonce: String, status: Int, signature: String?, claimedBody: String?, body: String) -> Bool {
        guard let signature, signature.count == 64, signature.allSatisfy({ $0.isHexDigit && !$0.isUppercase }), claimedBody == body else { return false }
        let expected = mac(key, responseText(nonce: nonce, status: status, body: body))
        // Compared in constant time.
        return zip(expected.utf8, signature.utf8).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }
}

/// scrypt (RFC 7914), as Node's crypto.scryptSync computes it.
enum Scrypt {
    static func derive(password: [UInt8], salt: [UInt8], n: Int, r: Int, p: Int, length: Int) -> [UInt8] {
        let blockBytes = 128 * r
        var b = pbkdf2(password: password, salt: salt, length: p * blockBytes)
        let words = 32 * r
        var x = [UInt32](repeating: 0, count: words)
        var y = [UInt32](repeating: 0, count: words)
        var v = [UInt32](repeating: 0, count: words * n)
        for chunk in 0..<p {
            let offset = chunk * blockBytes
            for i in 0..<words {
                let at = offset + i * 4
                x[i] = UInt32(b[at]) | UInt32(b[at + 1]) << 8 | UInt32(b[at + 2]) << 16 | UInt32(b[at + 3]) << 24
            }
            x.withUnsafeMutableBufferPointer { xp in
                y.withUnsafeMutableBufferPointer { yp in
                    v.withUnsafeMutableBufferPointer { vp in
                        for i in 0..<n {
                            (vp.baseAddress! + i * words).update(from: xp.baseAddress!, count: words)
                            blockMix(xp.baseAddress!, yp.baseAddress!, r)
                        }
                        for _ in 0..<n {
                            let j = Int(xp[(2 * r - 1) * 16]) & (n - 1)
                            let row = vp.baseAddress! + j * words
                            for k in 0..<words { xp[k] ^= row[k] }
                            blockMix(xp.baseAddress!, yp.baseAddress!, r)
                        }
                    }
                }
            }
            for i in 0..<words {
                let at = offset + i * 4
                b[at] = UInt8(truncatingIfNeeded: x[i])
                b[at + 1] = UInt8(truncatingIfNeeded: x[i] >> 8)
                b[at + 2] = UInt8(truncatingIfNeeded: x[i] >> 16)
                b[at + 3] = UInt8(truncatingIfNeeded: x[i] >> 24)
            }
        }
        return pbkdf2(password: password, salt: b, length: length)
    }

    private static func pbkdf2(password: [UInt8], salt: [UInt8], length: Int) -> [UInt8] {
        var out = [UInt8](repeating: 0, count: length)
        password.withUnsafeBufferPointer { pw in
            pw.baseAddress!.withMemoryRebound(to: CChar.self, capacity: max(pw.count, 1)) { chars in
                _ = CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), chars, pw.count, salt, salt.count, CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), 1, &out, length)
            }
        }
        return out
    }

    /// BlockMix with Salsa20/8, in place on b (32r words), using y as scratch.
    /// Plain words and pointers, nothing allocated: it runs a million times per key.
    private static func blockMix(_ b: UnsafeMutablePointer<UInt32>, _ y: UnsafeMutablePointer<UInt32>, _ r: Int) {
        let last = b + (2 * r - 1) * 16
        var x0 = last[0], x1 = last[1], x2 = last[2], x3 = last[3], x4 = last[4], x5 = last[5], x6 = last[6], x7 = last[7]
        var x8 = last[8], x9 = last[9], x10 = last[10], x11 = last[11], x12 = last[12], x13 = last[13], x14 = last[14], x15 = last[15]
        for i in 0..<(2 * r) {
            let block = b + i * 16
            x0 ^= block[0]; x1 ^= block[1]; x2 ^= block[2]; x3 ^= block[3]; x4 ^= block[4]; x5 ^= block[5]; x6 ^= block[6]; x7 ^= block[7]
            x8 ^= block[8]; x9 ^= block[9]; x10 ^= block[10]; x11 ^= block[11]; x12 ^= block[12]; x13 ^= block[13]; x14 ^= block[14]; x15 ^= block[15]
            // Salsa20/8 of x, added to x.
            var a0 = x0, a1 = x1, a2 = x2, a3 = x3, a4 = x4, a5 = x5, a6 = x6, a7 = x7
            var a8 = x8, a9 = x9, a10 = x10, a11 = x11, a12 = x12, a13 = x13, a14 = x14, a15 = x15
            for _ in 0..<4 {
                a4 ^= rotl(a0 &+ a12, 7); a8 ^= rotl(a4 &+ a0, 9); a12 ^= rotl(a8 &+ a4, 13); a0 ^= rotl(a12 &+ a8, 18)
                a9 ^= rotl(a5 &+ a1, 7); a13 ^= rotl(a9 &+ a5, 9); a1 ^= rotl(a13 &+ a9, 13); a5 ^= rotl(a1 &+ a13, 18)
                a14 ^= rotl(a10 &+ a6, 7); a2 ^= rotl(a14 &+ a10, 9); a6 ^= rotl(a2 &+ a14, 13); a10 ^= rotl(a6 &+ a2, 18)
                a3 ^= rotl(a15 &+ a11, 7); a7 ^= rotl(a3 &+ a15, 9); a11 ^= rotl(a7 &+ a3, 13); a15 ^= rotl(a11 &+ a7, 18)
                a1 ^= rotl(a0 &+ a3, 7); a2 ^= rotl(a1 &+ a0, 9); a3 ^= rotl(a2 &+ a1, 13); a0 ^= rotl(a3 &+ a2, 18)
                a6 ^= rotl(a5 &+ a4, 7); a7 ^= rotl(a6 &+ a5, 9); a4 ^= rotl(a7 &+ a6, 13); a5 ^= rotl(a4 &+ a7, 18)
                a11 ^= rotl(a10 &+ a9, 7); a8 ^= rotl(a11 &+ a10, 9); a9 ^= rotl(a8 &+ a11, 13); a10 ^= rotl(a9 &+ a8, 18)
                a12 ^= rotl(a15 &+ a14, 7); a13 ^= rotl(a12 &+ a15, 9); a14 ^= rotl(a13 &+ a12, 13); a15 ^= rotl(a14 &+ a13, 18)
            }
            x0 = x0 &+ a0; x1 = x1 &+ a1; x2 = x2 &+ a2; x3 = x3 &+ a3; x4 = x4 &+ a4; x5 = x5 &+ a5; x6 = x6 &+ a6; x7 = x7 &+ a7
            x8 = x8 &+ a8; x9 = x9 &+ a9; x10 = x10 &+ a10; x11 = x11 &+ a11; x12 = x12 &+ a12; x13 = x13 &+ a13; x14 = x14 &+ a14; x15 = x15 &+ a15
            // Even blocks first, then odd ones.
            let to = y + (i % 2 == 0 ? i / 2 : r + i / 2) * 16
            to[0] = x0; to[1] = x1; to[2] = x2; to[3] = x3; to[4] = x4; to[5] = x5; to[6] = x6; to[7] = x7
            to[8] = x8; to[9] = x9; to[10] = x10; to[11] = x11; to[12] = x12; to[13] = x13; to[14] = x14; to[15] = x15
        }
        b.update(from: y, count: 32 * r)
    }

    @inline(__always)
    private static func rotl(_ a: UInt32, _ n: UInt32) -> UInt32 { (a << n) | (a >> (32 - n)) }
}

extension Data {
    var hex: String { map { String(format: "%02x", $0) }.joined() }

    init?(hex: String) {
        guard hex.count % 2 == 0 else { return nil }
        var bytes = [UInt8]()
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<next], radix: 16) else { return nil }
            bytes.append(byte)
            index = next
        }
        self.init(bytes)
    }
}

# CIHOF Display Remote (iPhone)

The iPhone version of *CIHOF Display Remote* (the Android one is
`apps/display-remote`). It does the same and no more: on the museum's
network, or on a display's own Wi-Fi, it reaches the display's staff
connection (`apps/kiosk-app/src/connection.mjs`) with the address and code
its admin panel shows, shows what the display shows, and sends it a display
update made in the staff portal, which the display checks before anybody
chooses to apply it. It edits, decides and publishes nothing, keeps the
pairing code only in memory, and remembers only the address.

Staff use it as `docs/training/display-remote.md` says.

| File | What it is |
| --- | --- |
| `CIHOFRemote/Auth.swift` | The signing, as `connection-auth.mjs` does it: scrypt from the code and the display's salt, every request and answer signed. Must stay in step with it (and with `Auth.kt`). |
| `CIHOFRemote/Display.swift` | The display's staff connection: hello, state, send an update, apply it. As `Display.kt`. |
| `CIHOFRemote/Describe.swift` | The display's answers in staff words. As `Describe.kt`. |
| `CIHOFRemote/RemoteApp.swift` | The one screen. |
| `check/` | Runs the three files above on a Mac against the display's own code. |

It began as the old *CIHOF Staff* iPhone app (repository `cihof-handover`,
`apps/staff-iphone`), which paired once with a display that served the staff
portal itself. The display no longer does either, so this app keeps that
app's scrypt and icon and otherwise follows the Android remote.

## Checking it

```sh
npm run test:display-remote-iphone
```

builds `Auth`, `Display` and `Describe` for this Mac, optimised as a release
build is, and checks them against `apps/display-remote/scripts/test-display.mjs`
(the Android tests' stand-in): signatures made by `connection-auth.mjs`, and a
real staff connection from `connection.mjs` that it connects to, sends broken,
stale and good updates, and applies one. Needs Xcode (or its command line
tools) and Node.

## Trying it in the Simulator

```sh
node apps/display-remote/scripts/test-display.mjs serve
```

prints the port and code of a stand-in display (it runs until stdin closes).
Open `CIHOFRemote.xcodeproj` in Xcode, run it on an iPhone simulator, and
connect to `127.0.0.1:<port>` with that code. To have an update to send, put
a file in the Simulator's Files app (**On My iPhone**): one whose text has
`broken` in it is refused, `stale` is made from an earlier version, anything
else is a good update.

## Getting it onto staff phones (TestFlight)

It needs an Apple Developer Program membership (the museum's, ideally: 99 USD
a year) and Xcode on a Mac. Uploading a build hands it to Apple: do it only
when the museum has asked for it.

1. In Xcode, open `CIHOFRemote.xcodeproj`, select the **CIHOFRemote** target,
   **Signing & Capabilities**: choose the team. If Apple says the bundle
   identifier `org.cihof.remote` is taken, change it to one of the team's own
   (for example `org.wrhs.cihof.remote`).
2. In App Store Connect (appstoreconnect.apple.com): **Apps › +, New App**,
   iOS, name *CIHOF Display Remote*, that bundle identifier.
3. In Xcode: choose **Any iOS Device (arm64)**, **Product › Archive**, then in
   the Organizer **Distribute App › TestFlight Internal Only**, and upload.
4. In App Store Connect, **TestFlight**: add staff as internal testers (they
   need to be on the team in **Users and Access**). Each person installs
   Apple's **TestFlight** app and accepts the invitation.

Internal testing only: the app is never put in the public App Store, and an
external TestFlight group would send it to Apple's review. A TestFlight build
lasts 90 days: upload a new build (step 3, with **CURRENT_PROJECT_VERSION**
one higher) before then. The app declares that it uses no encryption beyond
authentication (`ITSAppUsesNonExemptEncryption`), so App Store Connect asks
no export questions.

Without a membership, Xcode can put it on one plugged-in iPhone with a free
Apple ID (**Signing & Capabilities**, the personal team, then run on the
phone); such a build stops opening after seven days.

The phone must be on the museum's network, or on the display's own Wi-Fi,
to reach the display: the app asks for **Local Network** access the first
time, and needs it.

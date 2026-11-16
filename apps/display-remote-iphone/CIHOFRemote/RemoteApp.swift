import SwiftUI
import UniformTypeIdentifiers

/// CIHOF Display Remote on an iPhone: the same app as the Android one
/// (apps/display-remote). A phone on the museum's network reaches a display's
/// staff connection, shows what the display shows, and sends it a display
/// update made in the desktop staff portal, which the display checks exactly
/// as one loaded from a USB stick before anybody chooses to apply it.
///
/// It decides nothing and edits nothing. The pairing code is kept only in
/// memory, for as long as the app is open; only the address is remembered.
@main
struct RemoteApp: App {
    var body: some Scene {
        WindowGroup {
            RemoteView().tint(Color("AccentColor"))
        }
    }
}

struct RemoteView: View {
    @AppStorage("address") private var address = ""
    @State private var code = ""
    @State private var display: Display?
    @State private var shown = ""
    @State private var sent: Answer?
    @State private var anyway = false
    @State private var choosing = false
    @State private var confirmNow = false
    @State private var status = ""
    @State private var problem = ""
    @State private var done = ""
    @FocusState private var field: Field?
    private enum Field { case address, code }
    private enum Spot { case checked, messages }

    private var busy: Bool { !status.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollViewReader { scroller in
                Form {
                    Section {
                        Text("Reach a display over the museum's network: see what it shows, and send it a display update made in the staff portal. This phone changes nothing else.")
                            .foregroundStyle(.secondary)
                    }
                    if let display {
                        connected(display)
                        sendSection
                    } else {
                        connectSection
                    }
                    messages
                }
                // What the display said, brought into view: it lands below the fold on a phone.
                .onChange(of: sent.map(Describe.checked)) { _, now in
                    if now != nil { withAnimation { scroller.scrollTo(Spot.checked, anchor: .top) } }
                }
                .onChange(of: problem + done) { _, now in
                    if !now.isEmpty { withAnimation { scroller.scrollTo(Spot.messages, anchor: .bottom) } }
                }
            }
            .navigationTitle("Display Remote")
            .disabled(busy)
            .fileImporter(isPresented: $choosing, allowedContentTypes: [.item]) { result in
                switch result {
                case .success(let file): send(file)
                case .failure(let error): problem = error.localizedDescription
                }
            }
        }
    }

    // MARK: Connecting

    private var connectSection: some View {
        Section {
            Text("On the display, open the admin panel, then Staff connection, and Open a staff connection. Type the address and the code it shows. This phone must be on the museum's network, or on the display's own Wi-Fi.")
                .font(.subheadline).foregroundStyle(.secondary)
            Text("Opened on the display's own Wi-Fi? Join that Wi-Fi on this phone first (Settings, Wi-Fi), with the name and password the display shows, then choose On the display's own Wi-Fi and type only the code.")
                .font(.subheadline).foregroundStyle(.secondary)
            LabeledContent("Address") {
                TextField("192.168.1.40:5190", text: $address)
                    .keyboardType(.numbersAndPunctuation)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .multilineTextAlignment(.trailing)
                    .focused($field, equals: .address)
                    .submitLabel(.next)
                    .onSubmit { field = .code }
            }
            Button("On the display's own Wi-Fi") {
                address = Display.ownWifi
                field = .code
            }
            LabeledContent("Code") {
                TextField("K7RM-4QXP", text: $code)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.system(.title3, design: .monospaced))
                    .multilineTextAlignment(.trailing)
                    .focused($field, equals: .code)
                    .submitLabel(.go)
                    .onSubmit(connect)
            }
            Button("Connect", action: connect)
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
        } header: {
            Text("Connect to a display")
        }
    }

    private func connect() {
        let typed = address
        let typedCode = code
        field = nil
        run("Connecting… working out the key from the code takes a moment.") {
            let (next, state) = try await Display.connect(address: typed, code: typedCode)
            address = typed.trimmingCharacters(in: .whitespacesAndNewlines)
            display = next
            code = ""
            show(state)
        }
    }

    private func connected(_ display: Display) -> some View {
        Section {
            Text("At \(display.address).")
            Text(shown).font(.callout).textSelection(.enabled)
            Button("Ask it again") {
                run("Asking the display…") { show(try await display.state()) }
            }
            Button("Disconnect", role: .destructive) {
                self.display = nil
                sent = nil
                shown = ""
                done = ""
                problem = ""
            }
        } header: {
            Text("Connected to \(display.name)")
        }
    }

    private func show(_ state: Answer) {
        shown = Describe.state(state)
    }

    // MARK: Sending an update

    private var sendSection: some View {
        Section {
            Text("Choose a display update (a .cihof file) made with Make a display update in the staff portal and saved to this phone (Files, or sent by AirDrop), or to a drive it can reach. The display checks it, and says what it would change, before anything is applied.")
                .font(.subheadline).foregroundStyle(.secondary)
            Button(sent == nil ? "Choose a display update…" : "Choose another…") { choosing = true }
            if let sent {
                Text(Describe.checked(sent)).font(.callout).id(Spot.checked)
                if Describe.problems(sent).isEmpty {
                    let reason = Describe.stale(sent)
                    if let reason {
                        Text(reason).font(.callout).foregroundStyle(.orange)
                        Toggle("Apply it anyway, replacing what changed on the display since.", isOn: $anyway)
                    }
                    let mayApply = reason == nil || anyway
                    Button("Apply at the next reset") { apply(now: false) }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity)
                        .disabled(!mayApply)
                    Button("Apply and show now") { confirmNow = true }
                        .disabled(!mayApply)
                        .confirmationDialog("Apply and show now", isPresented: $confirmNow, titleVisibility: .visible) {
                            Button("Apply and show now") { apply(now: true) }
                            Button("Cancel", role: .cancel) {}
                        } message: {
                            Text("Show it now? Only if nobody is using the display: whoever is will be taken back to the start.")
                        }
                }
            }
        } header: {
            Text("Put a display update on it")
        }
    }

    private func send(_ file: URL) {
        guard let display else { return }
        let name = file.lastPathComponent
        sent = nil
        done = ""
        run("Sending \(name) to the display… keep this app open until it is done.") {
            let reading = file.startAccessingSecurityScopedResource()
            defer { if reading { file.stopAccessingSecurityScopedResource() } }
            let outcome = try await display.sendUpdate(file: file)
            anyway = false
            sent = outcome
        }
    }

    private func apply(now: Bool) {
        guard let display, let id = sent?["id"] as? String else { return }
        let force = anyway
        run("Applying it on the display…") {
            _ = try await display.applyUpdate(id: id, now: now, force: force)
            let state = try await display.state()
            sent = nil
            done = now
                ? "✓ Applied. The display is showing it now. Go and look at it."
                : "✓ Applied. The display takes it over at its next reset between visitors."
            show(state)
        }
    }

    // MARK: Saying what is happening

    @ViewBuilder private var messages: some View {
        if !status.isEmpty || !problem.isEmpty || !done.isEmpty {
            Section {
                if !status.isEmpty {
                    HStack(spacing: 10) { ProgressView(); Text(status).foregroundStyle(.secondary) }
                }
                if !problem.isEmpty { Text(problem).foregroundStyle(.red) }
                if !done.isEmpty { Text(done).foregroundStyle(.green) }
            }
            .id(Spot.messages)
        }
    }

    /// Runs `job`, saying what it is doing and, if it fails, why. The screen stays on meanwhile.
    private func run(_ what: String, _ job: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        problem = ""
        status = what
        UIApplication.shared.isIdleTimerDisabled = true
        Task { @MainActor in
            do { try await job() } catch { problem = error.localizedDescription }
            status = ""
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }
}

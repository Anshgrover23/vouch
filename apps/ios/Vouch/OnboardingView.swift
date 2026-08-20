import SwiftUI

struct OnboardingView: View {
  @Environment(SessionStore.self) private var session
  @State private var screen = Screen.pick
  @State private var groupName = ""
  @State private var busy = false

  enum Screen { case pick, group }

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ScrollView {
          VStack(alignment: .leading, spacing: 18) {
            HStack {
              Text("VOUCH")
                .font(.system(size: 14, weight: .heavy, design: .rounded))
              Spacer()
              Button("Skip") { Task { await finish(path: "skip") } }
                .font(.system(size: 14, weight: .heavy, design: .rounded))
                .foregroundStyle(VouchColor.ink)
            }
            if let error = session.error {
              Text(error).foregroundStyle(VouchColor.pink).font(.system(size: 14, weight: .semibold))
            }
            if screen == .pick {
              Text("first receipt")
                .font(.system(size: 12, weight: .heavy, design: .monospaced))
                .tracking(1)
              Text("How do you split?")
                .font(.system(size: 32, weight: .heavy, design: .rounded))
              Text("A house tab you reuse, or a one-off photo. Skip and snap a receipt now.")
                .foregroundStyle(VouchColor.ink2)
              pathCard("PATH 01", "Group expense", "Name the house. Invite people later. Receipts land in one place.") {
                screen = .group
              }
              pathCard("PATH 02", "One-off receipt", "Snap this grocery run. No group required.") {
                Task { await finish(path: "one-off") }
              }
            } else {
              Text("name the house")
                .font(.system(size: 12, weight: .heavy, design: .monospaced))
              Text("What should we call this group?")
                .font(.system(size: 28, weight: .heavy, design: .rounded))
              VouchField(label: "Group name", placeholder: "412 Oak", text: $groupName)
              VouchButton(title: "Continue", kind: .primary, busy: busy) {
                Task { await finish(path: "group", groupName: groupName) }
              }
              VouchButton(title: "Back", kind: .ghost) { screen = .pick }
            }
          }
          .padding(24)
          .foregroundStyle(VouchColor.ink)
        }
      }
    }
  }

  private func pathCard(_ mono: String, _ title: String, _ lede: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VStack(alignment: .leading, spacing: 8) {
        Text(mono).font(.system(size: 11, weight: .heavy, design: .monospaced))
        Text(title).font(.system(size: 22, weight: .heavy, design: .rounded))
        Text(lede).font(.system(size: 15, weight: .medium)).foregroundStyle(VouchColor.ink2).multilineTextAlignment(.leading)
      }
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(VouchColor.paper2)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 3))
      .background(VouchColor.ink.offset(x: 6, y: 6))
    }
    .buttonStyle(.plain)
    .disabled(busy)
    .padding(.bottom, 8)
  }

  private func finish(path: String, groupName: String? = nil) async {
    busy = true
    defer { busy = false }
    _ = await session.onboard(path: path, groupName: groupName)
  }
}

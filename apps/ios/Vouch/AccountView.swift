import SwiftUI

struct AccountView: View {
  @Environment(SessionStore.self) private var session
  @State private var email = ""
  @State private var name = ""
  @State private var busy = false

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ScrollView {
          VStack(spacing: 14) {
            VouchCard {
              VStack(alignment: .leading, spacing: 12) {
                accountRow(label: "Name", value: displayName)
                Divider().overlay(VouchColor.ink.opacity(0.2))
                accountRow(label: "Email", value: displayEmail)
              }
            }
            VouchCard {
              Text("Guest links still open on the web. Push notifications wait on a paid Apple Developer team.")
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundStyle(VouchColor.ink2)
            }
            Button {
              Task { await session.signOut() }
            } label: {
              VouchCard {
                Text("Sign out")
                  .font(.system(size: 16, weight: .heavy, design: .rounded))
                  .foregroundStyle(VouchColor.pink)
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
            }
            .buttonStyle(.plain)
            .disabled(busy)
          }
          .padding(.horizontal, 20)
          .padding(.top, 8)
          .padding(.bottom, 24)
        }
      }
      .navigationTitle("Account")
      .toolbarBackground(VouchColor.paper, for: .navigationBar)
      .task { await load() }
    }
  }

  private var displayName: String {
    name.isEmpty ? (session.session?.displayName ?? "—") : name
  }

  private var displayEmail: String {
    email.isEmpty ? (session.session?.email ?? "—") : email
  }

  private func accountRow(label: String, value: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
      Text(label)
        .font(.system(size: 15, weight: .semibold, design: .rounded))
        .foregroundStyle(VouchColor.ink2)
      Spacer()
      Text(value)
        .font(.system(size: 15, weight: .heavy, design: .rounded))
        .foregroundStyle(VouchColor.ink)
        .multilineTextAlignment(.trailing)
    }
  }

  private func load() async {
    busy = true
    defer { busy = false }
    if let env: AccountEnvelope = try? await APIClient.shared.get("/api/account") {
      email = env.account?.email ?? ""
      name = env.account?.displayName ?? ""
    }
  }
}

import SwiftUI

struct LandingView: View {
  @State private var auth: AuthKind?

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ViewThatFits(in: .vertical) {
          screen(flexibleHero: true)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
          ScrollView(showsIndicators: false) {
            screen(flexibleHero: false)
          }
        }
      }
      .sheet(item: $auth) { kind in
        AuthSheet(kind: kind)
          .presentationDragIndicator(.visible)
      }
    }
  }

  private func screen(flexibleHero: Bool) -> some View {
    VStack(spacing: 0) {
      header
      copyBlock
      if flexibleHero {
        Spacer(minLength: 16)
        hero
          .frame(maxHeight: .infinity)
        Spacer(minLength: 16)
      } else {
        hero
          .padding(.vertical, 20)
      }
      stickersRow
        .padding(.bottom, 18)
      ctaBlock
    }
  }

  private var header: some View {
    HStack(spacing: 10) {
      VouchMark(size: 28)
      Text("Vouch")
        .font(.system(size: 20, weight: .heavy, design: .rounded))
        .foregroundStyle(VouchColor.ink)
      Spacer()
    }
    .padding(.horizontal, 24)
    .padding(.top, 4)
  }

  private var copyBlock: some View {
    VStack(alignment: .leading, spacing: 10) {
      VouchBadge(text: "The anti-Splitwise")
      Text("Split the receipt, not the friendship.")
        .font(.system(size: 30, weight: .heavy, design: .rounded))
        .foregroundStyle(VouchColor.ink)
        .fixedSize(horizontal: false, vertical: true)
      Text("Snap the crumpled receipt. Housemates tap the items they actually owe. Everyone vouches.")
        .font(.system(size: 15, weight: .medium, design: .rounded))
        .foregroundStyle(VouchColor.ink2)
        .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 24)
    .padding(.top, 14)
  }

  private var hero: some View {
    LandingReceiptCard()
      .frame(maxWidth: 268)
      .frame(maxWidth: .infinity)
  }

  private var stickersRow: some View {
    HStack(spacing: 8) {
      sticker("Share by link", VouchColor.lime)
      sticker("Groups", VouchColor.pink)
      sticker("On-device OCR", VouchColor.blue, ink: VouchColor.blueInk)
    }
    .padding(.horizontal, 24)
  }

  private var ctaBlock: some View {
    VStack(spacing: 10) {
      VouchButton(title: "Start a split", kind: .primary) { auth = .signup }
      Button {
        auth = .login
      } label: {
        Text("Already on Vouch? Sign in")
          .font(.system(size: 15, weight: .heavy, design: .rounded))
          .foregroundStyle(VouchColor.ink)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 4)
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, 24)
    .padding(.bottom, 10)
  }

  private func sticker(_ text: String, _ fill: Color, ink: Color = VouchColor.ink) -> some View {
    Text(text.uppercased())
      .font(.system(size: 10, weight: .heavy, design: .rounded))
      .tracking(0.6)
      .foregroundStyle(ink)
      .padding(.horizontal, 8)
      .padding(.vertical, 6)
      .background(fill)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 2))
      .rotationEffect(.degrees(text == "Groups" ? -2 : 1.5))
  }
}

private struct LandingReceiptCard: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("TRADER JOE'S")
        .font(.system(size: 12, weight: .heavy, design: .monospaced))
      Rectangle().fill(VouchColor.ink).frame(height: 2)
      row("Oat milk", "4.50")
      row("Blueberries", "6.99")
      row("Not pizza", "0.00", dim: true)
      Rectangle().fill(VouchColor.ink).frame(height: 2)
      HStack {
        Text("YOU OWE")
        Spacer()
        Text("$11.49")
      }
      .font(.system(size: 13, weight: .heavy, design: .monospaced))
    }
    .padding(16)
    .background(VouchColor.paper2)
    .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 3))
    .background(VouchColor.ink.offset(x: 6, y: 6))
    .rotationEffect(.degrees(3))
  }

  private func row(_ name: String, _ price: String, dim: Bool = false) -> some View {
    HStack {
      Text(name)
      Spacer()
      Text(price)
    }
    .font(.system(size: 12, weight: .semibold, design: .monospaced))
    .foregroundStyle(dim ? VouchColor.ink2 : VouchColor.ink)
    .opacity(dim ? 0.55 : 1)
  }
}

enum AuthKind: String, Identifiable {
  case login, signup
  var id: String { rawValue }
}

struct AuthSheet: View {
  var kind: AuthKind
  @Environment(SessionStore.self) private var session
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var email = ""
  @State private var password = ""
  @State private var busy = false

  var body: some View {
    ZStack {
      PaperBackground()
      VStack(spacing: 0) {
        HStack {
          Spacer()
          Button(action: { dismiss() }) {
            Image(systemName: "xmark")
              .font(.system(size: 15, weight: .bold))
              .foregroundStyle(VouchColor.ink)
              .frame(width: 36, height: 36)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Close")
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 4)

        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            Text(kind == .signup ? "Create an account" : "Sign in")
              .font(.system(size: 28, weight: .heavy, design: .rounded))
              .foregroundStyle(VouchColor.ink)
            if kind == .signup {
              VouchField(label: "Name", placeholder: "Ansh", text: $name)
            }
            VouchField(label: "Email", placeholder: "you@house.com", text: $email, email: true)
            VouchField(label: "Password", placeholder: "8+ characters", text: $password, secret: true)
            if let error = session.error {
              Text(error)
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundStyle(VouchColor.pink)
            }
            VouchButton(
              title: kind == .signup ? "Create account" : "Sign in",
              kind: .primary,
              busy: busy
            ) {
              Task { await submit() }
            }
          }
          .padding(.horizontal, 24)
          .padding(.top, 8)
          .padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.interactively)
      }
    }
  }

  private func submit() async {
    busy = true
    defer { busy = false }
    let ok: Bool
    if kind == .signup {
      ok = await session.signup(name: name, email: email, password: password)
    } else {
      ok = await session.login(email: email, password: password)
    }
    if ok { dismiss() }
  }
}

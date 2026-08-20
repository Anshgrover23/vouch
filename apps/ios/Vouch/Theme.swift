import SwiftUI

enum VouchColor {
  static let paper = Color(red: 0.957, green: 0.941, blue: 0.880)
  static let paper2 = Color(red: 0.988, green: 0.976, blue: 0.945)
  static let ink = Color(red: 0.12, green: 0.10, blue: 0.08)
  static let ink2 = Color(red: 0.24, green: 0.20, blue: 0.16)
  static let lime = Color(red: 0.78, green: 0.96, blue: 0.22)
  static let pink = Color(red: 0.92, green: 0.42, blue: 0.48)
  static let blue = Color(red: 0.28, green: 0.22, blue: 0.95)
  static let blueInk = Color(red: 0.98, green: 0.97, blue: 0.94)
  static let grid = Color(red: 0.12, green: 0.10, blue: 0.08).opacity(0.07)
}

struct VouchMark: View {
  var size: CGFloat = 88
  var fill: Color = VouchColor.lime

  var body: some View {
    Text("V")
      .font(.system(size: size * 0.58, weight: .black, design: .rounded))
      .foregroundStyle(VouchColor.ink)
      .frame(width: size, height: size)
      .background(fill)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: max(3, size / 22)))
      .background(VouchColor.ink.offset(x: size * 0.06, y: size * 0.06))
      .accessibilityLabel("Vouch")
  }
}

struct PaperBackground: View {
  var body: some View {
    ZStack {
      VouchColor.paper
      Canvas { context, size in
        let step: CGFloat = 28
        var x: CGFloat = 0
        while x <= size.width {
          var path = Path()
          path.move(to: CGPoint(x: x, y: 0))
          path.addLine(to: CGPoint(x: x, y: size.height))
          context.stroke(path, with: .color(VouchColor.grid), lineWidth: 1)
          x += step
        }
        var y: CGFloat = 0
        while y <= size.height {
          var path = Path()
          path.move(to: CGPoint(x: 0, y: y))
          path.addLine(to: CGPoint(x: size.width, y: y))
          context.stroke(path, with: .color(VouchColor.grid), lineWidth: 1)
          y += step
        }
      }
    }
    .ignoresSafeArea()
  }
}

struct VouchBadge: View {
  var text: String
  var fill: Color = VouchColor.pink
  var ink: Color = VouchColor.paper2

  var body: some View {
    Text(text.uppercased())
      .font(.system(size: 11, weight: .heavy, design: .rounded))
      .tracking(1.2)
      .foregroundStyle(ink)
      .padding(.horizontal, 10)
      .padding(.vertical, 5)
      .background(fill)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 2))
  }
}

struct HardShadow<Content: View>: View {
  var offset: CGFloat = 5
  @ViewBuilder var content: Content

  var body: some View {
    content
      .background(VouchColor.ink.offset(x: offset, y: offset))
  }
}

struct NewReceiptFAB: View {
  var busy = false
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        if busy {
          ProgressView().tint(VouchColor.ink)
        } else {
          Image(systemName: "receipt.fill")
            .font(.system(size: 15, weight: .bold))
        }
        Text("New receipt")
          .font(.system(size: 15, weight: .heavy, design: .rounded))
      }
      .foregroundStyle(VouchColor.ink)
      .padding(.horizontal, 16)
      .padding(.vertical, 14)
      .background(VouchColor.lime)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 3))
    }
    .disabled(busy)
    .background(VouchColor.ink.offset(x: 4, y: 4))
    .buttonStyle(.plain)
    .accessibilityLabel("New receipt")
  }
}

struct VouchButton: View {
  enum Kind { case primary, lime, ghost }

  var title: String
  var kind: Kind = .primary
  var busy = false
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        if busy { ProgressView().tint(foreground) }
        Text(title.uppercased())
          .font(.system(size: 14, weight: .heavy, design: .rounded))
          .tracking(0.6)
      }
      .frame(maxWidth: .infinity)
      .padding(.vertical, 14)
      .foregroundStyle(foreground)
      .background(background)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 3))
    }
    .disabled(busy)
    .background(VouchColor.ink.offset(x: 4, y: 4))
    .buttonStyle(.plain)
  }

  private var background: Color {
    switch kind {
    case .primary: VouchColor.blue
    case .lime: VouchColor.lime
    case .ghost: VouchColor.paper2
    }
  }

  private var foreground: Color {
    switch kind {
    case .primary: VouchColor.blueInk
    case .lime, .ghost: VouchColor.ink
    }
  }
}

struct VouchField: View {
  var label: String
  var placeholder: String
  @Binding var text: String
  var secret = false
  var email = false

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label.uppercased())
        .font(.system(size: 11, weight: .heavy, design: .monospaced))
        .tracking(1)
        .foregroundStyle(VouchColor.ink)
      Group {
        if secret {
          SecureField(placeholder, text: $text)
        } else {
          TextField(placeholder, text: $text)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .keyboardType(email ? .emailAddress : .default)
            .textContentType(email ? .emailAddress : nil)
        }
      }
      .padding(12)
      .background(VouchColor.paper2)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 2))
    }
  }
}

struct VouchCard<Content: View>: View {
  var padding: CGFloat = 16
  @ViewBuilder var content: Content

  var body: some View {
    content
      .padding(padding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(VouchColor.paper2)
      .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 3))
      .background(VouchColor.ink.offset(x: 5, y: 5))
  }
}

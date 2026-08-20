import SwiftUI

@main
struct VouchApp: App {
  @State private var session = SessionStore()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(session)
    }
  }
}

struct RootView: View {
  @Environment(SessionStore.self) private var session
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var showSplash = true

  var body: some View {
    ZStack {
      Group {
        if session.session == nil {
          LandingView()
        } else if session.session?.onboarded == false {
          OnboardingView()
        } else {
          RootTabs()
        }
      }

      if showSplash {
        SplashView()
          .transition(.opacity)
          .zIndex(1)
      }
    }
    .preferredColorScheme(.light)
    .task {
      async let dwell: Void = sleepSplash()
      await session.bootstrap()
      await dwell
      if reduceMotion {
        showSplash = false
      } else {
        withAnimation(.easeOut(duration: 0.38)) {
          showSplash = false
        }
      }
    }
  }

  private func sleepSplash() async {
    let ns: UInt64 = reduceMotion ? 400_000_000 : 1_150_000_000
    try? await Task.sleep(nanoseconds: ns)
  }
}

struct SplashView: View {
  @State private var markOn = false

  var body: some View {
    ZStack {
      VouchColor.lime.ignoresSafeArea()
      VStack(spacing: 18) {
        VouchMark(size: 96, fill: VouchColor.paper2)
        Text("Vouch")
          .font(.system(size: 34, weight: .heavy, design: .rounded))
          .tracking(0.6)
          .foregroundStyle(VouchColor.ink)
      }
      .opacity(markOn ? 1 : 0)
      .offset(y: markOn ? 0 : 8)
    }
    .onAppear {
      withAnimation(.easeOut(duration: 0.28)) {
        markOn = true
      }
    }
  }
}

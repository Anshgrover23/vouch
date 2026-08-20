import SwiftUI

struct RootTabs: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var inboxTick = 0

  var body: some View {
    TabView {
      InboxView(reloadToken: inboxTick)
        .tabItem {
          Label("Splits", systemImage: "receipt")
        }
      GroupsView()
        .tabItem {
          Label("Groups", systemImage: "person.3")
        }
      ActivityView()
        .tabItem {
          Label("Activity", systemImage: "list.bullet.rectangle")
        }
      AccountView()
        .tabItem {
          Label("Account", systemImage: "person.crop.circle")
        }
    }
    .tint(VouchColor.blue)
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { inboxTick += 1 }
    }
  }
}

import SwiftUI

struct ActivityView: View {
  @Environment(SessionStore.self) private var session
  @State private var items: [ActivityFeedItem] = []
  @State private var loading = true
  @State private var error: String?

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        Group {
          if loading && items.isEmpty {
            ProgressView().tint(VouchColor.ink)
          } else if let error, items.isEmpty {
            ContentUnavailableView(
              "Could not load activity",
              systemImage: "exclamationmark.square",
              description: Text(error)
            )
          } else if items.isEmpty {
            ContentUnavailableView(
              "No activity yet",
              systemImage: "list.bullet.rectangle",
              description: Text("Receipts and vouches from your groups show up here.")
            )
          } else {
            ScrollView {
              LazyVStack(spacing: 12) {
                ForEach(items) { item in
                  if let documentId = item.event.documentId, !documentId.isEmpty {
                    NavigationLink {
                      ReceiptReviewView(documentId: documentId)
                    } label: {
                      ActivityRow(item: item, youName: session.session?.displayName)
                    }
                    .buttonStyle(.plain)
                  } else {
                    NavigationLink {
                      GroupDetailView(groupId: item.groupId)
                    } label: {
                      ActivityRow(item: item, youName: session.session?.displayName)
                    }
                    .buttonStyle(.plain)
                  }
                }
              }
              .padding(.horizontal, 20)
              .padding(.top, 8)
              .padding(.bottom, 24)
            }
            .refreshable { await load() }
          }
        }
      }
      .navigationTitle("Activity")
      .toolbarBackground(VouchColor.paper, for: .navigationBar)
      .splitComposer()
      .task { await load() }
    }
  }

  private func load() async {
    error = nil
    do {
      let env: GroupsEnvelope = try await APIClient.shared.get("/api/groups")
      let rows = await withTaskGroup(of: [ActivityFeedItem].self) { group in
        for row in env.groups {
          group.addTask {
            guard let ledger: LedgerPayload = try? await APIClient.shared.get("/api/groups/\(row.id)/ledger") else {
              return []
            }
            return (ledger.activity ?? []).map { event in
              ActivityFeedItem(event: event, groupId: row.id, groupName: row.name)
            }
          }
        }
        var all: [ActivityFeedItem] = []
        for await chunk in group { all.append(contentsOf: chunk) }
        return all
      }
      items = rows.sorted { lhs, rhs in
        let left = ActivityStamp.parse(lhs.event.createdAt) ?? .distantPast
        let right = ActivityStamp.parse(rhs.event.createdAt) ?? .distantPast
        return left > right
      }
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not load activity."
    }
    loading = false
  }
}

struct ActivityRow: View {
  var item: ActivityFeedItem
  var youName: String?

  var body: some View {
    VouchCard {
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: item.event.symbol)
          .font(.system(size: 16, weight: .bold))
          .foregroundStyle(VouchColor.ink)
          .frame(width: 28, height: 28)
        VStack(alignment: .leading, spacing: 4) {
          Text(item.event.copy(youName: youName))
            .font(.system(size: 16, weight: .heavy, design: .rounded))
            .foregroundStyle(VouchColor.ink)
            .multilineTextAlignment(.leading)
          Text("in \(item.groupName)")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(VouchColor.blue)
          if !item.event.stamp.isEmpty {
            Text(item.event.stamp)
              .font(.system(size: 12, weight: .medium, design: .monospaced))
              .foregroundStyle(VouchColor.ink2)
          }
        }
        Spacer(minLength: 0)
        Image(systemName: "chevron.right")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(VouchColor.ink)
          .padding(.top, 4)
      }
    }
  }
}

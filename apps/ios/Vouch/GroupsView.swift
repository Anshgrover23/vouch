import SwiftUI

struct GroupsView: View {
  @State private var groups: [GroupRow] = []
  @State private var error: String?
  @State private var newName = ""
  @State private var creating = false

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ScrollView {
          VStack(spacing: 14) {
            VouchCard(padding: 12) {
              HStack(spacing: 10) {
                TextField("New group name", text: $newName)
                  .textInputAutocapitalization(.words)
                Button("Add") { Task { await create() } }
                  .font(.system(size: 14, weight: .heavy, design: .rounded))
                  .foregroundStyle(VouchColor.ink)
                  .disabled(creating || newName.trimmingCharacters(in: .whitespaces).isEmpty)
              }
            }
            if let error {
              Text(error)
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundStyle(VouchColor.pink)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            ForEach(groups) { group in
              NavigationLink {
                GroupDetailView(groupId: group.id)
              } label: {
                VouchCard {
                  HStack {
                    VStack(alignment: .leading, spacing: 4) {
                      HStack(spacing: 8) {
                        Text(group.name)
                          .font(.system(size: 17, weight: .heavy, design: .rounded))
                          .foregroundStyle(VouchColor.ink)
                        if group.starred {
                          Text("STAR")
                            .font(.system(size: 10, weight: .heavy, design: .monospaced))
                            .foregroundStyle(VouchColor.ink)
                        }
                      }
                      Text("\(group.members.count) seats")
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(VouchColor.ink2)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                      .font(.system(size: 12, weight: .bold))
                      .foregroundStyle(VouchColor.ink)
                  }
                }
              }
              .buttonStyle(.plain)
            }
          }
          .padding(.horizontal, 20)
          .padding(.top, 8)
          .padding(.bottom, 24)
        }
        .scrollContentBackground(.hidden)
      }
      .navigationTitle("Groups")
      .toolbarBackground(VouchColor.paper, for: .navigationBar)
      .splitComposer()
      .refreshable { await load() }
      .task { await load() }
    }
  }

  private func load() async {
    do {
      let env: GroupsEnvelope = try await APIClient.shared.get("/api/groups")
      groups = env.groups
      error = nil
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not load groups."
    }
  }

  private func create() async {
    creating = true
    defer { creating = false }
    do {
      let _: GroupCreated = try await APIClient.shared.postJSON("/api/groups", body: [
        "name": newName.trimmingCharacters(in: .whitespacesAndNewlines),
      ])
      newName = ""
      await load()
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not create that group."
    }
  }
}

struct GroupDetailView: View {
  var groupId: String
  @State private var ledger: LedgerPayload?
  @State private var error: String?
  @State private var friendName = ""

  var body: some View {
    ZStack {
      PaperBackground()
      Group {
        if let ledger {
          List {
            Section("Activity") {
              if (ledger.activity ?? []).isEmpty {
                Text("Nothing in this group yet.")
                  .foregroundStyle(VouchColor.ink2)
              } else {
                ForEach(ledger.activity ?? []) { event in
                  if let documentId = event.documentId, !documentId.isEmpty {
                    NavigationLink {
                      ReceiptReviewView(documentId: documentId)
                    } label: {
                      VStack(alignment: .leading, spacing: 4) {
                        Text(event.copy(youName: nil))
                          .font(.system(size: 15, weight: .heavy, design: .rounded))
                        Text(event.stamp)
                          .font(.system(size: 12, weight: .medium, design: .monospaced))
                          .foregroundStyle(VouchColor.ink2)
                      }
                    }
                  } else {
                    VStack(alignment: .leading, spacing: 4) {
                      Text(event.copy(youName: nil))
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                      Text(event.stamp)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(VouchColor.ink2)
                    }
                  }
                }
              }
            }
            Section("Analytics") {
              stat("Group spending", ledger.analytics.totals.groupSpending)
              stat("You paid", ledger.analytics.totals.youPaid)
              stat("Your share", ledger.analytics.totals.yourShare)
              if !ledger.analytics.buckets.isEmpty {
                BucketBars(buckets: ledger.analytics.buckets)
                  .frame(height: 88)
                  .padding(.top, 4)
              }
            }
            Section("People") {
              ForEach(ledger.analytics.people) { person in
                HStack {
                  Text(person.name)
                  Spacer()
                  Text("paid \(money(person.paid)) · share \(money(person.share))")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                }
              }
            }
            Section("Merchants") {
              ForEach(ledger.analytics.merchants) { row in
                HStack {
                  Text(row.name)
                  Spacer()
                  Text(money(row.spending))
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                }
              }
            }
            Section("Seats") {
              ForEach(ledger.members) { member in
                HStack {
                  Text(member.displayName)
                  Spacer()
                  Text(member.status)
                    .font(.system(size: 11, weight: .heavy, design: .monospaced))
                }
                if member.status != "joined",
                   let token = member.inviteToken, !token.isEmpty,
                   let url = URL(string: "https://vouch.anshgrover.com/signup?invite=\(token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? token)") {
                  ShareLink(item: url, message: Text("Join this Vouch group as \(member.displayName): \(url.absoluteString)")) {
                    Text("Text \(member.displayName)")
                  }
                }
              }
              HStack {
                TextField("Friend's name", text: $friendName)
                Button("Add seat") { Task { await addSeat() } }
                  .disabled(friendName.trimmingCharacters(in: .whitespaces).isEmpty)
              }
            }
            Section("Suggested pays") {
              ForEach(ledger.suggested) { row in
                Text("\(row.from) → \(row.to)  \(money(row.amount))")
                  .font(.system(size: 14, weight: .semibold, design: .rounded))
              }
            }
          }
          .scrollContentBackground(.hidden)
        } else if let error {
          ContentUnavailableView("Could not load group", systemImage: "exclamationmark.square", description: Text(error))
        } else {
          ProgressView().tint(VouchColor.ink)
        }
      }
    }
    .navigationTitle(ledger?.group.name ?? "Group")
    .splitComposer(groupId: groupId)
    .task { await load() }
    .refreshable { await load() }
  }

  private func stat(_ label: String, _ value: Double) -> some View {
    HStack {
      Text(label)
      Spacer()
      Text(money(value)).font(.system(size: 15, weight: .heavy, design: .monospaced))
    }
  }

  private func money(_ value: Double) -> String {
    value.formatted(.currency(code: "USD"))
  }

  private func load() async {
    do {
      ledger = try await APIClient.shared.get("/api/groups/\(groupId)/ledger")
      error = nil
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not load that group."
    }
  }

  private func addSeat() async {
    let name = friendName.trimmingCharacters(in: .whitespacesAndNewlines)
    do {
      let _: InviteCreated = try await APIClient.shared.postJSON("/api/groups/\(groupId)/members", body: [
        "displayName": name,
      ])
      friendName = ""
      await load()
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not add that seat."
    }
  }
}

private struct BucketBars: View {
  var buckets: [AnalyticsBucket]

  var body: some View {
    let peak = max(buckets.map(\.spending).max() ?? 1, 1)
    HStack(alignment: .bottom, spacing: 6) {
      ForEach(buckets) { bucket in
        VStack(spacing: 4) {
          Rectangle()
            .fill(VouchColor.blue)
            .frame(height: max(4, 64 * bucket.spending / peak))
            .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 1.5))
          Text(bucket.label)
            .font(.system(size: 8, weight: .heavy, design: .monospaced))
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
      }
    }
  }
}

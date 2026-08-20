import SwiftUI

struct InboxView: View {
  var reloadToken: Int
  @State private var rows: [SplitRow] = []
  @State private var error: String?
  @State private var loading = true

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        Group {
          if loading && rows.isEmpty {
            ProgressView().tint(VouchColor.ink)
          } else if let error, rows.isEmpty {
            ContentUnavailableView(
              "Could not load splits",
              systemImage: "exclamationmark.square",
              description: Text(error)
            )
          } else if rows.isEmpty {
            ContentUnavailableView(
              "No receipts yet",
              systemImage: "receipt",
              description: Text("Tap New receipt. Housemates tap the items they owe.")
            )
          } else {
            ScrollView {
              LazyVStack(spacing: 14) {
                ForEach(rows) { row in
                  NavigationLink {
                    ReceiptReviewView(documentId: row.id)
                  } label: {
                    SplitRowCard(row: row)
                  }
                  .buttonStyle(.plain)
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
      .navigationTitle("Splits")
      .toolbarBackground(VouchColor.paper, for: .navigationBar)
      .splitComposer()
      .task(id: reloadToken) { await load() }
      .onAppear { Task { await load() } }
    }
  }

  private func load() async {
    error = nil
    do {
      let env: DocumentsEnvelope = try await APIClient.shared.get("/api/documents")
      rows = env.documents
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not load splits."
    }
    loading = false
  }
}

private struct SplitRowCard: View {
  var row: SplitRow

  var body: some View {
    VouchCard {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 6) {
          Text(row.merchant.isEmpty ? "Receipt" : row.merchant)
            .font(.system(size: 17, weight: .heavy, design: .rounded))
            .foregroundStyle(VouchColor.ink)
            .multilineTextAlignment(.leading)
          Text(meta)
            .font(.system(size: 12, weight: .medium, design: .monospaced))
            .foregroundStyle(VouchColor.ink2)
        }
        Spacer(minLength: 8)
        Text(row.total)
          .font(.system(size: 16, weight: .heavy, design: .monospaced))
          .foregroundStyle(VouchColor.ink)
        Image(systemName: "chevron.right")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(VouchColor.ink)
          .accessibilityHidden(true)
      }
    }
  }

  private var meta: String {
    let date = row.date.isEmpty ? statusLabel(row.status ?? "") : row.date
    return "\(date)  ·  \(row.people ?? 0) vouched"
  }

  private func statusLabel(_ status: String) -> String {
    switch status {
    case "needs_review": "Needs review"
    case "uploaded", "processing": "Reading…"
    case "failed": "Failed"
    default: status.replacingOccurrences(of: "_", with: " ")
    }
  }
}

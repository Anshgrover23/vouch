import SwiftUI

struct ReceiptReviewView: View {
  var documentId: String
  @State private var detail: DocumentDetail?
  @State private var error: String?
  @State private var friendName = ""
  @State private var adding = false

  var body: some View {
    ZStack {
      PaperBackground()
      Group {
        if let detail {
          List {
            Section {
              VStack(alignment: .leading, spacing: 8) {
                Text(headline(detail))
                  .font(.system(size: 24, weight: .heavy, design: .rounded))
                Text(statusText(detail.document.status))
                  .font(.system(size: 12, weight: .heavy, design: .monospaced))
                if let err = detail.document.error, !err.isEmpty {
                  Text(err).foregroundStyle(VouchColor.pink)
                }
              }
              .listRowBackground(VouchColor.paper)
            }
            Section("Items") {
              ForEach(detail.fields) { field in
                itemRow(field, detail: detail)
              }
            }
            Section("Invite a seat") {
              ForEach(openSeats(detail.seats), id: \.memberId) { seat in
                if let url = inviteURL(detail: detail, seat: seat) {
                  ShareLink(item: url, message: Text(inviteMessage(url: url, name: seat.displayName))) {
                    Label("Text \(seat.displayName)", systemImage: "square.and.arrow.up")
                  }
                }
              }
              HStack {
                TextField("Friend's name", text: $friendName)
                Button("Add") { Task { await addFriend() } }
                  .disabled(adding || friendName.trimmingCharacters(in: .whitespaces).isEmpty)
              }
            }
            if let share = shareURL(detail) {
              Section("Guest link") {
                ShareLink(item: share, message: Text("You're on this split: \(share.absoluteString)")) {
                  Label("Share the receipt link", systemImage: "link")
                }
              }
            }
          }
          .scrollContentBackground(.hidden)
        } else if let error {
          ContentUnavailableView("Could not load", systemImage: "exclamationmark.square", description: Text(error))
        } else {
          ProgressView().tint(VouchColor.ink)
        }
      }
    }
    .navigationTitle("Receipt")
    .navigationBarTitleDisplayMode(.inline)
    .task { await load() }
    .refreshable { await load() }
  }

  private func headline(_ detail: DocumentDetail) -> String {
    detail.fields.first { $0.key == "merchant" || $0.key == "recipient" }?.shown
      ?? detail.document.title
      ?? "Receipt"
  }

  private func statusText(_ status: String) -> String {
    switch status {
    case "needs_review": "NEEDS REVIEW"
    case "uploaded", "processing": "READING THE PAPER…"
    case "failed": "FAILED"
    default: status.uppercased()
    }
  }

  private func itemRow(_ field: ReceiptField, detail: DocumentDetail) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(field.label.isEmpty ? field.key : field.label)
          .font(.system(size: 15, weight: .heavy, design: .rounded))
        Spacer()
        Text(field.shown)
          .font(.system(size: 14, weight: .heavy, design: .monospaced))
      }
      if ReceiptKeys.isClaimable(field.key) {
        HStack {
          claimButton("I owe", stance: "owe", field: field, detail: detail)
          claimButton("Split", stance: "split", field: field, detail: detail)
          claimButton("Not mine", stance: "not_mine", field: field, detail: detail)
        }
        let names = detail.claims.filter { $0.fieldId == field.id && $0.stance == "owe" }.compactMap(\.displayName)
        if !names.isEmpty {
          Text(names.joined(separator: ", "))
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(VouchColor.ink2)
        }
      }
    }
    .listRowBackground(VouchColor.paper2)
  }

  private func claimButton(_ title: String, stance: String, field: ReceiptField, detail: DocumentDetail) -> some View {
    Button(title) {
      Task { await claim(fieldId: field.id, stance: stance, token: detail.document.shareToken) }
    }
    .font(.system(size: 11, weight: .heavy, design: .rounded))
    .padding(.horizontal, 8)
    .padding(.vertical, 6)
    .background(VouchColor.lime)
    .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 2))
    .foregroundStyle(VouchColor.ink)
  }

  private func openSeats(_ seats: [SeatRow]) -> [SeatRow] {
    seats.filter { $0.you != true && $0.status != "joined" && !$0.inviteToken.isEmpty }
  }

  private func shareURL(_ detail: DocumentDetail) -> URL? {
    guard let token = detail.document.shareToken, !token.isEmpty else { return nil }
    return URL(string: "https://vouch.anshgrover.com/s/\(token)")
  }

  private func inviteURL(detail: DocumentDetail, seat: SeatRow) -> URL? {
    guard let base = shareURL(detail) else { return nil }
    return URL(string: "\(base.absoluteString)?as=\(seat.inviteToken)")
  }

  private func inviteMessage(url: URL, name: String) -> String {
    "You're on this split as \(name): \(url.absoluteString)"
  }

  private func load() async {
    error = nil
    do {
      for _ in 0..<24 {
        detail = try await APIClient.shared.get("/api/documents/\(documentId)")
        let status = detail?.document.status ?? ""
        if status != "uploaded" && status != "processing" { break }
        try await Task.sleep(for: .seconds(1.2))
      }
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not load that receipt."
    }
  }

  private func claim(fieldId: String, stance: String, token: String?) async {
    guard let token, !token.isEmpty else { return }
    do {
      let _: ErrorEnvelopeSafe = try await APIClient.shared.postJSON("/api/splits/\(token)/claims", body: [
        "fieldId": fieldId,
        "stance": stance,
      ])
      await load()
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not save that tap."
    }
  }

  private func addFriend() async {
    adding = true
    defer { adding = false }
    let name = friendName.trimmingCharacters(in: .whitespacesAndNewlines)
    do {
      let _: InviteCreated = try await APIClient.shared.postJSON("/api/documents/\(documentId)/invites", body: [
        "displayName": name,
      ])
      friendName = ""
      await load()
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not add that seat."
    }
  }
}

private struct ErrorEnvelopeSafe: Codable {
  var error: String?
  var ok: Bool?
}
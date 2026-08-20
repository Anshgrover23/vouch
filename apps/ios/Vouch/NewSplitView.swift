import PhotosUI
import SwiftUI
import UIKit

enum ReceiptDestination: Equatable {
  case oneOff
  case group(id: String, name: String)

  var groupId: String? {
    switch self {
    case .oneOff: nil
    case .group(let id, _): id
    }
  }

  var label: String {
    switch self {
    case .oneOff: "One-off receipt"
    case .group(_, let name): name
    }
  }
}

extension View {
  func splitComposer(groupId: String? = nil) -> some View {
    modifier(SplitComposer(fixedGroupId: groupId))
  }
}

private struct SplitComposer: ViewModifier {
  var fixedGroupId: String?

  @State private var destination: ReceiptDestination?
  @State private var showPicker = false
  @State private var showMethod = false
  @State private var camera = false
  @State private var typing = false
  @State private var showLibrary = false
  @State private var pickerItem: PhotosPickerItem?
  @State private var busy = false
  @State private var error: String?
  @State private var ocrHint: String?
  @State private var reviewId: String?

  private var groupId: String {
    destination?.groupId ?? fixedGroupId ?? ""
  }

  func body(content: Content) -> some View {
    content
      .safeAreaInset(edge: .bottom, alignment: .trailing) {
        NewReceiptFAB(busy: busy) { start() }
          .padding(.trailing, 20)
          .padding(.bottom, 6)
      }
      .photosPicker(isPresented: $showLibrary, selection: $pickerItem, matching: .images)
      .navigationDestination(isPresented: Binding(
        get: { reviewId != nil },
        set: { if !$0 { reviewId = nil } }
      )) {
        if let reviewId {
          ReceiptReviewView(documentId: reviewId)
        }
      }
      .sheet(isPresented: $showPicker, onDismiss: {
        if destination != nil { showMethod = true }
      }) {
        NewReceiptDestinationSheet { picked in
          destination = picked
          showPicker = false
        }
      }
      .sheet(isPresented: $showMethod) {
        AddPaperSheet(destination: methodLabel) { method in
          showMethod = false
          switch method {
          case .snap: snap()
          case .photo: showLibrary = true
          case .type: typing = true
          }
        }
        .presentationDetents([.height(320)])
      }
      .sheet(isPresented: $typing) {
        TypeReceiptSheet(groupId: groupId.isEmpty ? nil : groupId) { id in
          typing = false
          reviewId = id
        }
      }
      .sheet(isPresented: $camera) {
        CameraPicker { image in
          camera = false
          guard let image else { return }
          Task { await handleImage(image) }
        }
        .ignoresSafeArea()
      }
      .alert("Could not add that receipt", isPresented: Binding(
        get: { error != nil },
        set: { if !$0 { error = nil } }
      )) {
        Button("OK", role: .cancel) {}
      } message: {
        Text(error ?? "")
      }
      .onChange(of: pickerItem) { _, item in
        guard let item else { return }
        Task {
          if let data = try? await item.loadTransferable(type: Data.self),
             let image = UIImage(data: data) {
            await handleImage(image)
          }
          pickerItem = nil
        }
      }
      .overlay {
        if busy {
          ZStack {
            VouchColor.paper.opacity(0.72)
            VouchCard {
              VStack(alignment: .leading, spacing: 8) {
                ProgressView().tint(VouchColor.ink)
                Text(ocrHint ?? "Reading…")
                  .font(.system(size: 14, weight: .heavy, design: .rounded))
                  .foregroundStyle(VouchColor.ink)
              }
            }
            .padding(28)
          }
          .ignoresSafeArea()
        }
      }
  }

  private var methodLabel: String {
    if let destination { return destination.label }
    return "Receipt"
  }

  private func start() {
    if let fixedGroupId {
      destination = .group(id: fixedGroupId, name: "This group")
      showMethod = true
    } else {
      destination = nil
      showPicker = true
    }
  }

  private func snap() {
    if UIImagePickerController.isSourceTypeAvailable(.camera) {
      camera = true
    } else {
      showLibrary = true
    }
  }

  private func handleImage(_ image: UIImage) async {
    busy = true
    error = nil
    ocrHint = "Reading on-device…"
    defer { busy = false }
    let parsed = await ReceiptVision.parse(image)
    do {
      if let parsed, parsed.usable {
        ocrHint = "Vision found \(parsed.merchant)."
        let created: DocumentCreated = try await APIClient.shared.postJSON("/api/documents", body: parsed.body(groupId: groupId))
        guard let id = created.document?.id else {
          error = created.error ?? "Could not save that receipt."
          return
        }
        reviewId = id
      } else {
        ocrHint = "Uploading for the cloud reader…"
        guard let jpeg = image.jpegData(compressionQuality: 0.82) else {
          error = "Could not encode that photo."
          return
        }
        let created = try await APIClient.shared.postMultipart(
          path: "/api/documents",
          file: jpeg,
          filename: "receipt.jpg",
          slug: "grocery-receipt",
          groupId: groupId.isEmpty ? nil : groupId
        )
        guard let id = created.document?.id else {
          error = created.error ?? "Could not upload that receipt."
          return
        }
        reviewId = id
      }
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not send that receipt."
    }
  }
}

private enum PaperMethod { case snap, photo, type }

private struct NewReceiptDestinationSheet: View {
  var onPick: (ReceiptDestination) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var groups: [GroupRow] = []
  @State private var query = ""
  @State private var loading = true

  private var filtered: [GroupRow] {
    let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
    if q.isEmpty { return groups }
    return groups.filter { $0.name.localizedCaseInsensitiveContains(q) }
  }

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ScrollView {
          VStack(spacing: 14) {
            VouchField(label: "Search", placeholder: "Group name", text: $query)
            destinationRow(
              title: "One-off receipt",
              subtitle: "Don't pick a group — same as the website with no group selected",
              symbol: "receipt"
            ) {
              onPick(.oneOff)
            }
            if !filtered.isEmpty {
              Text("GROUPS")
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .tracking(1)
                .foregroundStyle(VouchColor.ink2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)
              ForEach(filtered) { group in
                destinationRow(
                  title: group.name,
                  subtitle: "\(group.members.count) seats",
                  symbol: "person.3"
                ) {
                  onPick(.group(id: group.id, name: group.name))
                }
              }
            } else if !loading, !query.isEmpty {
              Text("No group matches that name.")
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundStyle(VouchColor.ink2)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
          }
          .padding(20)
        }
      }
      .navigationTitle("New receipt")
      .navigationBarTitleDisplayMode(.inline)
      .toolbarBackground(VouchColor.paper, for: .navigationBar)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            dismiss()
          } label: {
            Image(systemName: "xmark")
              .font(.system(size: 14, weight: .bold))
              .foregroundStyle(VouchColor.ink)
          }
          .accessibilityLabel("Close")
        }
      }
      .task { await load() }
    }
  }

  private func destinationRow(title: String, subtitle: String, symbol: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      VouchCard {
        HStack(spacing: 12) {
          Image(systemName: symbol)
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(VouchColor.ink)
            .frame(width: 28)
          VStack(alignment: .leading, spacing: 4) {
            Text(title)
              .font(.system(size: 17, weight: .heavy, design: .rounded))
              .foregroundStyle(VouchColor.ink)
            Text(subtitle)
              .font(.system(size: 12, weight: .medium, design: .monospaced))
              .foregroundStyle(VouchColor.ink2)
          }
          Spacer()
          Image(systemName: "circle")
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(VouchColor.ink)
        }
      }
    }
    .buttonStyle(.plain)
  }

  private func load() async {
    if let env: GroupsEnvelope = try? await APIClient.shared.get("/api/groups") {
      groups = env.groups
    }
    loading = false
  }
}

private struct AddPaperSheet: View {
  var destination: String
  var onPick: (PaperMethod) -> Void
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        VStack(spacing: 12) {
          Text("This lands in \(destination).")
            .font(.system(size: 14, weight: .medium, design: .rounded))
            .foregroundStyle(VouchColor.ink2)
            .frame(maxWidth: .infinity, alignment: .leading)
          VouchButton(title: "Snap receipt", kind: .primary) { onPick(.snap) }
          VouchButton(title: "Choose photo", kind: .ghost) { onPick(.photo) }
          VouchButton(title: "Type it in", kind: .lime) { onPick(.type) }
          Spacer()
        }
        .padding(20)
      }
      .navigationTitle("Add the paper")
      .navigationBarTitleDisplayMode(.inline)
      .toolbarBackground(VouchColor.paper, for: .navigationBar)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            dismiss()
          } label: {
            Image(systemName: "xmark")
              .font(.system(size: 14, weight: .bold))
              .foregroundStyle(VouchColor.ink)
          }
          .accessibilityLabel("Close")
        }
      }
    }
  }
}

struct TypeReceiptSheet: View {
  var groupId: String?
  var onCreated: (String) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var merchant = ""
  @State private var date = ""
  @State private var total = ""
  @State private var items: [ManualItem] = [ManualItem()]
  @State private var busy = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ScrollView {
          VStack(alignment: .leading, spacing: 14) {
            VouchField(label: "Merchant", placeholder: "Trader Joe's", text: $merchant)
            VouchField(label: "Date", placeholder: "Aug 20", text: $date)
            VouchField(label: "Total", placeholder: "42.10", text: $total)
            Text("ITEMS")
              .font(.system(size: 11, weight: .heavy, design: .monospaced))
              .tracking(1)
            ForEach($items) { $item in
              HStack {
                TextField("Oat milk", text: $item.name)
                TextField("4.50", text: $item.price)
                  .frame(width: 80)
                  .keyboardType(.decimalPad)
              }
              .padding(12)
              .background(VouchColor.paper2)
              .overlay(Rectangle().stroke(VouchColor.ink, lineWidth: 2))
            }
            Button("Add item") { items.append(ManualItem()) }
              .font(.system(size: 14, weight: .heavy, design: .rounded))
              .foregroundStyle(VouchColor.ink)
            if let error {
              Text(error).foregroundStyle(VouchColor.pink)
            }
            VouchButton(title: "Save receipt", kind: .primary, busy: busy) {
              Task { await save() }
            }
          }
          .padding(24)
        }
      }
      .navigationTitle("Type it")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Close") { dismiss() }
        }
      }
    }
  }

  private func save() async {
    busy = true
    error = nil
    defer { busy = false }
    var body: [String: Any] = [
      "manual": true,
      "merchant": merchant,
      "date": date,
      "total": total,
      "items": items.map { ["name": $0.name, "price": $0.price] },
    ]
    if let groupId { body["groupId"] = groupId }
    do {
      let created: DocumentCreated = try await APIClient.shared.postJSON("/api/documents", body: body)
      if let id = created.document?.id {
        onCreated(id)
      } else {
        error = created.error ?? "Could not save that receipt."
      }
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not save that receipt."
    }
  }
}

struct ManualItem: Identifiable {
  var id = UUID()
  var name = ""
  var price = ""
}

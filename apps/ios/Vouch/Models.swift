import Foundation

struct SessionPayload: Codable, Equatable {
  var userId: String
  var workspaceId: String
  var email: String
  var displayName: String
  var onboarded: Bool
}

struct SessionEnvelope: Codable {
  var session: SessionPayload?
  var error: String?
  var ok: Bool?
}

struct SplitRow: Codable, Identifiable {
  var id: String
  var status: String?
  var createdAt: String?
  var error: String?
  var merchant: String
  var date: String
  var total: String
  var people: Int?
}

struct DocumentsEnvelope: Codable {
  var documents: [SplitRow]
}

struct GroupMember: Codable, Identifiable {
  var id: String
  var displayName: String
  var status: String
  var userId: String?
  var inviteToken: String?
}

struct GroupRow: Codable, Identifiable {
  var id: String
  var name: String
  var information: String?
  var starred: Bool
  var members: [GroupMember]
}

struct GroupsEnvelope: Codable {
  var groups: [GroupRow]
}

struct AccountEnvelope: Codable {
  var account: AccountPayload?
  var error: String?
}

struct AccountPayload: Codable {
  var email: String
  var displayName: String
}

struct DocumentRef: Codable {
  var id: String
  var status: String
  var title: String?
}

struct DocumentCreated: Codable {
  var document: DocumentRef?
  var error: String?
}

struct ReceiptField: Codable, Identifiable {
  var id: String
  var key: String
  var label: String
  var modelValue: String?
  var humanValue: String?
  var status: String?

  var shown: String {
    let human = humanValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !human.isEmpty { return human }
    return modelValue ?? ""
  }
}

struct SplitClaim: Codable {
  var fieldId: String?
  var displayName: String?
  var stance: String?
}

struct SeatRow: Codable, Identifiable {
  var memberId: String
  var displayName: String
  var status: String
  var inviteToken: String
  var you: Bool?

  var id: String { memberId }
}

struct DocumentDetail: Codable {
  var document: DocumentMeta
  var fields: [ReceiptField]
  var claims: [SplitClaim]
  var seats: [SeatRow]
  var you: YouSeat?
}

struct YouSeat: Codable {
  var memberId: String
  var displayName: String
}

struct DocumentMeta: Codable {
  var id: String
  var title: String?
  var status: String
  var error: String?
  var shareToken: String?
  var groupId: String?
  var paidByName: String?
}

struct InviteCreated: Codable {
  var member: InviteMember
}

struct InviteMember: Codable {
  var id: String
  var displayName: String
  var status: String
  var inviteToken: String
}

struct GroupCreated: Codable {
  var group: GroupRef
}

struct GroupRef: Codable {
  var id: String
  var name: String
}

struct LedgerPayload: Codable {
  var group: GroupRef
  var members: [GroupMember]
  var receipts: [SplitRow]
  var balances: [PersonNet]
  var suggested: [SuggestedPay]
  var analytics: LedgerAnalytics
  var people: [String]
  var activity: [ActivityEvent]?
}

struct ActivityEvent: Codable, Identifiable {
  var id: String
  var actorName: String
  var action: String
  var detail: ActivityDetail?
  var createdAt: String
  var documentId: String?

  func copy(youName: String?) -> String {
    let actor: String = {
      guard let youName, !youName.isEmpty,
            actorName.caseInsensitiveCompare(youName) == .orderedSame else { return actorName }
      return "You"
    }()
    switch action {
    case "receipt": return "\(actor) added a receipt"
    case "claimed":
      let item = detail?.item?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      return item.isEmpty ? "\(actor) vouched an item" : "\(actor) vouched \(item)"
    case "settled":
      return "\(actor) marked \(detail?.from ?? "") → \(detail?.to ?? "") settled"
    case "invited":
      return "\(actor) added \(detail?.name ?? "someone")"
    case "group_updated":
      return "\(actor) updated the group"
    default:
      return "\(actor) \(action)"
    }
  }

  var symbol: String {
    switch action {
    case "receipt": "receipt"
    case "claimed": "checkmark.square"
    case "settled": "arrow.left.arrow.right"
    case "invited": "person.badge.plus"
    default: "circle"
    }
  }

  var stamp: String { ActivityStamp.format(createdAt) }
}

struct ActivityDetail: Codable {
  var item: String?
  var from: String?
  var to: String?
  var name: String?
}

struct ActivityFeedItem: Identifiable {
  var event: ActivityEvent
  var groupId: String
  var groupName: String
  var id: String { event.id }
}

enum ActivityStamp {
  static func format(_ raw: String) -> String {
    guard let date = parse(raw) else { return "" }
    let time = DateFormatter()
    time.dateFormat = "h:mm a"
    if Calendar.current.isDateInToday(date) {
      return "Today at \(time.string(from: date))"
    }
    if Calendar.current.isDateInYesterday(date) {
      return "Yesterday at \(time.string(from: date))"
    }
    let weekday = DateFormatter()
    weekday.dateFormat = "EEEE 'at' h:mm a"
    return weekday.string(from: date)
  }

  static func parse(_ raw: String) -> Date? {
    let frac = ISO8601DateFormatter()
    frac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = frac.date(from: raw) { return date }
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime]
    return iso.date(from: raw)
  }
}

struct PersonNet: Codable, Identifiable {
  var name: String
  var net: Double
  var id: String { name }
}

struct SuggestedPay: Codable, Identifiable {
  var from: String
  var to: String
  var amount: Double
  var id: String { "\(from)-\(to)-\(amount)" }
}

struct LedgerAnalytics: Codable {
  var totals: AnalyticsTotals
  var people: [AnalyticsPerson]
  var merchants: [AnalyticsMerchant]
  var buckets: [AnalyticsBucket]
}

struct AnalyticsTotals: Codable {
  var groupSpending: Double
  var youPaid: Double
  var yourShare: Double
}

struct AnalyticsPerson: Codable, Identifiable {
  var name: String
  var paid: Double
  var share: Double
  var id: String { name }
}

struct AnalyticsMerchant: Codable, Identifiable {
  var name: String
  var spending: Double
  var receipts: Int
  var id: String { name }
}

struct AnalyticsBucket: Codable, Identifiable {
  var key: String
  var label: String
  var spending: Double
  var youPaid: Double
  var yourShare: Double
  var id: String { key }
}

struct APIError: LocalizedError {
  var message: String
  var errorDescription: String? { message }
}

enum ReceiptKeys {
  static func isClaimable(_ key: String) -> Bool {
    key == "amount" || key == "tax" || key == "tip" || key == "remainder" || key.range(of: #"^item_\d+$"#, options: .regularExpression) != nil
  }
}

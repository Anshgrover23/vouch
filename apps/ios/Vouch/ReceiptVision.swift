import Foundation
import UIKit
import Vision

struct ParsedReceipt {
  var merchant: String
  var date: String
  var total: String
  var items: [(name: String, price: String)]

  var usable: Bool {
    !merchant.isEmpty && !total.isEmpty
  }

  func body(groupId: String) -> [String: Any] {
    var payload: [String: Any] = [
      "manual": true,
      "merchant": merchant,
      "date": date,
      "total": total,
      "items": items.map { ["name": $0.name, "price": $0.price] },
    ]
    if !groupId.isEmpty { payload["groupId"] = groupId }
    return payload
  }
}

enum ReceiptVision {
  private static let money = try! NSRegularExpression(pattern: #"[$₹€£]?\s*(\d{1,4}(?:[.,]\d{2}))"#)
  private static let date = try! NSRegularExpression(
    pattern: #"\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|[A-Za-z]{3,9}\s+\d{1,2}(?:,?\s+\d{2,4})?)\b"#
  )

  static func parse(_ image: UIImage) async -> ParsedReceipt? {
    guard let cgImage = image.cgImage else { return nil }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: image.visionOrientation)
    do {
      try handler.perform([request])
    } catch {
      return nil
    }
    let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
    return assemble(lines)
  }

  static func assemble(_ lines: [String]) -> ParsedReceipt? {
    let cleaned = lines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    guard !cleaned.isEmpty else { return nil }

    let merchant = cleaned.prefix(6).first { line in
      line.count >= 3 && money.firstMatch(in: line, range: NSRange(location: 0, length: (line as NSString).length)) == nil
    } ?? cleaned[0]

    var date = ""
    var items: [(name: String, price: String)] = []
    var total = ""

    for line in cleaned {
      let ns = line as NSString
      let range = NSRange(location: 0, length: ns.length)
      if date.isEmpty, let match = self.date.firstMatch(in: line, range: range), let swift = Range(match.range, in: line) {
        date = String(line[swift])
      }
      let lower = line.lowercased()
      if lower.contains("total") || lower.contains("amount due") {
        if let match = money.matches(in: line, range: range).last, let swift = Range(match.range(at: 1), in: line) {
          total = String(line[swift]).replacingOccurrences(of: ",", with: ".")
        }
      }
      if let match = money.matches(in: line, range: range).last, let swift = Range(match.range(at: 1), in: line) {
        let price = String(line[swift]).replacingOccurrences(of: ",", with: ".")
        let name = money.stringByReplacingMatches(in: line, options: [], range: range, withTemplate: "")
          .trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty, !lower.contains("total"), name.count < 80 {
          items.append((name: name, price: price))
        }
      }
    }

    if total.isEmpty, let last = items.last {
      total = last.price
    }
    if items.count > 40 { items = Array(items.prefix(40)) }
    return ParsedReceipt(merchant: String(merchant.prefix(80)), date: String(date.prefix(40)), total: total, items: items)
  }
}

private extension UIImage {
  var visionOrientation: CGImagePropertyOrientation {
    switch imageOrientation {
    case .up: .up
    case .down: .down
    case .left: .left
    case .right: .right
    case .upMirrored: .upMirrored
    case .downMirrored: .downMirrored
    case .leftMirrored: .leftMirrored
    case .rightMirrored: .rightMirrored
    @unknown default: .up
    }
  }
}

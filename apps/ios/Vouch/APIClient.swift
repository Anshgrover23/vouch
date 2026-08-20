import Foundation

final class APIClient: @unchecked Sendable {
  static let shared = APIClient()

  let host = URL(string: "https://vouch.anshgrover.com")!
  private let session: URLSession
  private let decoder: JSONDecoder

  private init() {
    let config = URLSessionConfiguration.default
    config.httpCookieStorage = HTTPCookieStorage.shared
    config.httpCookieAcceptPolicy = .always
    config.httpShouldSetCookies = true
    config.httpAdditionalHeaders = ["User-Agent": "Vouch-iOS/0.1"]
    session = URLSession(configuration: config)
    decoder = JSONDecoder()
  }

  func url(_ path: String) -> URL {
    URL(string: path, relativeTo: host)!.absoluteURL
  }

  func me() async -> SessionPayload? {
    var req = URLRequest(url: url("/api/auth/me"))
    req.httpMethod = "GET"
    guard let (data, _) = try? await session.data(for: req) else { return nil }
    return (try? decoder.decode(SessionEnvelope.self, from: data))?.session
  }

  func get<T: Decodable>(_ path: String) async throws -> T {
    var req = URLRequest(url: url(path))
    req.httpMethod = "GET"
    return try await send(req)
  }

  func send<T: Decodable>(_ request: URLRequest) async throws -> T {
    let (data, response) = try await session.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    if status >= 400 {
      if let env = try? decoder.decode(ErrorEnvelope.self, from: data), let message = env.error {
        throw APIError(message: message)
      }
      throw APIError(message: status == 401 ? "unauthorized" : "Request failed (\(status)).")
    }
    do {
      return try decoder.decode(T.self, from: data)
    } catch {
      if let env = try? decoder.decode(ErrorEnvelope.self, from: data), let message = env.error {
        throw APIError(message: message)
      }
      throw error
    }
  }

  func postJSON<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
    var req = URLRequest(url: url(path))
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    return try await send(req)
  }

  func postMultipart(path: String, file: Data, filename: String, slug: String, groupId: String?) async throws -> DocumentCreated {
    let boundary = "vouch-\(UUID().uuidString)"
    var req = URLRequest(url: url(path))
    req.httpMethod = "POST"
    req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    var data = Data()
    func field(_ name: String, _ value: String) {
      data.append("--\(boundary)\r\n".data(using: .utf8)!)
      data.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
      data.append("\(value)\r\n".data(using: .utf8)!)
    }
    field("slug", slug)
    if let groupId, !groupId.isEmpty { field("groupId", groupId) }
    data.append("--\(boundary)\r\n".data(using: .utf8)!)
    data.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
    data.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
    data.append(file)
    data.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
    req.httpBody = data
    return try await send(req)
  }

  func logout() async {
    var req = URLRequest(url: url("/api/auth/logout"))
    req.httpMethod = "POST"
    _ = try? await session.data(for: req)
    HTTPCookieStorage.shared.cookies(for: host)?.forEach { HTTPCookieStorage.shared.deleteCookie($0) }
  }
}

private struct ErrorEnvelope: Codable {
  var error: String?
}

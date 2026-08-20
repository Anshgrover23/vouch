import Foundation
import Observation

@Observable
final class SessionStore {
  var booting = true
  var session: SessionPayload?
  var error: String?

  @MainActor
  func bootstrap() async {
    defer { booting = false }
    session = await APIClient.shared.me()
  }

  @MainActor
  func login(email: String, password: String) async -> Bool {
    error = nil
    do {
      let env: SessionEnvelope = try await APIClient.shared.postJSON("/api/auth/login", body: [
        "email": email,
        "password": password,
      ])
      if let session = env.session {
        self.session = session
        return true
      }
      self.error = env.error ?? "Could not sign in."
      return false
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not sign in."
      return false
    }
  }

  @MainActor
  func signup(name: String, email: String, password: String) async -> Bool {
    error = nil
    do {
      let env: SessionEnvelope = try await APIClient.shared.postJSON("/api/auth/signup", body: [
        "displayName": name,
        "email": email,
        "password": password,
      ])
      if let session = env.session {
        self.session = session
        return true
      }
      self.error = env.error ?? "Could not create that account."
      return false
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not create that account."
      return false
    }
  }

  @MainActor
  func onboard(path: String, groupName: String?) async -> Bool {
    error = nil
    var body: [String: Any] = ["path": path]
    if let groupName { body["groupName"] = groupName }
    do {
      let env: SessionEnvelope = try await APIClient.shared.postJSON("/api/onboarding", body: body)
      if let session = env.session {
        self.session = session
        return true
      }
      self.error = env.error ?? "Could not finish onboarding."
      return false
    } catch {
      self.error = (error as? APIError)?.message ?? "Could not finish onboarding."
      return false
    }
  }

  @MainActor
  func signOut() async {
    await APIClient.shared.logout()
    session = nil
  }
}

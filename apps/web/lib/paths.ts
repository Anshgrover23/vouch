export function safeNextPath(raw: string | null | undefined, fallback = "/inbox") {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("://") || raw.includes("\\")) return fallback;
  return raw;
}

export function afterAuthPath(onboarded: boolean, next: string | null | undefined) {
  const dest = safeNextPath(next, onboarded ? "/inbox" : "/onboarding");
  if (dest.startsWith("/s/")) return dest;
  if (!onboarded) return "/onboarding";
  if (dest === "/login" || dest === "/signup" || dest === "/onboarding") return "/inbox";
  return dest;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailIssue(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value) return "Enter your email.";
  if (value.length > 320) return "That email is too long.";
  if (!EMAIL.test(value)) return "That doesn't look like an email.";
  return null;
}

export function parseEmail(raw: unknown) {
  if (emailIssue(raw)) return null;
  return String(raw ?? "").trim().toLowerCase();
}

export function passwordIssue(raw: unknown) {
  const password = String(raw ?? "");
  if (!password) return "Enter your password.";
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 128) return "That password is too long.";
  return null;
}

export function parsePassword(raw: unknown) {
  if (passwordIssue(raw)) return null;
  return String(raw ?? "");
}

export function parseGroupName(raw: unknown) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) return null;
  return name;
}

export function parseGroupId(raw: unknown) {
  const id = String(raw ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return id;
}

export function parseGroupNotes(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (text.length > 2000) return null;
  return text;
}

export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error && typeof error.cause === "object" && error.cause && "code" in error.cause) {
    return String((error.cause as { code: unknown }).code);
  }
}

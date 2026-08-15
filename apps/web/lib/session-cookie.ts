export const COOKIE = "proofsheet_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

export function sessionCookieFlags() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export type Session = {
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  onboarded: boolean;
};

function secret() {
  // Static process.env.SESSION_SECRET so Edge middleware inlines the same value
  // Node uses (loaded from repo-root .env.local in next.config.ts).
  return process.env.SESSION_SECRET || "dev-only-change-me";
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const bin = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacHex(payload: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}

function asSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.userId !== "string" || typeof row.workspaceId !== "string" || typeof row.email !== "string") {
    return null;
  }
  return {
    userId: row.userId,
    workspaceId: row.workspaceId,
    email: row.email,
    displayName: typeof row.displayName === "string" ? row.displayName : "",
    onboarded:
      row.userId === "11111111-1111-1111-1111-111111111111"
        ? true
        : row.onboarded === undefined
          ? true
          : Boolean(row.onboarded),
  };
}

export async function encodeSession(session: Session) {
  const payload = toBase64Url(JSON.stringify(session));
  return `${payload}.${await hmacHex(payload)}`;
}

export async function decodeSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await hmacHex(payload);
  if (!timingSafeEqualHex(sig, expected)) return null;
  try {
    return asSession(JSON.parse(fromBase64Url(payload)));
  } catch {
    return null;
  }
}

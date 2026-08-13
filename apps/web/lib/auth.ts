import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DEMO_USER_ID, DEMO_WORKSPACE_ID } from "@proofsheet/db";

const COOKIE = "proofsheet_session";

function secret() {
  return process.env.SESSION_SECRET || "dev-only-change-me";
}

export type Session = { userId: string; workspaceId: string; email: string };

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function encodeSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("unauthorized");
  }
  return session;
}

export function demoSession(): Session {
  return {
    userId: DEMO_USER_ID,
    workspaceId: DEMO_WORKSPACE_ID,
    email: "demo@proofsheet.dev",
  };
}

export { COOKIE };

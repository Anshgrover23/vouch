import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_USER_ID, DEMO_WORKSPACE_ID } from "@proofsheet/db";
import {
  COOKIE,
  decodeSession,
  encodeSession,
  type Session,
} from "@/lib/session-cookie";

export type { Session };
export { COOKIE, decodeSession, encodeSession };

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function sessionCookieOptions() {
  return {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production",
  };
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
    displayName: "Demo reviewer",
    onboarded: true,
  };
}

export async function attachSession(res: NextResponse, session: Session) {
  res.cookies.set(COOKIE, await encodeSession(session), sessionCookieOptions());
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { ...cookieBase, maxAge: 0 });
  return res;
}

export function publicSession(session: Session) {
  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    email: session.email,
    displayName: session.displayName,
    onboarded: session.onboarded,
  };
}

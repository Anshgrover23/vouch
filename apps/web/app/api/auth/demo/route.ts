import { NextResponse } from "next/server";
import { COOKIE, demoSession, encodeSession, getSession } from "@/lib/auth";

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
};

export async function POST() {
  const session = demoSession();
  const res = NextResponse.json({ ok: true, session: { email: session.email } });
  res.cookies.set(COOKIE, encodeSession(session), cookieOpts);
  return res;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null }, { status: 401 });
  return NextResponse.json({ session });
}

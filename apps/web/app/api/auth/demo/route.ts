import { NextResponse } from "next/server";
import { attachSession, demoSession, getSession, publicSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null }, { status: 401 });
  return NextResponse.json({ session: publicSession(session) });
}

export async function POST() {
  const session = demoSession();
  const res = NextResponse.json({ ok: true, session: publicSession(session) });
  return attachSession(res, session);
}

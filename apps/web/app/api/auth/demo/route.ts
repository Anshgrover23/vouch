import { cookies } from "next/headers";
import { COOKIE, demoSession, encodeSession } from "@/lib/auth";

export async function POST() {
  const session = demoSession();
  const jar = await cookies();
  jar.set(COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return Response.json({ ok: true, session: { email: session.email } });
}

export async function GET() {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) return Response.json({ session: null }, { status: 401 });
  return Response.json({ session });
}

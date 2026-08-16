import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@proofsheet/db";
import { bindInviteSeat, bindSeatError, loadWorkspaceMembership } from "@/lib/account";
import { attachSession, publicSession, type Session } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseEmail, parsePassword } from "@/lib/paths";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; invite?: string };
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  if (!email || !password) {
    return NextResponse.json({ error: "Need an email and a password of at least 8 characters." }, { status: 400 });
  }

  const [user] = await db().select().from(users).where(eq(users.email, email)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const membership = await loadWorkspaceMembership(db(), user.id);
  if (!membership) {
    return NextResponse.json({ error: "That account has no workspace." }, { status: 403 });
  }

  const invite = String(body.invite ?? "").trim();
  let displayName = user.displayName;
  if (invite) {
    const bound = await bindInviteSeat(db(), invite, { userId: user.id, displayName: user.displayName });
    if (!bound.ok) {
      return NextResponse.json(
        { error: bindSeatError(bound.code, bound.name) },
        { status: bound.code === "not_found" ? 404 : 409 },
      );
    }
    displayName = bound.member.displayName;
  }

  const session: Session = {
    userId: user.id,
    workspaceId: membership.workspaceId,
    email: user.email,
    displayName,
    onboarded: Boolean(user.onboardedAt),
  };
  const res = NextResponse.json({ ok: true, session: publicSession(session) });
  return attachSession(res, session);
}

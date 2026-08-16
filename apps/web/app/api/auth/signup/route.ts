import { NextResponse } from "next/server";
import { bindSeatError, isUniqueViolation, memberByInvite, provisionAccount, acceptGroupInvite } from "@/lib/account";
import { attachSession, publicSession, type Session } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseEmail, parsePassword, pgErrorCode } from "@/lib/paths";
import { hashPassword } from "@/lib/password";
import { parseDisplayName } from "@/lib/split";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    displayName?: string;
    invite?: string;
  };
  const email = parseEmail(body.email);
  const password = parsePassword(body.password);
  const invite = (body.invite ?? url.searchParams.get("invite") ?? "").trim() || undefined;
  const seat = invite ? await memberByInvite(db(), invite) : null;
  if (invite && !seat) {
    return NextResponse.json({ error: "That invite link is not available." }, { status: 404 });
  }
  const displayName = seat ? parseDisplayName(seat.displayName) : parseDisplayName(body.displayName);
  if (!email || !password || !displayName) {
    return NextResponse.json(
      { error: "Need an email, a name, and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const { user, workspace } = await db().transaction(async (tx) => {
      const account = await provisionAccount(tx, { email, displayName, passwordHash });
      if (!invite) {
        return { user: account.user, workspace: account.workspace };
      }
      const invited = await acceptGroupInvite(tx, invite, {
        userId: account.user.id,
        displayName,
      });
      if (!invited) return { user: account.user, workspace: account.workspace };
      if (!invited.ok) throw new Error(invited.code);
      return {
        user: { ...account.user, displayName: invited.member.displayName },
        workspace: { id: invited.group.workspaceId },
      };
    });

    const session: Session = {
      userId: user.id,
      workspaceId: workspace.id,
      email: user.email,
      displayName: user.displayName,
      onboarded: false,
    };
    const res = NextResponse.json({ ok: true, session: publicSession(session) });
    return attachSession(res, session);
  } catch (error) {
    if (isUniqueViolation(error) || pgErrorCode(error) === "23505") {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message === "taken" || message === "already_on_bill" || message === "not_found") {
      return NextResponse.json({ error: bindSeatError(message, seat?.displayName) }, { status: 409 });
    }
    console.error("[auth signup]", error);
    return NextResponse.json({ error: "Could not create that account." }, { status: 500 });
  }
}

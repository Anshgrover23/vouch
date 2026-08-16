import { NextResponse } from "next/server";
import { users } from "@proofsheet/db";
import { renameAccountDisplayName } from "@/lib/account";
import { attachSession, publicSession, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDisplayName } from "@/lib/split";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    const [user] = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      account: {
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as { displayName?: string };
    const displayName = parseDisplayName(body.displayName);
    if (!displayName) {
      return NextResponse.json({ error: "Use a name between 1 and 48 characters." }, { status: 400 });
    }
    await renameAccountDisplayName(
      db(),
      { userId: session.userId, workspaceId: session.workspaceId, oldName: session.displayName },
      displayName,
    );
    const next = { ...session, displayName };
    const res = NextResponse.json({ ok: true, session: publicSession(next) });
    return attachSession(res, next);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

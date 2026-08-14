import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@proofsheet/db";
import { createGroupWithOwner } from "@/lib/account";
import { attachSession, publicSession, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGroupName } from "@/lib/paths";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as { path?: string; groupName?: string };
    const path = body.path;
    if (path !== "group" && path !== "one-off" && path !== "skip") {
      return NextResponse.json({ error: "Pick a group, a one-off receipt, or skip." }, { status: 400 });
    }

    let groupId: string | undefined;
    if (path === "group") {
      const name = parseGroupName(body.groupName);
      if (!name) {
        return NextResponse.json({ error: "Name the group in 1 to 80 characters." }, { status: 400 });
      }
      const group = await createGroupWithOwner(db(), {
        workspaceId: session.workspaceId,
        userId: session.userId,
        displayName: session.displayName,
        name,
      });
      if (!group) return NextResponse.json({ error: "Could not create that group." }, { status: 400 });
      groupId = group.id;
    }

    await db()
      .update(users)
      .set({ onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, session.userId));

    const next = { ...session, onboarded: true };
    const res = NextResponse.json({ ok: true, groupId, session: publicSession(next) });
    return attachSession(res, next);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error("[onboarding]", error);
    return NextResponse.json({ error: "Could not finish onboarding." }, { status: 500 });
  }
}

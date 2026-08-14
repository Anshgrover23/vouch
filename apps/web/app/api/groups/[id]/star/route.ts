import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { groupStars } from "@proofsheet/db";
import { groupInWorkspace } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const group = await groupInWorkspace(db(), id, session.workspaceId);
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { starred?: boolean };
    const [existing] = await db()
      .select({ groupId: groupStars.groupId })
      .from(groupStars)
      .where(and(eq(groupStars.groupId, group.id), eq(groupStars.userId, session.userId)))
      .limit(1);
    const currently = Boolean(existing);
    const starred = typeof body.starred === "boolean" ? body.starred : !currently;

    if (starred && !currently) {
      await db().insert(groupStars).values({ userId: session.userId, groupId: group.id });
    } else if (!starred && currently) {
      await db()
        .delete(groupStars)
        .where(and(eq(groupStars.groupId, group.id), eq(groupStars.userId, session.userId)));
    }

    return NextResponse.json({ starred });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

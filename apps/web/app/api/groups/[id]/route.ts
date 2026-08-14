import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { groupStars, groups } from "@proofsheet/db";
import { logActivity } from "@/lib/activity";
import { groupInWorkspace } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGroupName, parseGroupNotes } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const group = await groupInWorkspace(db(), id, session.workspaceId);
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });
    const [star] = await db()
      .select({ groupId: groupStars.groupId })
      .from(groupStars)
      .where(and(eq(groupStars.groupId, group.id), eq(groupStars.userId, session.userId)))
      .limit(1);
    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        information: group.information ?? "",
        starred: Boolean(star),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const group = await groupInWorkspace(db(), id, session.workspaceId);
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { name?: string; information?: string };
    const name = body.name == null ? group.name : parseGroupName(body.name);
    const information = body.information == null ? group.information : parseGroupNotes(body.information);
    if (!name) return NextResponse.json({ error: "Name the group in 1 to 80 characters." }, { status: 400 });
    if (information == null) return NextResponse.json({ error: "Keep notes under 2000 characters." }, { status: 400 });

    const [updated] = await db()
      .update(groups)
      .set({ name, information: information || null, updatedAt: new Date() })
      .where(eq(groups.id, group.id))
      .returning();

    await logActivity(db(), {
      workspaceId: session.workspaceId,
      groupId: group.id,
      actorName: session.displayName,
      action: "group_updated",
      detail: { name: updated.name },
    });

    return NextResponse.json({
      group: { id: updated.id, name: updated.name, information: updated.information ?? "" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

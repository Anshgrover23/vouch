import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { documents, groupMembers } from "@proofsheet/db";
import { ensureDocumentGroup } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { parseDisplayName } from "@/lib/split";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [doc] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { displayName?: string };
    const displayName = parseDisplayName(body.displayName);
    if (!displayName) {
      return NextResponse.json({ error: "Use a name between 1 and 48 characters." }, { status: 400 });
    }

    const group = await ensureDocumentGroup(db(), doc, {
      userId: session.userId,
      displayName: session.displayName,
    });
    if (!group) return NextResponse.json({ error: "Could not create a group for this receipt." }, { status: 400 });

    const [member] = await db()
      .insert(groupMembers)
      .values({
        groupId: group.id,
        displayName,
        status: "invited",
      })
      .returning();

    await logActivity(db(), {
      workspaceId: session.workspaceId,
      groupId: group.id,
      documentId: doc.id,
      actorName: session.displayName,
      action: "invited",
      detail: { name: displayName },
    });

    return NextResponse.json({
      member: {
        id: member.id,
        displayName: member.displayName,
        status: member.status,
        inviteToken: member.inviteToken,
      },
      groupId: group.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error("[document invites POST]", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

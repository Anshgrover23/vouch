import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { groupMembers, groupStars, groups } from "@proofsheet/db";
import { createGroupWithOwner } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGroupName } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await db().select().from(groups).where(eq(groups.workspaceId, session.workspaceId));
    const ids = rows.map((row) => row.id);
    const [memberRows, starRows] = ids.length
      ? await Promise.all([
          db().select().from(groupMembers).where(inArray(groupMembers.groupId, ids)),
          db()
            .select({ groupId: groupStars.groupId })
            .from(groupStars)
            .where(eq(groupStars.userId, session.userId)),
        ])
      : [[], []];
    const membersByGroup = new Map<string, typeof memberRows>();
    for (const member of memberRows) {
      const list = membersByGroup.get(member.groupId) ?? [];
      list.push(member);
      membersByGroup.set(member.groupId, list);
    }
    const starred = new Set(starRows.map((row) => row.groupId));

    return NextResponse.json({
      groups: rows
        .map((group) => ({
          id: group.id,
          name: group.name,
          information: group.information ?? "",
          starred: starred.has(group.id),
          createdAt: group.createdAt,
          members: (membersByGroup.get(group.id) ?? []).map((member) => ({
            id: member.id,
            displayName: member.displayName,
            status: member.status,
            userId: member.userId,
            inviteToken: member.inviteToken,
          })),
        }))
        .sort((a, b) => Number(b.starred) - Number(a.starred) || a.name.localeCompare(b.name)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error("[groups GET]", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = parseGroupName(body.name);
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
    return NextResponse.json({ group: { id: group.id, name: group.name } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error("[groups POST]", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

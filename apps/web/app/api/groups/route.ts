import { NextResponse } from "next/server";
import { createGroupWithOwner } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listWorkspaceGroups } from "@/lib/groups-list";
import { parseGroupName } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({ groups: await listWorkspaceGroups(db(), session) });
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

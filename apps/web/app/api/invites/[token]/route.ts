import { NextResponse } from "next/server";
import { documents, groupMembers, groups } from "@proofsheet/db";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = String(token ?? "").trim();
  if (!invite) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [member] = await db().select().from(groupMembers).where(eq(groupMembers.inviteToken, invite)).limit(1);
  if (!member) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [group] = await db().select().from(groups).where(eq(groups.id, member.groupId)).limit(1);
  let shareToken: string | null = null;
  if (group) {
    const [doc] = await db().select().from(documents).where(eq(documents.groupId, group.id)).limit(1);
    shareToken = doc?.shareToken ?? null;
  }

  return NextResponse.json({
    displayName: member.displayName,
    status: member.status,
    claimed: Boolean(member.userId),
    shareToken,
  });
}

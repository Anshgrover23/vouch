import { NextResponse } from "next/server";
import { settlements } from "@proofsheet/db";
import { logActivity } from "@/lib/activity";
import { groupInWorkspace } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSettlementAmount } from "@/lib/ledger";
import { parseDisplayName } from "@/lib/split";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const group = await groupInWorkspace(db(), id, session.workspaceId);
    if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string; amount?: unknown };
    const fromName = parseDisplayName(body.from);
    const toName = parseDisplayName(body.to);
    const amount = parseSettlementAmount(body.amount);
    if (!fromName || !toName || fromName === toName || amount == null) {
      return NextResponse.json({ error: "Need two different people and an amount." }, { status: 400 });
    }

    const [row] = await db()
      .insert(settlements)
      .values({
        groupId: group.id,
        workspaceId: session.workspaceId,
        fromName,
        toName,
        amount: amount.toFixed(2),
        createdBy: session.userId,
      })
      .returning();

    await logActivity(db(), {
      workspaceId: session.workspaceId,
      groupId: group.id,
      actorName: session.displayName,
      action: "settled",
      detail: { from: fromName, to: toName, amount },
    });

    return NextResponse.json({
      settlement: {
        id: row.id,
        fromName: row.fromName,
        toName: row.toName,
        amount: Number(row.amount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error("[settlements POST]", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadGroupLedger } from "@/lib/group-ledger";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const ledger = await loadGroupLedger(db(), {
      groupId: id,
      workspaceId: session.workspaceId,
      userId: session.userId,
      youName: session.displayName,
    });
    if (!ledger) return NextResponse.json({ error: "not found" }, { status: 404 });
    const filename = `${ledger.group.name.replace(/[^\w]+/g, "-").toLowerCase() || "group"}-receipts.csv`;
    return new NextResponse(ledger.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

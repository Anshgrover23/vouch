import { desc, eq } from "drizzle-orm";
import { usageEvents } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await db()
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.workspaceId, session.workspaceId))
      .orderBy(desc(usageEvents.createdAt))
      .limit(50);
    const totals = rows.reduce(
      (acc, r) => {
        acc.pages += r.pages;
        acc.tokenIn += r.tokenIn;
        acc.tokenOut += r.tokenOut;
        return acc;
      },
      { pages: 0, tokenIn: 0, tokenOut: 0 },
    );
    return Response.json({ events: rows, totals });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

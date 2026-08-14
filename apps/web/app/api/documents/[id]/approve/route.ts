import { eq } from "drizzle-orm";
import { auditEvents, documents, fields } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { visibleFields } from "@/lib/remainder";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [doc] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const fieldRows = visibleFields(await db().select().from(fields).where(eq(fields.documentId, id)));
    const blocked = fieldRows.filter((f) => f.status === "needs_review" && !f.humanValue);
    if (blocked.length) {
      return Response.json(
        { error: "low-confidence fields still need a human value", blocked: blocked.map((f) => f.key) },
        { status: 409 },
      );
    }
    await db().update(documents).set({ status: "approved", updatedAt: new Date() }).where(eq(documents.id, id));
    await db().insert(auditEvents).values({
      workspaceId: session.workspaceId,
      documentId: id,
      actorId: session.userId,
      action: "approve_document",
      detail: {},
    });
    const exportJson = Object.fromEntries(
      fieldRows.map((f) => [f.key, f.humanValue ?? f.modelValue]),
    );
    return Response.json({ ok: true, export: exportJson });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

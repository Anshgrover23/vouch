import { and, eq } from "drizzle-orm";
import { auditEvents, fields } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = (await req.json()) as { fieldId: string; value: string };
    const [field] = await db().select().from(fields).where(eq(fields.id, body.fieldId)).limit(1);
    if (!field || field.documentId !== id || field.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    await db()
      .update(fields)
      .set({
        humanValue: body.value,
        reviewedBy: session.userId,
        status: "reviewed",
        updatedAt: new Date(),
      })
      .where(and(eq(fields.id, field.id)));
    await db().insert(auditEvents).values({
      workspaceId: session.workspaceId,
      documentId: id,
      actorId: session.userId,
      action: "review_field",
      detail: { fieldId: field.id, key: field.key, humanValue: body.value, modelValue: field.modelValue },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

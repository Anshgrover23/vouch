import { and, eq } from "drizzle-orm";
import { auditEvents, fields, splitClaims } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncComputedTotal, syncRemainderField } from "@/lib/remainder";
import { isItemRowKey, isReceiptTotalSourceKey, sanitizeFieldValue } from "@/lib/split";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = (await req.json()) as { fieldId?: string; value?: string; label?: string; ignored?: boolean };
    if (!body.fieldId) return Response.json({ error: "Need a line." }, { status: 400 });

    const [field] = await db().select().from(fields).where(eq(fields.id, body.fieldId)).limit(1);
    if (!field || field.documentId !== id || field.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    if (body.ignored) {
      if (!isItemRowKey(field.key)) {
        return Response.json({ error: "That line cannot be removed." }, { status: 400 });
      }
      await db().delete(splitClaims).where(eq(splitClaims.fieldId, field.id));
      await db()
        .update(fields)
        .set({
          status: "ignored",
          reviewedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(fields.id, field.id)));
      await db().insert(auditEvents).values({
        workspaceId: session.workspaceId,
        documentId: id,
        actorId: session.userId,
        action: "ignore_field",
        detail: { fieldId: field.id, key: field.key, label: field.label },
      });
      await syncComputedTotal(db(), id);
      await syncRemainderField(db(), id, session.workspaceId);
      return Response.json({ ok: true });
    }

    const patch: { humanValue?: string; label?: string; status: string; reviewedBy: string; updatedAt: Date } = {
      status: "reviewed",
      reviewedBy: session.userId,
      updatedAt: new Date(),
    };

    if (body.label != null) {
      if (!isItemRowKey(field.key)) {
        return Response.json({ error: "That line cannot be renamed." }, { status: 400 });
      }
      const label = sanitizeFieldValue(body.label).replace(/\s+/g, " ");
      if (!label || label.length > 80) {
        return Response.json({ error: "Name the line in 1 to 80 characters." }, { status: 400 });
      }
      patch.label = label;
    }

    if (body.value != null) {
      const value = String(body.value).trim();
      if (value.length > 240) {
        return Response.json({ error: "Keep that value short." }, { status: 400 });
      }
      patch.humanValue = value;
    }

    if (patch.label == null && patch.humanValue == null) {
      return Response.json({ error: "Need a line and a value." }, { status: 400 });
    }

    await db().update(fields).set(patch).where(and(eq(fields.id, field.id)));
    await db().insert(auditEvents).values({
      workspaceId: session.workspaceId,
      documentId: id,
      actorId: session.userId,
      action: "review_field",
      detail: {
        fieldId: field.id,
        key: field.key,
        humanValue: patch.humanValue ?? field.humanValue,
        label: patch.label ?? field.label,
        modelValue: field.modelValue,
      },
    });
    if (isReceiptTotalSourceKey(field.key) && patch.humanValue != null) {
      await syncComputedTotal(db(), id);
    }
    if (field.key !== "remainder") {
      await syncRemainderField(db(), id, session.workspaceId);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

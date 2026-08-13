import { and, eq } from "drizzle-orm";
import { documents, fields } from "@proofsheet/db";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json()) as { fieldId?: string; value?: string };
  const value = String(body.value ?? "").trim();
  if (!body.fieldId || value.length > 240) {
    return Response.json({ error: "Need a line and a short value." }, { status: 400 });
  }

  const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });

  const [field] = await db()
    .select()
    .from(fields)
    .where(and(eq(fields.id, body.fieldId), eq(fields.documentId, doc.id)))
    .limit(1);
  if (!field) return Response.json({ error: "not found" }, { status: 404 });

  await db()
    .update(fields)
    .set({
      humanValue: value,
      status: "reviewed",
      updatedAt: new Date(),
    })
    .where(eq(fields.id, field.id));

  return Response.json({ ok: true });
}

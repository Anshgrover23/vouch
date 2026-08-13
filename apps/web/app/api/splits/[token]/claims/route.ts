import { and, eq } from "drizzle-orm";
import { documents, fields, splitClaims } from "@proofsheet/db";
import { db } from "@/lib/db";
import { parseDisplayName } from "@/lib/split";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await req.json()) as { displayName?: string; fieldId?: string; stance?: string };
  const displayName = parseDisplayName(body.displayName);
  const stance = body.stance === "owe" || body.stance === "not_mine" ? body.stance : null;
  if (!displayName || !body.fieldId || !stance) {
    return Response.json({ error: "Need a display name, a line, and I owe / not mine." }, { status: 400 });
  }

  const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });

  const [field] = await db()
    .select()
    .from(fields)
    .where(and(eq(fields.id, body.fieldId), eq(fields.documentId, doc.id)))
    .limit(1);
  if (!field) return Response.json({ error: "not found" }, { status: 404 });

  const [claim] = await db()
    .insert(splitClaims)
    .values({
      documentId: doc.id,
      fieldId: field.id,
      workspaceId: doc.workspaceId,
      displayName,
      stance,
    })
    .onConflictDoUpdate({
      target: [splitClaims.documentId, splitClaims.fieldId, splitClaims.displayName],
      set: { stance, updatedAt: new Date() },
    })
    .returning();

  const all = await db().select().from(splitClaims).where(eq(splitClaims.documentId, doc.id));
  return Response.json({ claim, claims: all });
}

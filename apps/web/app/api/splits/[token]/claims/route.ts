import { and, eq, ne } from "drizzle-orm";
import { documents, fields, splitClaims } from "@proofsheet/db";
import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDisplayName, type ClaimStance } from "@/lib/split";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const session = await requireSession();
    const displayName = parseDisplayName(session.displayName);
    const { token } = await params;
    const body = (await req.json()) as { fieldId?: string; stance?: string };
    const stance: ClaimStance | null =
      body.stance === "owe" || body.stance === "not_mine" || body.stance === "split" ? body.stance : null;
    if (!displayName || !body.fieldId || !stance) {
      return Response.json({ error: "Need a line, and I owe / split / not mine." }, { status: 400 });
    }

    const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
    if (!doc) return Response.json({ error: "not found" }, { status: 404 });

    const [field] = await db()
      .select()
      .from(fields)
      .where(and(eq(fields.id, body.fieldId), eq(fields.documentId, doc.id)))
      .limit(1);
    if (!field) return Response.json({ error: "not found" }, { status: 404 });

    if (stance === "owe") {
      await db()
        .delete(splitClaims)
        .where(
          and(
            eq(splitClaims.documentId, doc.id),
            eq(splitClaims.fieldId, field.id),
            eq(splitClaims.stance, "owe"),
            ne(splitClaims.displayName, displayName),
          ),
        );
    }

    const stored = stance === "split" ? "owe" : stance;
    const [claim] = await db()
      .insert(splitClaims)
      .values({
        documentId: doc.id,
        fieldId: field.id,
        workspaceId: doc.workspaceId,
        displayName,
        stance: stored,
      })
      .onConflictDoUpdate({
        target: [splitClaims.documentId, splitClaims.fieldId, splitClaims.displayName],
        set: { stance: stored, updatedAt: new Date() },
      })
      .returning();

    const all = await db().select().from(splitClaims).where(eq(splitClaims.documentId, doc.id));
    await logActivity(db(), {
      workspaceId: doc.workspaceId,
      groupId: doc.groupId,
      documentId: doc.id,
      actorName: displayName,
      action: "claimed",
      detail: { fieldId: field.id, stance, item: field.label },
    });
    return Response.json({ claim, claims: all });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });
    console.error("[split claims]", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

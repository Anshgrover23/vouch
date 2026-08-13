import { eq } from "drizzle-orm";
import { documentPages, documents, fields, splitClaims } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tryProcessDocument } from "@/lib/extract";

export const maxDuration = 60;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    let [doc] = await db()
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    if (doc.status === "uploaded" || doc.status === "processing") {
      try {
        await tryProcessDocument(db(), id);
        const [fresh] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
        if (fresh) doc = fresh;
      } catch (error) {
        console.error("[extract]", error);
      }
    }
    const pages = await db().select().from(documentPages).where(eq(documentPages.documentId, id));
    const fieldRows = await db().select().from(fields).where(eq(fields.documentId, id));
    const claims = await db().select().from(splitClaims).where(eq(splitClaims.documentId, id));
    return Response.json({ document: doc, pages, fields: fieldRows, claims });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

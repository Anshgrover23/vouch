import { eq } from "drizzle-orm";
import { documentPages, documents, fields, splitClaims } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [doc] = await db()
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const pages = await db().select().from(documentPages).where(eq(documentPages.documentId, id));
    const fieldRows = await db().select().from(fields).where(eq(fields.documentId, id));
    const claims = await db().select().from(splitClaims).where(eq(splitClaims.documentId, id));
    return Response.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        error: doc.error,
        shareToken: doc.shareToken,
        providerMode: doc.providerMode,
      },
      pages: pages.map((p) => ({
        imageUrl: p.imageUrl,
        width: p.width,
        height: p.height,
      })),
      fields: fieldRows,
      claims,
    });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

import { eq } from "drizzle-orm";
import { documentPages, documents, fields, splitClaims } from "@proofsheet/db";
import { db } from "@/lib/db";
import { displayImageUrl } from "@/lib/image-response";
import { syncRemainderField, visibleFields } from "@/lib/remainder";
import { exportLine } from "@/lib/split";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return Response.json({ error: "not found" }, { status: 404 });

  const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });

  const pages = await db().select().from(documentPages).where(eq(documentPages.documentId, doc.id));
  await syncRemainderField(db(), doc.id, doc.workspaceId);
  const fieldRows = visibleFields(await db().select().from(fields).where(eq(fields.documentId, doc.id)));
  const claims = await db().select().from(splitClaims).where(eq(splitClaims.documentId, doc.id));

  return Response.json({
    document: {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      shareToken: doc.shareToken,
    },
    pages: pages.map((p) => ({
      imageUrl: displayImageUrl(doc.sourceUrl || doc.storagePath, `/api/splits/${token}/image`),
      width: p.width,
      height: p.height,
    })),
    fields: fieldRows,
    claims,
    exportLine: exportLine(fieldRows, claims),
  });
}

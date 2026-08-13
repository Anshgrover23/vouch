import { eq } from "drizzle-orm";
import { documents } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageResponse } from "@/lib/image-response";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [doc] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return imageResponse(doc.sourceUrl || doc.storagePath);
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

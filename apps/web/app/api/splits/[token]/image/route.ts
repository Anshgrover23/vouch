import { eq } from "drizzle-orm";
import { documents } from "@proofsheet/db";
import { db } from "@/lib/db";
import { imageResponse } from "@/lib/image-response";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return Response.json({ error: "not found" }, { status: 404 });
  const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });
  return imageResponse(doc.sourceUrl || doc.storagePath);
}

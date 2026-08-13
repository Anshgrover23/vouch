import { eq } from "drizzle-orm";
import { documents } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = (await req.json()) as { url?: string };
    const url = body.url;
    if (!url) return Response.json({ error: "url required" }, { status: 400 });
    const [doc] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const { createProvider } = await import("@proofsheet/interfaze");
    const provider = createProvider();
    const result = await provider.scrape(url);
    return Response.json({ ok: true, mode: provider.mode, text: result.text, precontext: result.precontext });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

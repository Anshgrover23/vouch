import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { documents, jobs, templates } from "@proofsheet/db";
import { SAMPLE_PAYMENT_PATH, SAMPLE_RECEIPT_PATH, templates as templateMeta } from "@proofsheet/interfaze";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { providerMode } from "@/lib/flags";

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await db()
      .select()
      .from(documents)
      .where(eq(documents.workspaceId, session.workspaceId))
      .orderBy(desc(documents.createdAt));
    return Response.json({ documents: rows, mode: providerMode() });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

async function saveUpload(file: File, origin: string) {
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > 8 * 1024 * 1024) throw new Error("file too large");
  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, name), buf);
  return { url: `${origin}/uploads/${name}`, mime: file.type || "image/jpeg" };
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const origin = new URL(req.url).origin;
    const ctype = req.headers.get("content-type") ?? "";
    let slug = "grocery-receipt";
    let sourceUrl = "";
    let title: string | undefined;
    let mimeType = "image/png";

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      slug = String(form.get("slug") ?? "grocery-receipt");
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const saved = await saveUpload(file, origin);
        sourceUrl = saved.url;
        mimeType = saved.mime;
        title = file.name;
      }
    } else {
      const body = (await req.json()) as { slug?: string; sourceUrl?: string; title?: string };
      slug = body.slug ?? "grocery-receipt";
      sourceUrl = body.sourceUrl ?? "";
      title = body.title;
    }

    const meta = templateMeta[slug as keyof typeof templateMeta];
    const [template] = await db()
      .select()
      .from(templates)
      .where(and(eq(templates.workspaceId, session.workspaceId), eq(templates.slug, slug)))
      .limit(1);
    if (!template || !meta) {
      return Response.json({ error: "unknown template" }, { status: 400 });
    }
    const samplePath = slug === "payment-screenshot" ? SAMPLE_PAYMENT_PATH : SAMPLE_RECEIPT_PATH;
    if (!sourceUrl) sourceUrl = `${origin}${samplePath}`;

    const [doc] = await db()
      .insert(documents)
      .values({
        workspaceId: session.workspaceId,
        templateId: template.id,
        uploadedBy: session.userId,
        title: title ?? `${template.name} sample`,
        status: "uploaded",
        storagePath: sourceUrl,
        sourceUrl,
        mimeType,
        providerMode: providerMode(),
      })
      .returning();

    await db().insert(jobs).values({
      workspaceId: session.workspaceId,
      documentId: doc.id,
      type: "extract",
      status: "queued",
      payload: { slug },
    });

    return Response.json({ document: doc });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}

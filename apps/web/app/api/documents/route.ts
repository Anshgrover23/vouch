import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { documents, fields, jobs, splitClaims, templates } from "@proofsheet/db";
import { SAMPLE_PAYMENT_PATH, SAMPLE_RECEIPT_PATH, templates as templateMeta } from "@proofsheet/interfaze";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tryProcessDocument } from "@/lib/extract";
import { providerMode } from "@/lib/flags";
import { resizeReceipt, storageConfigured, uploadReceipt } from "@/lib/receipt-storage";
import { fieldValue, formatMoney, prettyTitle, receiptHeadline, shortDate, vouchedCount } from "@/lib/split";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await db()
      .select()
      .from(documents)
      .where(eq(documents.workspaceId, session.workspaceId))
      .orderBy(desc(documents.createdAt));
    const ids = rows.map((row) => row.id);
    const [fieldRows, claimRows] = ids.length
      ? await Promise.all([
          db().select().from(fields).where(inArray(fields.documentId, ids)),
          db()
            .select({ documentId: splitClaims.documentId, displayName: splitClaims.displayName })
            .from(splitClaims)
            .where(inArray(splitClaims.documentId, ids)),
        ])
      : [[], []];

    const fieldsByDoc = new Map<string, typeof fieldRows>();
    for (const field of fieldRows) {
      const list = fieldsByDoc.get(field.documentId) ?? [];
      list.push(field);
      fieldsByDoc.set(field.documentId, list);
    }
    const claimsByDoc = new Map<string, { displayName: string }[]>();
    for (const claim of claimRows) {
      const list = claimsByDoc.get(claim.documentId) ?? [];
      list.push(claim);
      claimsByDoc.set(claim.documentId, list);
    }

    return Response.json({
      documents: rows.map((doc) => {
        const docFields = fieldsByDoc.get(doc.id) ?? [];
        const docClaims = claimsByDoc.get(doc.id) ?? [];
        return {
          id: doc.id,
          status: doc.status,
          createdAt: doc.createdAt,
          error: doc.error,
          merchant: receiptHeadline(docFields, prettyTitle(doc.title)),
          date: shortDate(fieldValue(docFields, "date")),
          total: formatMoney(fieldValue(docFields, "total") || fieldValue(docFields, "amount")),
          people: vouchedCount(docClaims),
        };
      }),
      mode: providerMode(),
    });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

async function saveUpload(file: File) {
  const raw = Buffer.from(await file.arrayBuffer());
  if (raw.byteLength > 8 * 1024 * 1024) throw new Error("file too large");
  const { body, mime } = await resizeReceipt(raw);
  console.log(`[upload] resized ${raw.byteLength}→${body.byteLength} storage=${storageConfigured()}`);

  if (storageConfigured()) {
    try {
      const url = await uploadReceipt(body);
      return { url, mime };
    } catch (error) {
      console.error("[upload] storage failed", error);
      if (!process.env.VERCEL) throw error;
    }
  }

  if (process.env.VERCEL) {
    return { url: `data:${mime};base64,${body.toString("base64")}`, mime };
  }

  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.jpg`;
  await writeFile(join(dir, name), body);
  return { url: `/uploads/${name}`, mime };
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
        const saved = await saveUpload(file);
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

    after(() =>
      tryProcessDocument(db(), doc.id).catch((error) => {
        console.error("[extract]", error);
      }),
    );

    return Response.json({
      document: { id: doc.id, status: doc.status, title: doc.title },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (message === "file too large") {
      return Response.json({ error: "file too large" }, { status: 400 });
    }
    console.error("[documents POST]", error);
    return Response.json({ error: "failed" }, { status: 400 });
  }
}

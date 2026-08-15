import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { after } from "next/server";
import { documentPages, documents, fields, groups, jobs, templates } from "@proofsheet/db";
import { SAMPLE_PAYMENT_PATH, SAMPLE_RECEIPT_PATH, templates as templateMeta } from "@proofsheet/interfaze";
import { groupInWorkspace } from "@/lib/account";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { tryProcessDocument } from "@/lib/extract";
import { providerMode } from "@/lib/flags";
import { TYPED_RECEIPT } from "@/lib/image-response";
import { logActivity } from "@/lib/activity";
import { manualFieldRows, sanitizeManualReceipt } from "@/lib/manual-receipt";
import { parseGroupId } from "@/lib/paths";
import { resizeReceipt, storageConfigured, uploadReceipt } from "@/lib/receipt-storage";
import { syncRemainderField } from "@/lib/remainder";
import { listWorkspaceSplits } from "@/lib/splits-list";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return Response.json({
      documents: await listWorkspaceSplits(db(), session.workspaceId),
      mode: providerMode(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("[documents GET]", error);
    return Response.json({ error: "failed" }, { status: 500 });
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

async function resolveGroupId(workspaceId: string, requested: unknown) {
  const requestedId = parseGroupId(requested);
  if (requestedId) {
    const group = await groupInWorkspace(db(), requestedId, workspaceId);
    if (!group) return { error: "Unknown group." as const };
    return { id: group.id };
  }
  const [activeGroup] = await db()
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.workspaceId, workspaceId))
    .orderBy(desc(groups.createdAt))
    .limit(1);
  return { id: activeGroup?.id };
}

async function createManualDocument(
  session: { workspaceId: string; userId: string; displayName: string },
  raw: unknown,
) {
  const parsed = sanitizeManualReceipt(raw);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const body = raw && typeof raw === "object" ? (raw as { groupId?: unknown }) : {};
  const group = await resolveGroupId(session.workspaceId, body.groupId);
  if ("error" in group) return Response.json({ error: group.error }, { status: 400 });

  const [template] = await db()
    .select()
    .from(templates)
    .where(and(eq(templates.workspaceId, session.workspaceId), eq(templates.slug, parsed.value.slug)))
    .limit(1);
  if (!template) return Response.json({ error: "unknown template" }, { status: 400 });

  const [doc] = await db()
    .insert(documents)
    .values({
      workspaceId: session.workspaceId,
      templateId: template.id,
      uploadedBy: session.userId,
      title: parsed.value.title,
      status: "needs_review",
      storagePath: TYPED_RECEIPT,
      sourceUrl: null,
      mimeType: "text/plain",
      providerMode: providerMode(),
      groupId: group.id,
      paidByName: session.displayName,
    })
    .returning();

  await db().insert(documentPages).values({
    documentId: doc.id,
    workspaceId: session.workspaceId,
    pageIndex: 0,
    imageUrl: "",
    width: 800,
    height: 1100,
  });

  const rows = manualFieldRows(parsed.value);
  if (rows.length) {
    await db().insert(fields).values(
      rows.map((row) => ({
        documentId: doc.id,
        workspaceId: session.workspaceId,
        key: row.key,
        label: row.label,
        modelValue: row.modelValue,
        confidence: "1",
        bounds: null,
        status: "reviewed",
      })),
    );
  }

  await syncRemainderField(db(), doc.id, session.workspaceId);

  await logActivity(db(), {
    workspaceId: session.workspaceId,
    groupId: group.id,
    documentId: doc.id,
    actorName: session.displayName,
    action: "receipt",
    detail: { title: parsed.value.title },
  });

  return Response.json({
    document: { id: doc.id, status: doc.status, title: doc.title },
  });
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
    let requestedGroup: unknown;

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      slug = String(form.get("slug") ?? "grocery-receipt");
      requestedGroup = form.get("groupId");
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const saved = await saveUpload(file);
        sourceUrl = saved.url;
        mimeType = saved.mime;
        title = file.name;
      }
    } else {
      const body = (await req.json()) as {
        slug?: string;
        sourceUrl?: string;
        title?: string;
        manual?: boolean;
        groupId?: string;
      };
      if (body.manual) return await createManualDocument(session, body);
      slug = body.slug ?? "grocery-receipt";
      sourceUrl = body.sourceUrl ?? "";
      title = body.title;
      requestedGroup = body.groupId;
    }

    const meta = templateMeta[slug as keyof typeof templateMeta];
    const templatePromise = db()
      .select()
      .from(templates)
      .where(and(eq(templates.workspaceId, session.workspaceId), eq(templates.slug, slug)))
      .limit(1);
    const groupPromise = resolveGroupId(session.workspaceId, requestedGroup);
    const [[template], group] = await Promise.all([templatePromise, groupPromise]);
    if ("error" in group) return Response.json({ error: group.error }, { status: 400 });
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
        groupId: group.id,
        paidByName: session.displayName,
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

    await logActivity(db(), {
      workspaceId: session.workspaceId,
      groupId: group.id,
      documentId: doc.id,
      actorName: session.displayName,
      action: "receipt",
      detail: { title: doc.title },
    });

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

import { eq } from "drizzle-orm";
import postgres from "postgres";
import { claimNextJobSql, createDb, documents, documentPages, fields, jobs, loadRootEnv, precontextBlobs, templates, usageEvents, workspaces } from "@proofsheet/db";
import { createProvider, fieldLabels } from "@proofsheet/interfaze";

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const raw = postgres(url, { max: 2 });
const db = createDb(url, { asService: true });
const provider = createProvider();

console.log(`[worker] provider=${provider.mode}`);

async function claimJob() {
  const rows = await raw.unsafe(claimNextJobSql);
  return rows[0] as
    | {
        id: string;
        document_id: string | null;
        workspace_id: string;
        type: string;
        attempts: number;
      }
    | undefined;
}

async function processExtract(job: { id: string; document_id: string | null; workspace_id: string }) {
  if (!job.document_id) throw new Error("job missing document_id");

  const [doc] = await db.select().from(documents).where(eq(documents.id, job.document_id)).limit(1);
  if (!doc) throw new Error("document not found");
  const [template] = await db.select().from(templates).where(eq(templates.id, doc.templateId)).limit(1);
  if (!template) throw new Error("template not found");
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, doc.workspaceId)).limit(1);
  if (!workspace) throw new Error("workspace not found");

  await db.update(documents).set({ status: "processing", updatedAt: new Date() }).where(eq(documents.id, doc.id));

  const source = doc.sourceUrl || doc.storagePath;
  const guard = await provider.guard({ imageUrl: source, text: `Review ${template.slug}` });
  if (!guard.safe) {
    await db
      .update(documents)
      .set({ status: "rejected", error: `guardrail ${guard.code ?? guard.raw}`, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));
    await db.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
    return;
  }

  await db.delete(documentPages).where(eq(documentPages.documentId, doc.id));
  await db.delete(fields).where(eq(fields.documentId, doc.id));
  await db.delete(precontextBlobs).where(eq(precontextBlobs.documentId, doc.id));

  const modality = template.modality as "image" | "pdf" | "audio" | "url";
  if (modality === "audio") {
    await provider.transcribe(source);
  } else if (modality === "url") {
    await provider.scrape(source);
  } else {
    const ocr = await provider.ocr(source);
    await db.insert(documentPages).values({
      documentId: doc.id,
      workspaceId: doc.workspaceId,
      pageIndex: 0,
      imageUrl: ocr.imageUrl || source,
      width: ocr.width ?? 1024,
      height: ocr.height ?? 1536,
    });
  }

  if (modality === "audio") {
    await db.insert(documentPages).values({
      documentId: doc.id,
      workspaceId: doc.workspaceId,
      pageIndex: 0,
      imageUrl: source,
      width: 800,
      height: 200,
    });
  }

  const extracted = await provider.extract({
    sourceUrl: source,
    prompt: `Extract fields for template ${template.slug}`,
    schema: template.jsonSchema as Record<string, unknown>,
    schemaName: template.slug,
    modality,
  });

  const threshold = Number(workspace.confidenceThreshold);
  let needsReview = false;

  for (const field of extracted.fields) {
    if (!field.value?.trim() || field.key === "items") continue;
    const confidence = field.confidence;
    const status = confidence >= threshold ? "auto" : "needs_review";
    if (status === "needs_review") needsReview = true;
    await db.insert(fields).values({
      documentId: doc.id,
      workspaceId: doc.workspaceId,
      key: field.key,
      label: field.label || fieldLabels[field.key] || field.key,
      modelValue: field.value,
      confidence: String(confidence),
      bounds: field.bounds,
      status,
    });
  }

  await db.insert(precontextBlobs).values({
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    payload: extracted.precontext,
  });

  const tokenIn = extracted.tokenIn;
  const tokenOut = extracted.tokenOut;

  await db
    .update(documents)
    .set({
      status: needsReview ? "needs_review" : "needs_review",
      tokenIn,
      tokenOut,
      providerMode: provider.mode,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  await db.insert(usageEvents).values({
    workspaceId: doc.workspaceId,
    documentId: doc.id,
    pages: doc.pageCount,
    tokenIn,
    tokenOut,
  });

  const evalUrl = process.env.EVAL_URL;
  if (evalUrl) {
    try {
      await fetch(`${evalUrl}/eval`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: doc.id, source }),
      });
    } catch {
      // sidecar optional
    }
  }

  await db.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
}

async function loop() {
  while (true) {
    try {
      const job = await claimJob();
      if (!job) {
        await new Promise((r) => setTimeout(r, 750));
        continue;
      }
      console.log(`[worker] claimed ${job.id} type=${job.type}`);
      try {
        if (job.type === "extract") {
          await processExtract(job);
        } else {
          await db.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] job failed ${job.id}: ${message}`);
        await db
          .update(jobs)
          .set({
            status: job.attempts >= 5 ? "failed" : "queued",
            lastError: String(error),
            lockedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, job.id));
      }
    } catch (error) {
      console.error("[worker]", error);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

loop();

import { eq, sql } from "drizzle-orm";
import {
  documents,
  documentPages,
  fields,
  jobs,
  precontextBlobs,
  templates,
  workspaces,
  type Database,
} from "@proofsheet/db";
import { createProvider, fieldLabels, templates as templateSpecs } from "@proofsheet/interfaze";
import { interfazeImageSource } from "./extract-source";
import { syncRemainderField } from "./remainder";

type JobRow = {
  id: string;
  documentId: string;
  workspaceId: string;
  attempts: number;
};

export async function tryProcessDocument(database: Database, documentId: string) {
  const job = await claimJobForDocument(database, documentId);
  if (!job) return;
  await processExtract(database, job);
}

async function claimJobForDocument(database: Database, documentId: string): Promise<JobRow | undefined> {
  const result = await database.execute(sql`
    update jobs
    set status = 'running',
        attempts = attempts + 1,
        locked_at = now(),
        updated_at = now()
    where id = (
      select id from jobs
      where document_id = ${documentId}::uuid
        and status = 'queued'
      order by created_at
      limit 1
      for update skip locked
    )
    returning id, document_id, workspace_id, attempts
  `);
  const row = Array.from(result as Iterable<Record<string, unknown>>)[0];
  if (!row) return undefined;
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    workspaceId: String(row.workspace_id),
    attempts: Number(row.attempts ?? 1),
  };
}

export async function processExtract(
  database: Database,
  job: { id: string; documentId: string | null; workspaceId: string },
) {
  if (!job.documentId) throw new Error("job missing document_id");

  const provider = createProvider();
  const [doc] = await database.select().from(documents).where(eq(documents.id, job.documentId)).limit(1);
  if (!doc) throw new Error("document not found");
  const [template] = await database.select().from(templates).where(eq(templates.id, doc.templateId)).limit(1);
  if (!template) throw new Error("template not found");
  const [workspace] = await database.select().from(workspaces).where(eq(workspaces.id, doc.workspaceId)).limit(1);
  if (!workspace) throw new Error("workspace not found");

  await database.update(documents).set({ status: "processing", error: null, updatedAt: new Date() }).where(eq(documents.id, doc.id));

  const displayUrl = doc.sourceUrl || doc.storagePath || "";
  const source = await interfazeImageSource(displayUrl, doc.mimeType);

  await database.delete(documentPages).where(eq(documentPages.documentId, doc.id));
  await database.delete(fields).where(eq(fields.documentId, doc.id));
  await database.delete(precontextBlobs).where(eq(precontextBlobs.documentId, doc.id));

  await database.insert(documentPages).values({
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    pageIndex: 0,
    imageUrl: displayUrl.startsWith("data:") ? "" : displayUrl,
    width: 1024,
    height: 1536,
  });

  const spec = templateSpecs[template.slug as keyof typeof templateSpecs];
  const extractStarted = Date.now();
  const bytes = source.startsWith("data:") ? source.length : source;
  let extracted;
  try {
    extracted = await provider.extract({
      sourceUrl: source,
      prompt: spec?.prompt ?? `Extract fields for template ${template.slug}`,
      schema: template.jsonSchema as Record<string, unknown>,
      schemaName: template.slug,
      modality: "image",
    });
    console.log(`[extract] interfaze ${Date.now() - extractStarted}ms bytes=${bytes}`);
  } catch (error) {
    console.error(`[extract] interfaze ${Date.now() - extractStarted}ms bytes=${bytes} failed`, error);
    throw error;
  }

  const ocrSize = extracted.precontext.find((p) => p.name === "ocr")?.result as
    | { width?: number; height?: number }
    | undefined;
  if (ocrSize?.width && ocrSize?.height) {
    await database
      .update(documentPages)
      .set({ width: ocrSize.width, height: ocrSize.height })
      .where(eq(documentPages.documentId, doc.id));
  }

  const threshold = Number(workspace.confidenceThreshold);
  const usable = extracted.fields.filter((field) => field.value?.trim() && field.key !== "items");

  if (usable.length === 0) {
    const fallback = template.slug === "payment-screenshot"
      ? ["sender", "recipient", "amount", "date"]
      : ["merchant", "date", "total"];
    for (const key of fallback) {
      await database.insert(fields).values({
        documentId: doc.id,
        workspaceId: doc.workspaceId,
        key,
        label: fieldLabels[key] || key,
        modelValue: null,
        confidence: "0",
        bounds: null,
        status: "needs_review",
      });
    }
  } else {
    for (const field of usable) {
      const confidence = field.confidence;
      const status = confidence >= threshold ? "auto" : "needs_review";
      await database.insert(fields).values({
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
  }

  await database.insert(precontextBlobs).values({
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    payload: extracted.precontext,
  });

  await database
    .update(documents)
    .set({
      status: "needs_review",
      error: usable.length === 0
        ? "Couldn't read this image. Type the fields or try a clearer receipt photo."
        : null,
      tokenIn: extracted.tokenIn,
      tokenOut: extracted.tokenOut,
      providerMode: provider.mode,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  await syncRemainderField(database, doc.id, doc.workspaceId);

  await database.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
}

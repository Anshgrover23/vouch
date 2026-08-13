import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
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
import { createProvider, fieldLabels } from "@proofsheet/interfaze";

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

  await database.update(documents).set({ status: "processing", updatedAt: new Date() }).where(eq(documents.id, doc.id));

  const displayUrl = doc.sourceUrl || doc.storagePath;
  const source = await interfazeImageSource(displayUrl, doc.mimeType);

  const guard = await provider.guard({ imageUrl: source, text: `Review ${template.slug}` });
  if (!guard.safe) {
    await database
      .update(documents)
      .set({ status: "rejected", error: `guardrail ${guard.code ?? guard.raw}`, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));
    await database.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
    return;
  }

  await database.delete(documentPages).where(eq(documentPages.documentId, doc.id));
  await database.delete(fields).where(eq(fields.documentId, doc.id));
  await database.delete(precontextBlobs).where(eq(precontextBlobs.documentId, doc.id));

  const ocr = await provider.ocr(source);
  await database.insert(documentPages).values({
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    pageIndex: 0,
    imageUrl: displayUrl,
    width: ocr.width ?? 1024,
    height: ocr.height ?? 1536,
  });

  const extracted = await provider.extract({
    sourceUrl: source,
    prompt: `Extract fields for template ${template.slug}`,
    schema: template.jsonSchema as Record<string, unknown>,
    schemaName: template.slug,
    modality: "image",
  });

  const threshold = Number(workspace.confidenceThreshold);

  for (const field of extracted.fields) {
    if (!field.value?.trim() || field.key === "items") continue;
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

  await database.insert(precontextBlobs).values({
    documentId: doc.id,
    workspaceId: doc.workspaceId,
    payload: extracted.precontext,
  });

  await database
    .update(documents)
    .set({
      status: "needs_review",
      tokenIn: extracted.tokenIn,
      tokenOut: extracted.tokenOut,
      providerMode: provider.mode,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  await database.update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
}

async function interfazeImageSource(sourceUrl: string, mimeType: string | null) {
  if (sourceUrl.startsWith("data:")) return sourceUrl;
  const filePath = await findPublicFile(sourceUrl);
  if (!filePath) return sourceUrl;
  const buf = await readFile(filePath);
  const mime = mimeType || (sourceUrl.endsWith(".png") ? "image/png" : "image/jpeg");
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function findPublicFile(sourceUrl: string) {
  let pathname = sourceUrl;
  try {
    pathname = new URL(sourceUrl, "http://local.invalid").pathname;
  } catch {
    pathname = sourceUrl;
  }
  if (!pathname.startsWith("/samples/") && !pathname.startsWith("/uploads/")) return null;
  const rel = pathname.replace(/^\//, "");
  const bases = [
    join(process.cwd(), "public"),
    join(process.cwd(), "apps/web/public"),
    join(process.cwd(), "../web/public"),
  ];
  for (const base of bases) {
    const full = join(base, rel);
    try {
      await access(full);
      return full;
    } catch {
      // try next
    }
  }
  return null;
}

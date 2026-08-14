import { eq } from "drizzle-orm";
import { claimNextJobSql, createDb, createSql, jobs, loadRootEnv, type Database, type Sql } from "@proofsheet/db";
import { processExtract } from "../../web/lib/extract";

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const globalForDb = globalThis as unknown as { sql?: Sql; database?: Database };

function sql() {
  if (!globalForDb.sql) {
    // Survive tsx watch / leftover local stacks: one pool per process, not one per reload.
    globalForDb.sql = createSql(url, { max: 3 });
  }
  return globalForDb.sql;
}

function db() {
  if (!globalForDb.database) {
    globalForDb.database = createDb(url, { sql: sql(), asService: true, max: 3 });
  }
  return globalForDb.database;
}

console.log("[worker] claiming extract jobs");

async function claimJob() {
  const rows = await sql().unsafe(claimNextJobSql);
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
          await processExtract(db(), {
            id: job.id,
            documentId: job.document_id,
            workspaceId: job.workspace_id,
          });
        } else {
          await db().update(jobs).set({ status: "done", updatedAt: new Date() }).where(eq(jobs.id, job.id));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] job failed ${job.id}: ${message}`);
        await db()
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

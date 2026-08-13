import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options?: { asService?: boolean }) {
  const serverless = Boolean(process.env.VERCEL);
  const pooled = /pooler/i.test(url);
  const client = postgres(url, {
    max: serverless ? 1 : options?.asService ? 4 : 8,
    prepare: pooled ? false : undefined,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

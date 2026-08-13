import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options?: { asService?: boolean }) {
  const client = postgres(url, { max: options?.asService ? 4 : 8 });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

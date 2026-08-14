import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Sql = ReturnType<typeof postgres>;

export type CreateDbOptions = {
  asService?: boolean;
  max?: number;
  sql?: Sql;
};

function poolMax(options?: Pick<CreateDbOptions, "asService" | "max">) {
  if (process.env.VERCEL) return 1;
  if (options?.max != null) return options.max;
  return options?.asService ? 3 : 8;
}

/** Shared postgres.js options: cap pool size and reclaim idle/leaked clients. */
export function createSql(url: string, options?: { max?: number }): Sql {
  const pooled = /pooler/i.test(url);
  return postgres(url, {
    max: poolMax(options),
    prepare: pooled ? false : undefined,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
}

export function createDb(url: string, options?: CreateDbOptions) {
  const client = options?.sql ?? createSql(url, { max: poolMax(options) });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

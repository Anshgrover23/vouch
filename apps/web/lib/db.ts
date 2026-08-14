import { createDb, createSql, loadRootEnv, type Database, type Sql } from "@proofsheet/db";

loadRootEnv();

const globalForDb = globalThis as unknown as { sql?: Sql; database?: Database };

export function db(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.database) {
    // Survive Next.js HMR: a module-level cache resets on reload and leaks postgres.js pools.
    globalForDb.sql = createSql(url, { max: 8 });
    globalForDb.database = createDb(url, { sql: globalForDb.sql });
  }
  return globalForDb.database;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

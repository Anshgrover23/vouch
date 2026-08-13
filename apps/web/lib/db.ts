import { createDb, loadRootEnv, type Database } from "@proofsheet/db";

loadRootEnv();

let cached: Database | null = null;

export function db(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached) cached = createDb(url);
  return cached;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

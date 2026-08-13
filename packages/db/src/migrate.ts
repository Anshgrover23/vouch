import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { loadRootEnv } from "./load-env";

loadRootEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const dir = dirname(fileURLToPath(import.meta.url));
const files = ["0001_init.sql", "0003_splits.sql"];

const sql = postgres(url, { max: 1, onnotice: () => {} });
for (const name of files) {
  const body = readFileSync(join(dir, "../sql", name), "utf8");
  await sql.unsafe(body);
  console.log(`migrated ${name}`);
}
await sql.end();

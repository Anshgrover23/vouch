import { and, eq } from "drizzle-orm";
import { splitClaims, type Database } from "@proofsheet/db";
import { parseDisplayName } from "@/lib/split";
import { renameBlockedBy } from "@/lib/identity";

export async function renamePersonOnSplit(
  database: Database,
  documentId: string,
  from: string | null,
  to: string,
) {
  const previous = parseDisplayName(from);
  const next = parseDisplayName(to);
  if (!next) return { ok: false as const, error: "Use a name between 1 and 48 characters.", status: 400 };
  if (!previous || previous === next) return { ok: true as const, renamed: false, name: next };

  const taken = await database
    .select({ displayName: splitClaims.displayName })
    .from(splitClaims)
    .where(and(eq(splitClaims.documentId, documentId), eq(splitClaims.displayName, next)))
    .limit(1);
  const blocked = renameBlockedBy(previous, next, taken.map((row) => row.displayName));
  if (blocked) return { ok: false as const, error: blocked, status: 409 };

  await database
    .update(splitClaims)
    .set({ displayName: next, updatedAt: new Date() })
    .where(and(eq(splitClaims.documentId, documentId), eq(splitClaims.displayName, previous)));

  return { ok: true as const, renamed: true, name: next };
}

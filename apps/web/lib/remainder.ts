import { and, eq } from "drizzle-orm";
import { fields, splitClaims, type Database } from "@proofsheet/db";
import { computedReceiptTotal, parseMoney, remainderGap, type SplitField } from "./split";

export function visibleFields<T extends { status: string }>(rows: T[]) {
  return rows.filter((row) => row.status !== "ignored");
}

function asSplit(rows: Array<typeof fields.$inferSelect>): SplitField[] {
  return visibleFields(rows).map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    modelValue: row.modelValue,
    humanValue: row.humanValue,
  }));
}

export async function syncComputedTotal(database: Database, documentId: string) {
  const rows = await database.select().from(fields).where(eq(fields.documentId, documentId));
  const next = computedReceiptTotal(
    rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      modelValue: row.modelValue,
      humanValue: row.humanValue,
      status: row.status,
    })),
  );
  const totalRow = rows.find((row) => row.key === "total");
  if (!totalRow || next == null) return;
  const current = parseMoney(totalRow.humanValue ?? totalRow.modelValue);
  if (current === next) return;
  await database
    .update(fields)
    .set({
      humanValue: next.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(fields.id, totalRow.id));
}

export async function syncRemainderField(
  database: Database,
  documentId: string,
  workspaceId: string,
) {
  const rows = await database.select().from(fields).where(eq(fields.documentId, documentId));
  const remainders = rows.filter((row) => row.key === "remainder");
  const existing = remainders[0];
  for (const extra of remainders.slice(1)) {
    await database.delete(fields).where(eq(fields.id, extra.id));
  }
  const gap = remainderGap(asSplit(rows));
  const value = gap != null && gap > 0.009 ? gap.toFixed(2) : null;

  if (value) {
    if (!existing) {
      await database.insert(fields).values({
        documentId,
        workspaceId,
        key: "remainder",
        label: "Rest of the bill",
        modelValue: value,
        confidence: "1",
        bounds: null,
        status: "auto",
      });
      return;
    }
    const current = parseMoney(existing.humanValue ?? existing.modelValue);
    const next = parseMoney(value);
    if (current === next && existing.label === "Rest of the bill") return;
    await database
      .update(fields)
      .set({
        label: "Rest of the bill",
        modelValue: value,
        humanValue: null,
        status: "auto",
        updatedAt: new Date(),
      })
      .where(eq(fields.id, existing.id));
    return;
  }

  if (!existing) return;
  const claimed = await database
    .select({ id: splitClaims.id })
    .from(splitClaims)
    .where(and(eq(splitClaims.documentId, documentId), eq(splitClaims.fieldId, existing.id)))
    .limit(1);
  if (claimed.length > 0) return;
  await database.delete(fields).where(eq(fields.id, existing.id));
}

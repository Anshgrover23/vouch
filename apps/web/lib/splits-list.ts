import { and, desc, eq, inArray } from "drizzle-orm";
import { documents, fields, splitClaims, type Database } from "@proofsheet/db";
import { fieldValue, formatMoney, prettyTitle, receiptCurrency, receiptHeadline, shortDate, vouchedCount } from "./split";

const LIST_FIELD_KEYS = ["merchant", "recipient", "date", "total", "amount", "currency"];

export type WorkspaceSplitRow = {
  id: string;
  status: string;
  createdAt: Date;
  error: string | null;
  merchant: string;
  date: string;
  total: string;
  people: number;
};

export async function listWorkspaceSplits(database: Database, workspaceId: string): Promise<WorkspaceSplitRow[]> {
  const docsQuery = database
    .select({
      id: documents.id,
      status: documents.status,
      createdAt: documents.createdAt,
      error: documents.error,
      title: documents.title,
    })
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(desc(documents.createdAt));
  const fieldsQuery = database
    .select({
      documentId: fields.documentId,
      key: fields.key,
      label: fields.label,
      modelValue: fields.modelValue,
      humanValue: fields.humanValue,
    })
    .from(fields)
    .where(and(eq(fields.workspaceId, workspaceId), inArray(fields.key, LIST_FIELD_KEYS)));
  const claimsQuery = database
    .select({ documentId: splitClaims.documentId, displayName: splitClaims.displayName })
    .from(splitClaims)
    .where(eq(splitClaims.workspaceId, workspaceId));
  const [rows, fieldRows, claimRows] = await Promise.all([docsQuery, fieldsQuery, claimsQuery]);

  const fieldsByDoc = new Map<string, typeof fieldRows>();
  for (const field of fieldRows) {
    const list = fieldsByDoc.get(field.documentId) ?? [];
    list.push(field);
    fieldsByDoc.set(field.documentId, list);
  }
  const claimsByDoc = new Map<string, { displayName: string }[]>();
  for (const claim of claimRows) {
    const list = claimsByDoc.get(claim.documentId) ?? [];
    list.push(claim);
    claimsByDoc.set(claim.documentId, list);
  }

  return rows.map((doc) => {
    const docFields = fieldsByDoc.get(doc.id) ?? [];
    const docClaims = claimsByDoc.get(doc.id) ?? [];
    return {
      id: doc.id,
      status: doc.status,
      createdAt: doc.createdAt,
      error: doc.error,
      merchant: receiptHeadline(docFields, prettyTitle(doc.title)),
      date: shortDate(fieldValue(docFields, "date")),
      total: formatMoney(fieldValue(docFields, "total") || fieldValue(docFields, "amount"), receiptCurrency(docFields)),
      people: vouchedCount(docClaims),
    };
  });
}

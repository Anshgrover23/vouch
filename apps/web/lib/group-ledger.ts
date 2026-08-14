import { and, desc, eq, inArray } from "drizzle-orm";
import {
  activityEvents,
  documents,
  fields,
  groupMembers,
  groupStars,
  groups,
  settlements,
  splitClaims,
  type Database,
} from "@proofsheet/db";
import {
  groupTotals,
  personNets,
  receiptsCsv,
  suggestedReimbursements,
  type LedgerReceipt,
  type LedgerSettlement,
} from "@/lib/ledger";
import { fieldValue, formatMoney, prettyTitle, receiptHeadline, shortDate, vouchedCount } from "@/lib/split";
import { visibleFields } from "@/lib/remainder";

type QueryDb = Pick<Database, "select">;

export async function loadGroupLedger(
  database: QueryDb,
  input: { groupId: string; workspaceId: string; userId: string; youName: string },
) {
  const [group] = await database
    .select()
    .from(groups)
    .where(and(eq(groups.id, input.groupId), eq(groups.workspaceId, input.workspaceId)))
    .limit(1);
  if (!group) return null;

  const [docs, members, settlementRows, activityRows, starRows] = await Promise.all([
    database.select().from(documents).where(eq(documents.groupId, group.id)).orderBy(desc(documents.createdAt)),
    database.select().from(groupMembers).where(eq(groupMembers.groupId, group.id)),
    database.select().from(settlements).where(eq(settlements.groupId, group.id)).orderBy(desc(settlements.createdAt)),
    database.select().from(activityEvents).where(eq(activityEvents.groupId, group.id)).orderBy(desc(activityEvents.createdAt)),
    database
      .select({ userId: groupStars.userId })
      .from(groupStars)
      .where(and(eq(groupStars.groupId, group.id), eq(groupStars.userId, input.userId))),
  ]);

  const ids = docs.map((doc) => doc.id);
  const [fieldRows, claimRows] = ids.length
    ? await Promise.all([
        database.select().from(fields).where(inArray(fields.documentId, ids)),
        database.select().from(splitClaims).where(inArray(splitClaims.documentId, ids)),
      ])
    : [[], []];

  const fieldsByDoc = new Map<string, typeof fieldRows>();
  for (const row of visibleFields(fieldRows)) {
    const list = fieldsByDoc.get(row.documentId) ?? [];
    list.push(row);
    fieldsByDoc.set(row.documentId, list);
  }
  const claimsByDoc = new Map<string, typeof claimRows>();
  for (const row of claimRows) {
    const list = claimsByDoc.get(row.documentId) ?? [];
    list.push(row);
    claimsByDoc.set(row.documentId, list);
  }

  const receipts: LedgerReceipt[] = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    paidByName: doc.paidByName,
    fields: (fieldsByDoc.get(doc.id) ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      modelValue: row.modelValue,
      humanValue: row.humanValue,
    })),
    claims: (claimsByDoc.get(doc.id) ?? []).map((row) => ({
      fieldId: row.fieldId,
      displayName: row.displayName,
      stance: row.stance,
    })),
  }));

  const booked: LedgerSettlement[] = settlementRows.map((row) => ({
    fromName: row.fromName,
    toName: row.toName,
    amount: Number(row.amount),
  }));

  const people = [...new Set(members.map((member) => member.displayName))].sort((a, b) => a.localeCompare(b));
  const balances = personNets(receipts, booked);
  const suggested = suggestedReimbursements(balances);
  const totals = groupTotals(receipts, input.youName);

  return {
    group: {
      id: group.id,
      name: group.name,
      information: group.information ?? "",
      starred: starRows.length > 0,
      createdAt: group.createdAt,
    },
    members: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      status: member.status,
      userId: member.userId,
      inviteToken: member.inviteToken,
    })),
    receipts: receipts.map((receipt, index) => {
      const doc = docs[index];
      return {
        id: doc.id,
        merchant: receiptHeadline(receipt.fields, prettyTitle(doc.title)),
        date: shortDate(fieldValue(receipt.fields, "date")),
        total: formatMoney(fieldValue(receipt.fields, "total") || fieldValue(receipt.fields, "amount")),
        paidByName: doc.paidByName,
        people: vouchedCount(receipt.claims),
        createdAt: doc.createdAt,
      };
    }),
    balances,
    suggested,
    totals,
    settlements: settlementRows.map((row) => ({
      id: row.id,
      fromName: row.fromName,
      toName: row.toName,
      amount: Number(row.amount),
      createdAt: row.createdAt,
    })),
    activity: activityRows.map((row) => ({
      id: row.id,
      actorName: row.actorName,
      action: row.action,
      detail: row.detail,
      createdAt: row.createdAt,
    })),
    csv: receiptsCsv(receipts, people),
    people,
  };
}

import {
  assignedTotal,
  fieldValue,
  formatMoney,
  isClaimableKey,
  lineAmount,
  lineLabel,
  parseDisplayName,
  parseMoney,
  personShares,
  receiptHeadline,
  receiptTotal,
  roundMoney,
  shortDate,
  type SplitClaim,
  type SplitField,
} from "./split";

export type LedgerReceipt = {
  id?: string;
  title?: string;
  paidByName: string;
  fields: SplitField[];
  claims: SplitClaim[];
};

export type LedgerSettlement = {
  fromName: string;
  toName: string;
  amount: number;
};

export type PersonNet = {
  name: string;
  net: number;
};

export type SuggestedReimbursement = {
  from: string;
  to: string;
  amount: number;
};

export type GroupTotals = {
  groupSpending: number;
  youPaid: number;
  yourShare: number;
};

function toCents(value: number) {
  return Math.round(roundMoney(value) * 100);
}

function fromCents(cents: number) {
  return roundMoney(cents / 100);
}

export function nameKey(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return key || "person";
}

function bump(nets: Map<string, number>, name: string, cents: number) {
  const label = parseDisplayName(name) ?? name.trim();
  if (!label || cents === 0) return;
  nets.set(label, (nets.get(label) ?? 0) + cents);
}

/** Claimed shares only. Unclaimed remainder never enters the books. */
export function receiptNets(receipts: LedgerReceipt[]) {
  const nets = new Map<string, number>();
  for (const receipt of receipts) {
    const shares = personShares(receipt.fields, receipt.claims);
    let claimed = 0;
    for (const share of shares) {
      const cents = toCents(share.total);
      claimed += cents;
      bump(nets, share.name, -cents);
    }
    const payer = parseDisplayName(receipt.paidByName) ?? receipt.paidByName.trim();
    if (payer && claimed !== 0) bump(nets, payer, claimed);
  }
  return nets;
}

export function applySettlements(nets: Map<string, number>, settlements: LedgerSettlement[]) {
  const next = new Map(nets);
  for (const row of settlements) {
    const amount = toCents(row.amount);
    if (amount <= 0) continue;
    bump(next, row.fromName, amount);
    bump(next, row.toName, -amount);
  }
  return next;
}

export function personNets(receipts: LedgerReceipt[], settlements: LedgerSettlement[] = []): PersonNet[] {
  const cents = applySettlements(receiptNets(receipts), settlements);
  return [...cents.entries()]
    .map(([name, value]) => ({ name, net: fromCents(value) }))
    .filter((row) => row.net !== 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function compareForReimbursement(a: { name: string; total: number }, b: { name: string; total: number }) {
  if (a.total > 0 && 0 > b.total) return -1;
  if (b.total > 0 && 0 > a.total) return 1;
  return a.name < b.name ? -1 : 1;
}

/** Spliit greedy pairwise: debtors pay creditors until nets are zero. */
export function suggestedReimbursements(balances: PersonNet[]): SuggestedReimbursement[] {
  const open = balances
    .map((row) => ({ name: row.name, total: toCents(row.net) }))
    .filter((row) => row.total !== 0)
    .sort(compareForReimbursement);
  const out: SuggestedReimbursement[] = [];
  while (open.length > 1) {
    const first = open[0];
    const last = open[open.length - 1];
    const mixed = first.total + last.total;
    if (first.total > -last.total) {
      out.push({ from: last.name, to: first.name, amount: fromCents(-last.total) });
      first.total = mixed;
      open.pop();
    } else {
      out.push({ from: last.name, to: first.name, amount: fromCents(first.total) });
      last.total = mixed;
      open.shift();
    }
  }
  return out.filter((row) => toCents(row.amount) !== 0);
}

export function groupTotals(receipts: LedgerReceipt[], youName: string): GroupTotals {
  const you = parseDisplayName(youName) ?? youName.trim();
  let groupSpending = 0;
  let youPaid = 0;
  let yourShare = 0;
  for (const receipt of receipts) {
    const paper = receiptTotal(receipt.fields);
    const spending = paper ?? assignedTotal(receipt.fields, receipt.claims);
    if (spending != null) groupSpending += spending;
    const payer = parseDisplayName(receipt.paidByName) ?? receipt.paidByName.trim();
    if (you && payer === you && spending != null) youPaid += spending;
    if (you) {
      const mine = personShares(receipt.fields, receipt.claims).find((row) => row.name === you);
      if (mine) yourShare += mine.total;
    }
  }
  return {
    groupSpending: roundMoney(groupSpending),
    youPaid: roundMoney(youPaid),
    yourShare: roundMoney(yourShare),
  };
}

export function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function csvEscapeRow(cells: Array<string | number>) {
  return cells.map((cell) => csvCell(String(cell))).join(",");
}

export function exportReceiptRows(receipts: LedgerReceipt[], people: string[]) {
  const headers = ["Merchant", "Date", "Total", "Paid by", ...people];
  const rows = receipts.map((receipt) => {
    const shares = new Map(personShares(receipt.fields, receipt.claims).map((row) => [row.name, row.total]));
    const total = receiptTotal(receipt.fields) ?? assignedTotal(receipt.fields, receipt.claims);
    return [
      receiptHeadline(receipt.fields, receipt.title ?? "Receipt"),
      shortDate(fieldValue(receipt.fields, "date")),
      total == null ? "" : total.toFixed(2),
      receipt.paidByName,
      ...people.map((name) => {
        const share = shares.get(name);
        return share == null ? "" : share.toFixed(2);
      }),
    ];
  });
  return { headers, rows };
}

export function exportLineItemRows(receipts: LedgerReceipt[], people: string[]) {
  const headers = ["Merchant", "Date", "Item", "Amount", "Paid by", "Claimed by", ...people];
  const rows: Array<Array<string | number>> = [];
  for (const receipt of receipts) {
    const merchant = receiptHeadline(receipt.fields, receipt.title ?? "Receipt");
    const date = shortDate(fieldValue(receipt.fields, "date"));
    for (const field of receipt.fields) {
      if (!field.id || !isClaimableKey(field.key)) continue;
      const amount = lineAmount(field);
      if (amount == null) continue;
      const owing = receipt.claims.filter((claim) => claim.fieldId === field.id && claim.stance === "owe");
      const each = owing.length > 0 ? roundMoney(amount / owing.length) : null;
      const claimedBy = [...new Set(owing.map((claim) => claim.displayName))];
      rows.push([
        merchant,
        date,
        lineLabel(field),
        amount.toFixed(2),
        receipt.paidByName,
        claimedBy.join(", "),
        ...people.map((name) => {
          if (each == null || !claimedBy.includes(name)) return "";
          return each.toFixed(2);
        }),
      ]);
    }
  }
  return { headers, rows };
}

function csvTable(headers: string[], rows: Array<Array<string | number>>) {
  return [csvEscapeRow(headers), ...rows.map((row) => csvEscapeRow(row))].join("\n");
}

export function receiptsCsv(receipts: LedgerReceipt[], people: string[]) {
  const items = exportLineItemRows(receipts, people);
  const totals = exportReceiptRows(receipts, people);
  return [csvTable(items.headers, items.rows), "", csvTable(totals.headers, totals.rows)].join("\n");
}

export function moneyLabel(value: number, currency?: string) {
  const abs = formatMoney(Math.abs(value), currency);
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

export function parseSettlementAmount(raw: unknown) {
  const n = typeof raw === "number" ? raw : parseMoney(String(raw ?? ""));
  if (n == null || n <= 0 || n > 1_000_000) return null;
  return roundMoney(n);
}

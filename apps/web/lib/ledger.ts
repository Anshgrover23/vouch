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
  createdAt?: Date | string | null;
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

export type AnalyticsPerson = {
  name: string;
  paid: number;
  share: number;
};

export type AnalyticsMerchant = {
  name: string;
  spending: number;
  receipts: number;
};

export type AnalyticsBucket = {
  key: string;
  label: string;
  spending: number;
  youPaid: number;
  yourShare: number;
};

export type LedgerAnalytics = {
  totals: GroupTotals;
  people: AnalyticsPerson[];
  merchants: AnalyticsMerchant[];
  buckets: AnalyticsBucket[];
};

export type AnalyticsRange = "all" | "3m" | "month";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const DAY_MS = 86_400_000;
const WEEK_SPAN_DAYS = 60;

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

function monthIndex(raw: string) {
  return MONTHS[raw.slice(0, 3).toLowerCase()] ?? null;
}

function normalizeYear(raw: string) {
  if (raw.length <= 2) {
    const n = Number(raw);
    return n >= 70 ? 1900 + n : 2000 + n;
  }
  return Number(raw);
}

function utcDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function asUtcDay(value: Date) {
  return utcDay(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function fromFallback(fallback?: Date | string | null) {
  if (fallback == null || fallback === "") return null;
  const date = fallback instanceof Date ? fallback : new Date(fallback);
  if (Number.isNaN(date.getTime())) return null;
  return asUtcDay(date);
}

export function parseReceiptDate(raw: string, fallback?: Date | string | null): Date | null {
  const text = raw.trim();
  const backup = fromFallback(fallback);
  if (!text) return backup;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const iso = new Date(text);
    if (!Number.isNaN(iso.getTime())) return asUtcDay(iso);
  }

  const monthDayYear = text.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYear) {
    const month = monthIndex(monthDayYear[1]);
    if (month != null) return utcDay(Number(monthDayYear[3]), month, Number(monthDayYear[2]));
  }

  const dayMonthYear = text.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?(?:\s+(\d{2,4}))?$/);
  if (dayMonthYear) {
    const month = monthIndex(dayMonthYear[2]);
    const year = dayMonthYear[3] ? normalizeYear(dayMonthYear[3]) : (backup?.getUTCFullYear() ?? new Date().getUTCFullYear());
    if (month != null) return utcDay(year, month, Number(dayMonthYear[1]));
  }

  const slash = text.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{2,4})$/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = normalizeYear(slash[3]);
    if (first > 12 && second <= 12) return utcDay(year, second - 1, first);
    if (second > 12 && first <= 12) return utcDay(year, first - 1, second);
    if (slash[3].length === 4) return utcDay(year, first - 1, second);
    return utcDay(year, second - 1, first);
  }

  const native = new Date(text);
  if (!Number.isNaN(native.getTime()) && /\d/.test(text)) return asUtcDay(native);
  return backup;
}

export function receiptDate(receipt: LedgerReceipt) {
  return parseReceiptDate(fieldValue(receipt.fields, "date"), receipt.createdAt);
}

function receiptSpending(receipt: LedgerReceipt) {
  return receiptTotal(receipt.fields) ?? assignedTotal(receipt.fields, receipt.claims);
}

function weekStart(date: Date) {
  const day = date.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return utcDay(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset);
}

function monthStart(date: Date) {
  return utcDay(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function utcLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}

function bucketMeta(date: Date, grain: "week" | "month", showYear: boolean) {
  if (grain === "week") {
    const start = weekStart(date);
    return {
      key: start.toISOString().slice(0, 10),
      label: utcLabel(start, { day: "numeric", month: "short" }),
      cursor: start,
    };
  }
  const start = monthStart(date);
  const month = utcLabel(start, { month: "short" });
  return {
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    label: showYear ? `${month} ${String(start.getUTCFullYear()).slice(2)}` : month,
    cursor: start,
  };
}

function fillCursors(grain: "week" | "month", min: Date, max: Date) {
  const out: Date[] = [];
  let cursor = grain === "week" ? weekStart(min) : monthStart(min);
  const end = grain === "week" ? weekStart(max) : monthStart(max);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor);
    cursor =
      grain === "week"
        ? new Date(cursor.getTime() + 7 * DAY_MS)
        : utcDay(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
  }
  return out;
}

export function emptyAnalytics(): LedgerAnalytics {
  return { totals: { groupSpending: 0, youPaid: 0, yourShare: 0 }, people: [], merchants: [], buckets: [] };
}

export function groupAnalytics(receipts: LedgerReceipt[], youName: string): LedgerAnalytics {
  const totals = groupTotals(receipts, youName);
  const you = parseDisplayName(youName) ?? youName.trim();
  const people = new Map<string, AnalyticsPerson>();
  const merchants = new Map<string, AnalyticsMerchant>();
  const dated: Array<{ receipt: LedgerReceipt; date: Date; spending: number }> = [];

  for (const receipt of receipts) {
    const spending = receiptSpending(receipt);
    const payer = parseDisplayName(receipt.paidByName) ?? receipt.paidByName.trim();
    if (payer && spending != null && spending !== 0) {
      const row = people.get(payer) ?? { name: payer, paid: 0, share: 0 };
      row.paid += spending;
      people.set(payer, row);
    }
    for (const share of personShares(receipt.fields, receipt.claims)) {
      const row = people.get(share.name) ?? { name: share.name, paid: 0, share: 0 };
      row.share += share.total;
      people.set(share.name, row);
    }
    if (spending != null) {
      const merchant = receiptHeadline(receipt.fields, receipt.title ?? "Receipt");
      const row = merchants.get(merchant) ?? { name: merchant, spending: 0, receipts: 0 };
      row.spending += spending;
      row.receipts += 1;
      merchants.set(merchant, row);
      const date = receiptDate(receipt);
      if (date) dated.push({ receipt, date, spending });
    }
  }

  const buckets: AnalyticsBucket[] = [];
  if (dated.length > 0) {
    let min = dated[0].date;
    let max = dated[0].date;
    for (const row of dated) {
      if (row.date < min) min = row.date;
      if (row.date > max) max = row.date;
    }
    const span = (max.getTime() - min.getTime()) / DAY_MS;
    let grain: "week" | "month" = span < WEEK_SPAN_DAYS ? "week" : "month";
    if (grain === "week" && fillCursors("week", min, max).length > 12) grain = "month";
    const showYear = min.getUTCFullYear() !== max.getUTCFullYear();
    const byKey = new Map<string, AnalyticsBucket>();
    for (const cursor of fillCursors(grain, min, max)) {
      const meta = bucketMeta(cursor, grain, showYear);
      byKey.set(meta.key, { key: meta.key, label: meta.label, spending: 0, youPaid: 0, yourShare: 0 });
    }
    for (const row of dated) {
      const meta = bucketMeta(row.date, grain, showYear);
      const bucket = byKey.get(meta.key);
      if (!bucket) continue;
      bucket.spending += row.spending;
      const payer = parseDisplayName(row.receipt.paidByName) ?? row.receipt.paidByName.trim();
      if (you && payer === you) bucket.youPaid += row.spending;
      if (you) {
        const mine = personShares(row.receipt.fields, row.receipt.claims).find((share) => share.name === you);
        if (mine) bucket.yourShare += mine.total;
      }
    }
    for (const bucket of byKey.values()) {
      buckets.push({
        key: bucket.key,
        label: bucket.label,
        spending: roundMoney(bucket.spending),
        youPaid: roundMoney(bucket.youPaid),
        yourShare: roundMoney(bucket.yourShare),
      });
    }
  }

  return {
    totals,
    people: [...people.values()]
      .map((row) => ({ name: row.name, paid: roundMoney(row.paid), share: roundMoney(row.share) }))
      .filter((row) => row.paid !== 0 || row.share !== 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    merchants: [...merchants.values()]
      .map((row) => ({ name: row.name, spending: roundMoney(row.spending), receipts: row.receipts }))
      .sort((a, b) => b.spending - a.spending || a.name.localeCompare(b.name)),
    buckets,
  };
}

function bucketTime(key: string) {
  return Date.parse(key.length === 7 ? `${key}-01T00:00:00.000Z` : `${key}T00:00:00.000Z`);
}

export function filterBuckets(buckets: AnalyticsBucket[], range: AnalyticsRange, now = new Date()) {
  if (range === "all") return buckets;
  const utc = asUtcDay(now);
  const cutoff =
    range === "month"
      ? monthStart(utc)
      : utcDay(utc.getUTCFullYear(), utc.getUTCMonth() - 2, 1);
  return buckets.filter((bucket) => bucketTime(bucket.key) >= cutoff.getTime());
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

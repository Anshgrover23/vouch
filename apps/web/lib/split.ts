export type SplitField = {
  id?: string;
  key: string;
  label: string;
  modelValue: string | null;
  humanValue: string | null;
};

export type PersonShare = {
  name: string;
  total: number;
  lines: Array<{ label: string; share: number }>;
};

export type SplitClaim = {
  fieldId: string;
  displayName: string;
  stance: string;
};

export type ClaimStance = "owe" | "not_mine" | "split";

export function sanitizeFieldValue(raw: string | null | undefined) {
  const text = (raw ?? "").trim();
  if (!text || /^(null|undefined|none|n\/a|nil|unknown|-)$/i.test(text)) return "";
  return text;
}

export function fieldValue(fields: SplitField[], key: string) {
  const row = fields.find((f) => f.key === key);
  return sanitizeFieldValue(row?.humanValue ?? row?.modelValue);
}

export function parseMoney(value: string | null | undefined) {
  const cleaned = (value ?? "").replace(/[^0-9.]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
};

const CURRENCY_ALIASES: Record<string, string> = {
  $: "USD",
  USD: "USD",
  US$: "USD",
  DOLLAR: "USD",
  DOLLARS: "USD",
  "₹": "INR",
  INR: "INR",
  RS: "INR",
  "RS.": "INR",
  RUPEE: "INR",
  RUPEES: "INR",
  "€": "EUR",
  EUR: "EUR",
  EURO: "EUR",
  "£": "GBP",
  GBP: "GBP",
  POUND: "GBP",
};

export function normalizeCurrency(raw: string | null | undefined) {
  const text = (raw ?? "").trim().toUpperCase();
  if (!text) return "USD";
  return CURRENCY_ALIASES[text] ?? (CURRENCY_SYMBOLS[text] ? text : "USD");
}

export function currencySymbol(code: string) {
  return CURRENCY_SYMBOLS[normalizeCurrency(code)] ?? "$";
}

function inferCurrencyFromValue(value: string) {
  if (/₹|\bRs\.?\b|\bINR\b/i.test(value)) return "INR";
  if (/€|\bEUR\b/i.test(value)) return "EUR";
  if (/£|\bGBP\b/i.test(value)) return "GBP";
  return "USD";
}

export function receiptCurrency(fields: SplitField[]) {
  return normalizeCurrency(fieldValue(fields, "currency"));
}

export function ledgerCurrency(receipts: Array<{ fields: SplitField[] }>) {
  const counts = new Map<string, number>();
  for (const receipt of receipts) {
    const code = receiptCurrency(receipt.fields);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = "USD";
  let n = 0;
  for (const [code, count] of counts) {
    if (count > n) {
      best = code;
      n = count;
    }
  }
  return best;
}

export function formatMoney(value: string | number | null, currency?: string) {
  if (value == null || value === "") return "";
  const code =
    currency != null && currency !== ""
      ? normalizeCurrency(currency)
      : typeof value === "string"
        ? inferCurrencyFromValue(value)
        : "USD";
  const symbol = currencySymbol(code);
  if (typeof value === "number") return `${symbol}${value.toFixed(2)}`;
  const n = parseMoney(value);
  if (n == null) return moneyInputText(value);
  return `${symbol}${n.toFixed(2)}`;
}

export function moneyInputText(value: string | number | null | undefined) {
  if (value == null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value)
    .trim()
    .replace(/^(?:[A-Z]{3}|Rs\.?|US\$)\s*/i, "")
    .replace(/^[₹$€£¥]+\s*/, "");
}

export function shortDate(raw: string) {
  if (!raw) return "";
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && /\d{4}/.test(raw) && raw.includes("-")) {
    return iso.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  const m = raw.match(/([A-Za-z]{3,})\s+(\d{1,2})/);
  if (m) {
    const month = m[1].slice(0, 3);
    return `${m[2]} ${month.charAt(0).toUpperCase()}${month.slice(1).toLowerCase()}`;
  }
  const dmy = raw.match(/(\d{1,2})\s+([A-Za-z]{3,})/);
  if (dmy) {
    const month = dmy[2].slice(0, 3);
    return `${dmy[1]} ${month.charAt(0).toUpperCase()}${month.slice(1).toLowerCase()}`;
  }
  return raw;
}

export function vouchedCount(claims: Array<{ displayName: string }>) {
  return new Set(claims.map((c) => c.displayName)).size;
}

export function exportLine(fields: SplitField[], claims: SplitClaim[]) {
  const merchant = fieldValue(fields, "merchant") || fieldValue(fields, "recipient") || "Receipt";
  const date = shortDate(fieldValue(fields, "date"));
  const currency = receiptCurrency(fields);
  const total = formatMoney(fieldValue(fields, "total") || fieldValue(fields, "amount"), currency);
  const n = vouchedCount(claims);
  const people = n === 1 ? "1 person vouched" : `${n} people vouched`;
  return [merchant, date, total, people].filter(Boolean).join(" — ");
}

export function lineShare(price: string, claims: SplitClaim[], fieldId: string) {
  const amount = parseMoney(price);
  const owing = claims.filter((c) => c.fieldId === fieldId && c.stance === "owe");
  if (amount == null || owing.length === 0) return null;
  return { each: roundMoney(amount / owing.length), names: owing.map((c) => c.displayName), split: owing.length > 1 };
}

export function isClaimableKey(key: string) {
  return key === "amount" || key === "tax" || key === "tip" || key === "remainder" || /^item_\d+$/.test(key);
}

export function isMoneyEditKey(key: string) {
  return key === "amount" || key === "tax" || key === "tip" || /^item_\d+$/.test(key);
}

export function isReceiptTotalSourceKey(key: string) {
  return isItemRowKey(key) || key === "tax" || key === "tip";
}

export function isLineItemKey(key: string) {
  return key === "amount" || /^item_\d+$/.test(key);
}

export function isItemRowKey(key: string) {
  return /^item_\d+$/.test(key);
}

const HEADER_KEYS = ["merchant", "recipient", "sender", "date", "currency", "status", "note"];
const FOOTER_KEYS = ["subtotal", "tax", "tip", "total", "remainder"];

export function isMoneyMetaKey(key: string) {
  return key === "total" || key === "tax" || key === "tip" || key === "subtotal";
}

export function receiptFieldSection(key: string): "header" | "items" | "footer" {
  if (isItemRowKey(key) || key === "amount") return "items";
  if (FOOTER_KEYS.includes(key)) return "footer";
  return "header";
}

function keyRank(order: string[], key: string) {
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
}

export function partitionReceiptFields<T extends { key: string }>(fields: T[]) {
  const header: T[] = [];
  const items: T[] = [];
  const footer: T[] = [];
  for (const field of fields) {
    const section = receiptFieldSection(field.key);
    if (section === "header") header.push(field);
    else if (section === "footer") footer.push(field);
    else items.push(field);
  }
  header.sort((a, b) => keyRank(HEADER_KEYS, a.key) - keyRank(HEADER_KEYS, b.key));
  footer.sort((a, b) => keyRank(FOOTER_KEYS, a.key) - keyRank(FOOTER_KEYS, b.key));
  return { header, items, footer };
}

export function displayNameIssue(raw: unknown) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return "Enter your name.";
  if (name.length > 48) return "Keep it under 48 characters.";
  return null;
}

export function parseDisplayName(raw: unknown) {
  if (displayNameIssue(raw)) return null;
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

export function prettyTitle(raw: string) {
  const name = raw.trim();
  if (!name) return "Receipt";
  if (/^screenshot/i.test(name) || /\.(png|jpe?g|webp)$/i.test(name)) return "Receipt";
  return name.replace(/\.[a-z0-9]+$/i, "");
}

export function receiptHeadline(fields: SplitField[], fallback = "Receipt") {
  return fieldValue(fields, "merchant") || fieldValue(fields, "recipient") || prettyTitle(fallback);
}

function lineAmount(field: SplitField) {
  return parseMoney(sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue));
}

function lineLabel(field: SplitField) {
  const name = (field.label ?? "").trim();
  if (name && parseMoney(name) == null) return name;
  const text = sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
  if (text && parseMoney(text) == null) return text;
  return name || "Item";
}

export function personShares(fields: SplitField[], claims: SplitClaim[]): PersonShare[] {
  const byName = new Map<string, PersonShare>();
  for (const field of fields) {
    if (!field.id || !isClaimableKey(field.key)) continue;
    const amount = lineAmount(field);
    if (amount == null) continue;
    const owing = claims.filter((c) => c.fieldId === field.id && c.stance === "owe");
    if (owing.length === 0) continue;
    const each = roundMoney(amount / owing.length);
    for (const claim of owing) {
      const row = byName.get(claim.displayName) ?? { name: claim.displayName, total: 0, lines: [] };
      row.total += each;
      row.lines.push({ label: lineLabel(field), share: each });
      byName.set(claim.displayName, row);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function unclaimedLines(fields: SplitField[], claims: SplitClaim[]) {
  return fields.filter((field) => {
    if (!field.id || !isClaimableKey(field.key)) return false;
    if (lineAmount(field) == null) return false;
    return !claims.some((c) => c.fieldId === field.id && c.stance === "owe");
  });
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function receiptTotal(fields: SplitField[]) {
  return parseMoney(fieldValue(fields, "total") || fieldValue(fields, "amount"));
}

export function lineItemsSum(fields: SplitField[]) {
  let sum = 0;
  for (const field of fields) {
    if (!isLineItemKey(field.key)) continue;
    const amount = lineAmount(field);
    if (amount != null) sum += amount;
  }
  return roundMoney(sum);
}

export function computedReceiptTotal(fields: Array<SplitField & { status?: string }>) {
  if (!fields.some((field) => isItemRowKey(field.key))) return null;
  let sum = 0;
  for (const field of fields) {
    if (field.status === "ignored") continue;
    if (!isReceiptTotalSourceKey(field.key)) continue;
    const amount = lineAmount(field);
    if (amount != null) sum += amount;
  }
  return roundMoney(sum);
}

export function remainderGap(fields: SplitField[]) {
  const total = parseMoney(fieldValue(fields, "total"));
  if (total == null) return null;
  const tax = parseMoney(fieldValue(fields, "tax")) ?? 0;
  const tip = parseMoney(fieldValue(fields, "tip")) ?? 0;
  const gap = roundMoney(total - lineItemsSum(fields) - tax - tip);
  return Math.abs(gap) < 0.009 ? 0 : gap;
}

export function assignedTotal(fields: SplitField[], claims: SplitClaim[]) {
  return roundMoney(personShares(fields, claims).reduce((sum, person) => sum + person.total, 0));
}

export function splitBalance(fields: SplitField[], claims: SplitClaim[]) {
  const receipt = receiptTotal(fields);
  const assigned = assignedTotal(fields, claims);
  const leftover = unclaimedLines(fields, claims);
  const leftoverSum = roundMoney(
    leftover.reduce((sum, field) => sum + (lineAmount(field) ?? 0), 0),
  );
  const towardReceipt = receipt == null ? leftoverSum : roundMoney(receipt - assigned);
  const open = leftoverSum > 0 ? leftoverSum : Math.max(0, towardReceipt);
  let status: "empty" | "open" | "settled" | "over" = "empty";
  if (assigned === 0 && open === 0) status = "empty";
  else if (receipt != null && assigned > receipt + 0.009) status = "over";
  else if (open > 0.009) status = "open";
  else status = "settled";
  return { receipt, assigned, open, leftover, leftoverSum, status };
}

export function chatSplit(fields: SplitField[], claims: SplitClaim[]) {
  const people = personShares(fields, claims);
  const { open, status } = splitBalance(fields, claims);
  const head = exportLine(fields, claims);
  const currency = receiptCurrency(fields);
  const parts = [
    ...people.map((p) => `${p.name} ${formatMoney(p.total, currency)}`),
    status === "open" ? `still open ${formatMoney(open, currency)}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return head;
  return `${head}\n${parts.join(" · ")}`;
}

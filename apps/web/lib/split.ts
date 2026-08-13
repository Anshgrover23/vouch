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

export function sanitizeFieldValue(raw: string | null | undefined) {
  const text = (raw ?? "").trim();
  if (!text || /^(null|undefined|none|n\/a|nil|unknown|-)$/i.test(text)) return "";
  return text;
}

export function fieldValue(fields: SplitField[], key: string) {
  const row = fields.find((f) => f.key === key);
  return sanitizeFieldValue(row?.humanValue ?? row?.modelValue);
}

export function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value: string | number | null) {
  if (value == null || value === "") return "";
  if (typeof value === "number") return `$${value.toFixed(2)}`;
  const n = parseMoney(value);
  if (n == null) return value;
  return `$${n.toFixed(2)}`;
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
  const total = formatMoney(fieldValue(fields, "total") || fieldValue(fields, "amount"));
  const n = vouchedCount(claims);
  const people = n === 1 ? "1 person vouched" : `${n} people vouched`;
  return [merchant, date, total, people].filter(Boolean).join(" — ");
}

export function lineShare(price: string, claims: SplitClaim[], fieldId: string) {
  const amount = parseMoney(price);
  const owing = claims.filter((c) => c.fieldId === fieldId && c.stance === "owe");
  if (amount == null || owing.length === 0) return null;
  return { each: amount / owing.length, names: owing.map((c) => c.displayName) };
}

export function isClaimableKey(key: string) {
  return key === "amount" || /^item_\d+$/.test(key);
}

export function parseDisplayName(raw: unknown) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 48) return null;
  return name;
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
    const each = amount / owing.length;
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

export function chatSplit(fields: SplitField[], claims: SplitClaim[]) {
  const people = personShares(fields, claims);
  const head = exportLine(fields, claims);
  if (people.length === 0) return head;
  return `${head}\n${people.map((p) => `${p.name} ${formatMoney(p.total)}`).join(" · ")}`;
}

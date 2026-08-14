import { parseMoney, prettyTitle, sanitizeFieldValue } from "./split";

export type ManualLine = {
  name: string;
  price: string;
};

export type SanitizedManualReceipt = {
  merchant: string;
  date: string;
  total: string;
  items: ManualLine[];
  slug: "grocery-receipt";
  title: string;
};

const MAX_MERCHANT = 80;
const MAX_DATE = 40;
const MAX_ITEM_NAME = 80;
const MAX_ITEMS = 40;

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function moneyText(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const amount = parseMoney(text);
  if (amount == null || amount < 0) return null;
  return amount.toFixed(2);
}

function compactText(raw: unknown) {
  return sanitizeFieldValue(String(raw ?? "")).replace(/\s+/g, " ");
}

export function merchantIssue(raw: unknown) {
  const merchant = compactText(raw);
  if (!merchant) return "Name the merchant.";
  if (merchant.length > MAX_MERCHANT) return "Keep the merchant under 80 characters.";
  return null;
}

export function dateIssue(raw: unknown) {
  const date = compactText(raw);
  if (date.length > MAX_DATE) return "Keep the date under 40 characters.";
  return null;
}

export function totalIssue(raw: unknown) {
  if (!moneyText(raw)) return "Enter a receipt total like 12.50.";
  return null;
}

export function lineIssues(row: unknown, index: number) {
  const rec = asRecord(row);
  const name = compactText(rec.name);
  const priceRaw = String(rec.price ?? "").trim();
  if (!name && !priceRaw) return { name: null, price: null };
  return {
    name: name.length > MAX_ITEM_NAME ? "Keep each line name under 80 characters." : null,
    price: moneyText(rec.price) ? null : `Enter a price like 4.50 for line ${index + 1}.`,
  };
}

export function sanitizeManualReceipt(raw: unknown): { ok: true; value: SanitizedManualReceipt } | { ok: false; error: string } {
  const body = asRecord(raw);
  const merchantError = merchantIssue(body.merchant);
  if (merchantError) return { ok: false, error: merchantError };

  const dateError = dateIssue(body.date);
  if (dateError) return { ok: false, error: dateError };

  const totalError = totalIssue(body.total);
  if (totalError) return { ok: false, error: totalError };

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length > MAX_ITEMS) {
    return { ok: false, error: "Keep the receipt to 40 lines." };
  }

  const items: ManualLine[] = [];
  for (const [index, row] of rawItems.entries()) {
    const rec = asRecord(row);
    const name = compactText(rec.name);
    const priceRaw = String(rec.price ?? "").trim();
    if (!name && !priceRaw) continue;
    const issues = lineIssues(row, index);
    if (issues.name) return { ok: false, error: issues.name };
    if (issues.price) return { ok: false, error: issues.price };
    const price = moneyText(rec.price);
    if (!price) return { ok: false, error: `Enter a price like 4.50 for line ${index + 1}.` };
    items.push({
      name: name || `Item ${items.length + 1}`,
      price,
    });
  }

  const merchant = compactText(body.merchant);
  const date = compactText(body.date);
  const total = moneyText(body.total);
  if (!total) return { ok: false, error: "Enter a receipt total like 12.50." };

  return {
    ok: true,
    value: {
      merchant,
      date,
      total,
      items,
      slug: "grocery-receipt",
      title: prettyTitle(merchant),
    },
  };
}

export function manualFieldRows(value: SanitizedManualReceipt) {
  const rows: Array<{ key: string; label: string; modelValue: string }> = [
    { key: "merchant", label: "Merchant", modelValue: value.merchant },
  ];
  if (value.date) rows.push({ key: "date", label: "Date", modelValue: value.date });
  for (const [index, item] of value.items.entries()) {
    rows.push({
      key: `item_${index + 1}`,
      label: item.name,
      modelValue: item.price,
    });
  }
  rows.push({ key: "total", label: "Total", modelValue: value.total });
  return rows;
}

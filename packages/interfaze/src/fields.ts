import { fieldLabels } from "./templates";
import type { ExtractedField } from "./types";

export function usableText(value: unknown) {
  if (value == null || typeof value === "object") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^(null|undefined|none|n\/a|nil|unknown|-)$/i.test(text)) return "";
  return text;
}

/** Interfaze sometimes leaves POS tax flags on the amount (`$3.52T2`). */
export function moneyOnly(value: string) {
  return value.replace(/\s*T\d+\s*$/i, "").trim();
}

const HEADER_KEYS = ["merchant", "recipient", "sender", "date", "status", "note"];
const FOOTER_KEYS = ["subtotal", "tax", "tip", "total", "amount"];
const MONEY_KEYS = new Set(["total", "amount", "subtotal", "tax", "tip"]);

function fieldText(key: string, value: unknown) {
  const text = usableText(value);
  return MONEY_KEYS.has(key) ? moneyOnly(text) : text;
}

function pushField(
  rows: Array<{ key: string; label: string; value: string }>,
  key: string,
  value: unknown,
) {
  const text = fieldText(key, value);
  if (!text) return;
  rows.push({ key, label: fieldLabels[key] ?? key, value: text });
}

export function flattenExtracted(object: Record<string, unknown>) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  const used = new Set<string>(["items"]);

  for (const key of HEADER_KEYS) {
    if (!(key in object)) continue;
    used.add(key);
    pushField(rows, key, object[key]);
  }

  const items = object.items;
  if (Array.isArray(items)) {
    items.forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const rec = item as Record<string, unknown>;
      const name = usableText(rec.name ?? rec.description ?? rec.item);
      const price = moneyOnly(usableText(rec.price ?? rec.amount));
      if (!name && !price) return;
      rows.push({
        key: `item_${i + 1}`,
        label: name || `Item ${i + 1}`,
        value: price || name,
      });
    });
  }

  for (const key of FOOTER_KEYS) {
    if (!(key in object)) continue;
    used.add(key);
    pushField(rows, key, object[key]);
  }

  for (const [key, value] of Object.entries(object)) {
    if (used.has(key)) continue;
    pushField(rows, key, value);
  }

  return rows;
}

export function findLine(
  ocr:
    | {
        sections?: Array<{
          lines?: Array<{
            text: string;
            average_confidence?: number;
            bounds?: ExtractedField["bounds"];
          }>;
        }>;
      }
    | undefined,
  value: string,
) {
  if (!value) return undefined;
  const needle = value.toLowerCase().slice(0, 24);
  for (const section of ocr?.sections ?? []) {
    for (const line of section.lines ?? []) {
      if (line.text.toLowerCase().includes(needle) || needle.includes(line.text.toLowerCase())) {
        return line;
      }
    }
  }
  return undefined;
}

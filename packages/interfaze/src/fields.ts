import { fieldLabels } from "./templates";
import type { ExtractedField } from "./types";

export function usableText(value: unknown) {
  if (value == null || typeof value === "object") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^(null|undefined|none|n\/a|nil|unknown|-)$/i.test(text)) return "";
  return text;
}

export function flattenExtracted(object: Record<string, unknown>) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  const items = object.items;

  for (const [key, value] of Object.entries(object)) {
    if (key === "items") continue;
    const text = usableText(value);
    if (!text) continue;
    rows.push({ key, label: fieldLabels[key] ?? key, value: text });
  }

  if (Array.isArray(items)) {
    items.forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const rec = item as Record<string, unknown>;
      const name = usableText(rec.name ?? rec.description ?? rec.item);
      const price = usableText(rec.price ?? rec.amount);
      if (!name && !price) return;
      rows.push({
        key: `item_${i + 1}`,
        label: name || `Item ${i + 1}`,
        value: price || name,
      });
    });
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

import type { ExtractedField } from "./types";
import { findLine, flattenExtracted } from "./fields";

export type OcrLine = {
  text: string;
  average_confidence?: number;
  bounds?: ExtractedField["bounds"];
};

export type OcrBlob = {
  extracted_text?: string;
  width?: number;
  height?: number;
  sections?: Array<{ lines?: OcrLine[] }>;
};

export type ParsedReceipt = {
  merchant: string;
  date: string;
  total: string;
  items: Array<{ name: string; price: string }>;
};

const MONEY_AT_END = /(?:\$|USD\s*)?(\d{1,6}(?:[.,]\d{2})?)\s*$/i;
const TOTAL_LINE = /\b((?:grand\s*)?total|amount\s*due|balance\s*due|to\s*pay)\b/i;
const SKIP_LINE =
  /^(subtotal|sub\s*total|tax|vat|gst|hst|tip|gratuity|change|cash|card|visa|mastercard|amex|debit|credit|payment|balance|discount|savings|you saved|promo)\b/i;
const SKIP_META =
  /\b(order\s*(no\.?|number|#)|cashier|tel\.?|telephone|phone|fax|store\s*(#|no\.?|number)|thank\s*you)\b/i;
const TABLE_HEADER_WORD = /^(item|qty|quantity|rate|price|subtotal|amount|description)$/i;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const DATE_ISO = /\b(\d{4}-\d{2}-\d{2})\b/;
const DATE_US = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
const DATE_TEXT =
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{2,4})\b/i;

export function ocrLines(text: string, ocr?: OcrBlob): OcrLine[] {
  const fromSections = (ocr?.sections ?? []).flatMap((section) => section.lines ?? []).filter((line) => line.text?.trim());
  if (fromSections.length > 0) return fromSections;
  return (ocr?.extracted_text || text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line }));
}

function moneyIn(text: string) {
  const match = text.replace(/,/g, "").match(MONEY_AT_END);
  if (!match) return "";
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function dateIn(text: string) {
  const iso = text.match(DATE_ISO);
  if (iso) return iso[1];
  const named = text.match(DATE_TEXT);
  if (named) return named[1];
  const us = text.match(DATE_US);
  if (us) return us[0];
  return "";
}

function tableHeaderRow(text: string) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  return words.filter((word) => TABLE_HEADER_WORD.test(word)).length >= 2;
}

function looksLikeMetadata(text: string) {
  if (SKIP_LINE.test(text) || SKIP_META.test(text) || PHONE.test(text)) return true;
  if (tableHeaderRow(text)) return true;
  return false;
}

function looksLikeMerchant(text: string) {
  const trimmed = text.replace(/[^\w\s&'-]/g, " ").trim();
  if (trimmed.length < 3 || trimmed.length > 48) return false;
  if (MONEY_AT_END.test(text) && /\d/.test(text)) return false;
  if (dateIn(text)) return false;
  if (looksLikeMetadata(text) || TOTAL_LINE.test(text)) return false;
  return /[a-z]/i.test(trimmed);
}

export function looksLikePurchasedItem(name: string, price: string) {
  if (!name || !price) return false;
  if (looksLikeMetadata(name)) return false;
  if (!/[a-z]/i.test(name)) return false;
  if (/^\d+[\d\s./-]*$/.test(name)) return false;
  if (/\(?\d{3}\)?/.test(name) && !/[a-z]{3,}/i.test(name)) return false;
  const amount = Number(price);
  if (Number.isInteger(amount) && amount >= 1000) return false;
  return true;
}

export function parseReceiptObject(text: string, ocr?: OcrBlob): ParsedReceipt {
  const lines = ocrLines(text, ocr);
  let merchant = "";
  let date = "";
  let total = "";
  const items: Array<{ name: string; price: string }> = [];

  for (const line of lines) {
    const raw = line.text.replace(/\s+/g, " ").trim();
    if (!raw) continue;

    if (!date) {
      const found = dateIn(raw);
      if (found) {
        date = found;
        continue;
      }
    }

    if (TOTAL_LINE.test(raw)) {
      const amount = moneyIn(raw);
      if (amount) total = amount;
      continue;
    }

    if (looksLikeMetadata(raw)) continue;

    const price = moneyIn(raw);
    if (price) {
      const name = raw.replace(MONEY_AT_END, "").replace(/[.$]/g, " ").replace(/\s+/g, " ").trim();
      if (looksLikePurchasedItem(name, price) && !TOTAL_LINE.test(name)) {
        items.push({ name, price });
        continue;
      }
    }

    if (!merchant && looksLikeMerchant(raw)) merchant = raw;
  }

  return { merchant, date, total, items };
}

export function receiptParseUseful(object: ParsedReceipt) {
  if (object.total && Number(object.total) > 0) return true;
  return object.items.length >= 1;
}

export function receiptParseTrusted(object: ParsedReceipt) {
  if (!receiptParseUseful(object)) return false;
  const good = object.items.filter((item) => looksLikePurchasedItem(item.name, item.price));
  const junk = object.items.length - good.length;
  const junkRate = object.items.length === 0 ? 0 : junk / object.items.length;
  if (junkRate > 0.3) return false;
  if (object.total && Number(object.total) > 0) return good.length >= 1 || object.items.length === 0;
  return good.length >= 2;
}

export function fieldsFromOcr(text: string, ocr?: OcrBlob): ExtractedField[] {
  const object = parseReceiptObject(text, ocr);
  if (!receiptParseUseful(object)) return [];
  return flattenExtracted(object).map((row) => {
    const match = findLine(ocr, row.value) ?? findLine(ocr, row.label);
    return {
      key: row.key,
      label: row.label,
      value: row.value,
      confidence: match?.average_confidence ?? 0.7,
      bounds: match?.bounds ?? null,
    };
  });
}

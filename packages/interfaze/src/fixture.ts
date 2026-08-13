import type { ExtractedField, ExtractResult, GuardResult, InterfazeProvider, PerceptionResult } from "./types";
import { fieldLabels, itemLabel } from "./templates";

function box(x: number, y: number, w: number, h: number) {
  return {
    top_left: { x, y },
    top_right: { x: x + w, y },
    bottom_right: { x: x + w, y: y + h },
    bottom_left: { x, y: y + h },
    width: w,
    height: h,
  };
}

export const SAMPLE_RECEIPT_PATH = "/samples/receipt.png";
export const SAMPLE_PAYMENT_PATH = "/samples/payment.png";
export const RECEIPT_SIZE = { width: 1024, height: 1536 };

const groceryItems = [
  { name: "ORG BLUEBERRIES", price: "6.99", y: 430, confidence: 0.97 },
  { name: "SOURDOUGH LOAF", price: "4.49", y: 488, confidence: 0.96 },
  { name: "OAT MILK", price: "5.29", y: 546, confidence: 0.95 },
  { name: "CHICKEN THIGHS", price: "18.47", y: 604, confidence: 0.94 },
  { name: "SPARKLING WATER", price: "7.99", y: 662, confidence: 0.93 },
  { name: "EGGS 12CT", price: "8.91", y: 720, confidence: 0.91 },
  { name: "SHARP CHEDDAR", price: "12.50", y: 778, confidence: 0.74 },
  { name: "GREEK YOGURT", price: "9.99", y: 836, confidence: 0.92 },
];

const groceryFields: ExtractedField[] = [
  { key: "merchant", label: fieldLabels.merchant, value: "HILLCREST MARKET", confidence: 0.99, bounds: box(180, 78, 660, 72) },
  { key: "date", label: fieldLabels.date, value: "AUG 13 2026", confidence: 0.96, bounds: box(300, 292, 424, 40) },
  ...groceryItems.map((item, i) => ({
    key: `item_${i + 1}`,
    label: itemLabel(i + 1, item.name),
    value: item.price,
    confidence: item.confidence,
    bounds: box(88, item.y, 848, 50),
  })),
  { key: "total", label: fieldLabels.total, value: "84.20", confidence: 0.98, bounds: box(220, 1288, 580, 64) },
];

const paymentFields: ExtractedField[] = [
  { key: "amount", label: fieldLabels.amount, value: "42.00", confidence: 0.99, bounds: box(72, 340, 420, 88) },
  { key: "recipient", label: fieldLabels.recipient, value: "Jordan Hale", confidence: 0.97, bounds: box(72, 478, 520, 36) },
  { key: "sender", label: fieldLabels.sender, value: "Rio Chen", confidence: 0.96, bounds: box(72, 538, 480, 36) },
  { key: "status", label: fieldLabels.status, value: "Completed", confidence: 0.95, bounds: box(72, 628, 200, 44) },
  { key: "date", label: fieldLabels.date, value: "13 Aug 2026", confidence: 0.94, bounds: box(72, 720, 280, 32) },
  { key: "note", label: fieldLabels.note, value: "July rent split", confidence: 0.81, bounds: box(72, 800, 420, 36) },
];

function pack(fields: ExtractedField[], extra?: Partial<ExtractResult>): ExtractResult {
  return {
    fields,
    precontext: [
      {
        name: "ocr",
        result: {
          extracted_text: fields.map((f) => `${f.label} ${f.value}`).join(" "),
          width: RECEIPT_SIZE.width,
          height: RECEIPT_SIZE.height,
          sections: [
            {
              text: "sample",
              lines: fields.map((f) => ({
                text: f.value,
                bounds: f.bounds,
                average_confidence: f.confidence,
                words: [{ text: f.value, bounds: f.bounds, confidence: f.confidence }],
              })),
            },
          ],
        },
      },
    ],
    tokenIn: 4900,
    tokenOut: 250,
    ...extra,
  };
}

function isPayment(name: string, url: string) {
  return name.includes("payment") || url.includes("payment");
}

export class FixtureInterfazeProvider implements InterfazeProvider {
  mode = "fixture" as const;

  async guard(): Promise<GuardResult> {
    return { safe: true, raw: "safe" };
  }

  async ocr(sourceUrl: string): Promise<PerceptionResult> {
    const payment = isPayment("", sourceUrl);
    const fields = payment ? paymentFields : groceryFields;
    return {
      text: fields.map((f) => f.value).join(" "),
      width: RECEIPT_SIZE.width,
      height: RECEIPT_SIZE.height,
      imageUrl: sourceUrl,
      precontext: pack(fields).precontext,
      tokenIn: 2100,
      tokenOut: 80,
    };
  }

  async transcribe(): Promise<PerceptionResult> {
    return {
      text: "",
      precontext: [],
      tokenIn: 0,
      tokenOut: 0,
    };
  }

  async scrape(url: string): Promise<PerceptionResult> {
    return {
      text: `Fixture scrape of ${url}`,
      precontext: [{ name: "scraper", result: { url } }],
      tokenIn: 900,
      tokenOut: 40,
    };
  }

  async extract(input: {
    sourceUrl: string;
    schemaName: string;
    modality: "image" | "pdf" | "audio" | "url";
  }): Promise<ExtractResult> {
    if (isPayment(input.schemaName, input.sourceUrl)) {
      return pack(paymentFields);
    }
    return pack(groceryFields);
  }
}

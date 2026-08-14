export type { Bounds, ExtractedField, ExtractResult, GuardResult, InterfazeProvider, PerceptionResult, PrecontextEntry } from "./types";
export { FixtureInterfazeProvider, SAMPLE_RECEIPT_PATH, SAMPLE_PAYMENT_PATH, RECEIPT_SIZE, groceryFields, GROCERY_LINE_ITEMS, GROCERY_TOTAL, GROCERY_ITEMS_SUM, GROCERY_REMAINDER } from "./fixture";
export { LiveInterfazeProvider } from "./live";
export { flattenExtracted, usableText, findLine } from "./fields";
export { fieldsFromOcr, parseReceiptObject, receiptParseTrusted } from "./receipt-ocr";
export { createProvider } from "./provider";
export {
  templates,
  fieldLabels,
  groceryReceiptSchema,
  paymentScreenshotSchema,
  groceryJsonSchema,
  paymentJsonSchema,
  isClaimableKey,
  itemLabel,
} from "./templates";
export type { TemplateSlug } from "./templates";

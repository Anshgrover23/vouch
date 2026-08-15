import { z } from "zod";

export const groceryReceiptSchema = z.object({
  merchant: z.string().describe("Store or merchant name printed on the receipt"),
  date: z.string().describe("Purchase date on the receipt"),
  currency: z
    .string()
    .describe("ISO currency code from the receipt (INR, USD, EUR, GBP). Use ₹ / Rs / INR as INR."),
  items: z
    .array(
      z.object({
        name: z.string().describe("Line item description"),
        price: z.string().describe("Line item price as a number only, no currency symbol"),
      }),
    )
    .describe("Purchased goods only. Do not put subtotal, tax, tip, cash, or change in this array."),
  subtotal: z.string().optional().describe("Subtotal before tax, if printed"),
  tax: z.string().optional().describe("Tax amount, if printed"),
  tip: z.string().optional().describe("Tip or gratuity, if printed"),
  total: z.string().describe("Grand total charged, including tax, as a number only"),
});

export const paymentScreenshotSchema = z.object({
  sender: z.string().describe("Person who sent the money"),
  recipient: z.string().describe("Person who received the money"),
  amount: z.string().describe("Amount paid as a number only"),
  currency: z.string().describe("ISO currency code (INR, USD, EUR, GBP)"),
  date: z.string().describe("Date of the payment"),
  status: z.string().describe("Payment status such as completed or pending"),
  note: z.string().describe("Memo or note on the payment"),
});

export const groceryJsonSchema = {
  type: "object",
  properties: {
    merchant: { type: "string" },
    date: { type: "string" },
    currency: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price: { type: "string" },
        },
        required: ["name", "price"],
      },
    },
    subtotal: { type: "string" },
    tax: { type: "string" },
    tip: { type: "string" },
    total: { type: "string" },
  },
  required: ["merchant", "date", "currency", "total", "items"],
};

export const paymentJsonSchema = {
  type: "object",
  properties: {
    sender: { type: "string" },
    recipient: { type: "string" },
    amount: { type: "string" },
    currency: { type: "string" },
    date: { type: "string" },
    status: { type: "string" },
    note: { type: "string" },
  },
  required: ["sender", "recipient", "amount", "currency", "date", "status"],
};

export const templates = {
  "grocery-receipt": {
    slug: "grocery-receipt",
    name: "Grocery receipt",
    modality: "image" as const,
    schema: groceryReceiptSchema,
    jsonSchema: groceryJsonSchema,
    samplePath: "/samples/receipt.png",
    prompt:
      "Read this grocery receipt the way it is printed. Extract merchant, date, currency as an ISO code (INR, USD, EUR, GBP), every purchased line item with its line amount, then subtotal if printed, tax if printed, tip if printed, and the grand total. Detect currency from symbols such as ₹, Rs, INR, $, €, or from the merchant country. Line prices often have no symbol; still use that receipt currency. Prices are numeric only — drop tax codes like T2, and do not invent a dollar sign on a rupee bill. Omit a field only when it is not on the paper. Do not put tax, subtotal, tip, cash tendered, or change into the items list. Skip phone numbers, order numbers, cashier lines, and table headers. Never output the word null.",
  },
  "payment-screenshot": {
    slug: "payment-screenshot",
    name: "Payment screenshot",
    modality: "image" as const,
    schema: paymentScreenshotSchema,
    jsonSchema: paymentJsonSchema,
    samplePath: "/samples/payment.png",
    prompt:
      "Extract sender, recipient, amount, currency as an ISO code (INR, USD, EUR, GBP), date, status, and note from this payment confirmation. Detect currency from ₹, Rs, INR, $, €, or the app (UPI, Venmo, PayPal). Amount is numeric only — do not invent a dollar sign on a rupee payment. This is a payment screenshot, not an identity document. If a field is unreadable, omit it. Never output the word null.",
  },
};

export type TemplateSlug = keyof typeof templates;

export const fieldLabels: Record<string, string> = {
  merchant: "Merchant",
  date: "Date",
  currency: "Currency",
  subtotal: "Subtotal",
  tax: "Tax",
  tip: "Tip",
  total: "Total",
  sender: "From",
  recipient: "To",
  amount: "Amount",
  status: "Status",
  note: "Note",
  remainder: "Rest of the bill",
};

export function isClaimableKey(key: string) {
  return key === "amount" || key === "tax" || key === "tip" || key === "remainder" || /^item_\d+$/.test(key);
}

export function itemLabel(index: number, name: string) {
  return name.trim() || `Item ${index}`;
}

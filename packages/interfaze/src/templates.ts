import { z } from "zod";

export const groceryReceiptSchema = z.object({
  merchant: z.string().describe("Store or merchant name printed on the receipt"),
  date: z.string().describe("Purchase date on the receipt"),
  total: z.string().describe("Grand total charged, including tax"),
  items: z
    .array(
      z.object({
        name: z.string().describe("Line item description"),
        price: z.string().describe("Line item price"),
      }),
    )
    .describe("Purchased line items only — skip tax, subtotal, payment rows, phone numbers, order numbers, cashier lines, and item/rate/qty table headers. Use the line price or subtotal, not quantity."),
});

export const paymentScreenshotSchema = z.object({
  sender: z.string().describe("Person who sent the money"),
  recipient: z.string().describe("Person who received the money"),
  amount: z.string().describe("Amount paid"),
  date: z.string().describe("Date of the payment"),
  status: z.string().describe("Payment status such as completed or pending"),
  note: z.string().describe("Memo or note on the payment"),
});

export const templates = {
  "grocery-receipt": {
    slug: "grocery-receipt",
    name: "Grocery receipt",
    modality: "image" as const,
    schema: groceryReceiptSchema,
    samplePath: "/samples/receipt.png",
    prompt:
      "Extract the merchant, date, grand total, and each purchased line item with its price from this grocery receipt. Skip tax, subtotal, payment rows, phone numbers, order numbers, cashier lines, and table headers. If a row has item number, rate, quantity, and subtotal, use the item name and the line price/subtotal only. If this is not a receipt or a field is unreadable, omit that field. Never output the word null.",
  },
  "payment-screenshot": {
    slug: "payment-screenshot",
    name: "Payment screenshot",
    modality: "image" as const,
    schema: paymentScreenshotSchema,
    samplePath: "/samples/payment.png",
    prompt:
      "Extract sender, recipient, amount, date, status, and note from this payment confirmation. This is a payment screenshot, not an identity document. If a field is unreadable, omit it. Never output the word null.",
  },
};

export type TemplateSlug = keyof typeof templates;

export const fieldLabels: Record<string, string> = {
  merchant: "Merchant",
  date: "Date",
  total: "Total",
  sender: "From",
  recipient: "To",
  amount: "Amount",
  status: "Status",
  note: "Note",
  remainder: "Rest of the bill",
};

export function isClaimableKey(key: string) {
  return key === "amount" || key === "remainder" || /^item_\d+$/.test(key);
}

export function itemLabel(index: number, name: string) {
  return name.trim() || `Item ${index}`;
}

export const groceryJsonSchema = {
  type: "object",
  properties: {
    merchant: { type: "string" },
    date: { type: "string" },
    total: { type: "string" },
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
  },
  required: ["merchant", "date", "total", "items"],
};

export const paymentJsonSchema = {
  type: "object",
  properties: {
    sender: { type: "string" },
    recipient: { type: "string" },
    amount: { type: "string" },
    date: { type: "string" },
    status: { type: "string" },
    note: { type: "string" },
  },
  required: ["sender", "recipient", "amount", "date", "status"],
};

export type DefaultTemplate = {
  slug: string;
  name: string;
  modality: string;
  schema: Record<string, unknown>;
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    slug: "grocery-receipt",
    name: "Grocery receipt",
    modality: "image",
    schema: {
      type: "object",
      properties: {
        merchant: { type: "string" },
        date: { type: "string" },
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
      required: ["merchant", "date", "total", "items"],
    },
  },
  {
    slug: "payment-screenshot",
    name: "Payment screenshot",
    modality: "image",
    schema: {
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
    },
  },
];

import { createProvider, SAMPLE_RECEIPT_PATH, templates } from "./index";

const provider = createProvider();
const spec = templates["grocery-receipt"];
const extracted = await provider.extract({
  sourceUrl: SAMPLE_RECEIPT_PATH,
  prompt: spec.prompt,
  schema: { type: "object", properties: { merchant: { type: "string" } } },
  schemaName: spec.slug,
  modality: spec.modality,
});
console.log(JSON.stringify({ mode: provider.mode, fields: extracted.fields }, null, 2));

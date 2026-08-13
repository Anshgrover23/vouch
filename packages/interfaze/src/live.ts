import { Interfaze, responseFormat } from "interfaze";
import type {
  ExtractedField,
  ExtractResult,
  GuardResult,
  InterfazeProvider,
  PerceptionResult,
} from "./types";
import { fieldLabels } from "./templates";

function usage(res: { usage?: { prompt_tokens?: number; completion_tokens?: number } }) {
  return {
    tokenIn: res.usage?.prompt_tokens ?? 0,
    tokenOut: res.usage?.completion_tokens ?? 0,
  };
}

export class LiveInterfazeProvider implements InterfazeProvider {
  mode = "live" as const;
  private client: Interfaze;

  constructor(apiKey: string) {
    this.client = new Interfaze({ apiKey });
  }

  async guard(input: { text?: string; imageUrl?: string }): Promise<GuardResult> {
    const content = input.imageUrl
      ? [
          { type: "text" as const, text: input.text ?? "Check this image" },
          { type: "image_url" as const, image_url: { url: input.imageUrl } },
        ]
      : input.text ?? "";

    const response = await this.client.chat.completions.create({
      guard: ["S1", "S4", "S12_IMAGE"],
      messages: [{ role: "user", content }],
    });
    const raw = response.choices[0]?.message.content ?? "";
    const unsafe = raw.startsWith("unsafe");
    return { safe: !unsafe, code: unsafe ? raw.replace("unsafe ", "") : undefined, raw };
  }

  async ocr(sourceUrl: string): Promise<PerceptionResult> {
    const response = await this.client.chat.completions.create({
      task: "ocr",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all text" },
            { type: "image_url", image_url: { url: sourceUrl } },
          ],
        },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message.content ?? "{}") as {
      result?: { extracted_text?: string; width?: number; height?: number };
    };
    const result = parsed.result ?? {};
    return {
      text: result.extracted_text ?? JSON.stringify(parsed),
      width: result.width,
      height: result.height,
      imageUrl: sourceUrl,
      precontext: (response.precontext ?? []) as PerceptionResult["precontext"],
      ...usage(response),
    };
  }

  async transcribe(sourceUrl: string): Promise<PerceptionResult> {
    const response = await this.client.tasks.transcribe(sourceUrl);
    return {
      text: JSON.stringify(response),
      imageUrl: sourceUrl,
      precontext: [{ name: "stt", result: response }],
      tokenIn: 0,
      tokenOut: 0,
    };
  }

  async scrape(url: string): Promise<PerceptionResult> {
    const response = await this.client.tasks.scrape(url);
    return {
      text: JSON.stringify(response),
      precontext: [{ name: "scraper", result: response }],
      tokenIn: 0,
      tokenOut: 0,
    };
  }

  async extract(input: {
    sourceUrl: string;
    prompt: string;
    schema: Record<string, unknown>;
    schemaName: string;
    modality: "image" | "pdf" | "audio" | "url";
  }): Promise<ExtractResult> {
    const media =
      input.modality === "audio"
        ? { type: "file" as const, file: { filename: "audio.mp4", file_data: input.sourceUrl } }
        : { type: "image_url" as const, image_url: { url: input.sourceUrl } };

    const response = await this.client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: input.prompt }, media],
        },
      ],
      response_format: responseFormat(input.schema, input.schemaName),
    });

    const object = JSON.parse(response.choices[0]?.message.content ?? "{}") as Record<string, unknown>;
    const precontext = (response.precontext ?? []) as ExtractResult["precontext"];
    const ocr = precontext.find((p) => p.name === "ocr")?.result as
      | {
          sections?: Array<{
            lines?: Array<{
              text: string;
              average_confidence?: number;
              bounds?: ExtractedField["bounds"];
              words?: Array<{ text: string; confidence?: number; bounds?: ExtractedField["bounds"] }>;
            }>;
          }>;
        }
      | undefined;

    const fields: ExtractedField[] = flattenExtracted(object).map((row) => {
      const match = findLine(ocr, row.value) ?? findLine(ocr, row.label);
      return {
        key: row.key,
        label: row.label,
        value: row.value,
        confidence: match?.average_confidence ?? 0.9,
        bounds: match?.bounds ?? null,
      };
    });

    return { fields, precontext, ...usage(response) };
  }
}

function flattenExtracted(object: Record<string, unknown>) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  const items = object.items;

  for (const [key, value] of Object.entries(object)) {
    if (key === "items" || value == null || value === "") continue;
    if (typeof value === "object") continue;
    const text = String(value).trim();
    if (!text) continue;
    rows.push({ key, label: fieldLabels[key] ?? key, value: text });
  }

  if (Array.isArray(items)) {
    items.forEach((item, i) => {
      if (!item || typeof item !== "object") return;
      const rec = item as Record<string, unknown>;
      const name = String(rec.name ?? rec.description ?? rec.item ?? "").trim();
      const price = String(rec.price ?? rec.amount ?? "").trim();
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

function findLine(
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

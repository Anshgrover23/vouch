export type Bounds = {
  top_left: { x: number; y: number };
  top_right: { x: number; y: number };
  bottom_right: { x: number; y: number };
  bottom_left: { x: number; y: number };
  width: number;
  height: number;
};

export type ExtractedField = {
  key: string;
  label: string;
  value: string;
  confidence: number;
  bounds: Bounds | null;
};

export type PrecontextEntry = {
  name: string;
  result: unknown;
};

export type GuardResult = {
  safe: boolean;
  code?: string;
  raw: string;
};

export type PerceptionResult = {
  text: string;
  width?: number;
  height?: number;
  imageUrl?: string;
  precontext: PrecontextEntry[];
  tokenIn: number;
  tokenOut: number;
};

export type ExtractResult = {
  fields: ExtractedField[];
  precontext: PrecontextEntry[];
  tokenIn: number;
  tokenOut: number;
};

export type InterfazeProvider = {
  mode: "live" | "fixture";
  guard(input: { text?: string; imageUrl?: string }): Promise<GuardResult>;
  ocr(sourceUrl: string): Promise<PerceptionResult>;
  transcribe(sourceUrl: string): Promise<PerceptionResult>;
  scrape(url: string): Promise<PerceptionResult>;
  extract(input: {
    sourceUrl: string;
    prompt: string;
    schema: Record<string, unknown>;
    schemaName: string;
    modality: "image" | "pdf" | "audio" | "url";
  }): Promise<ExtractResult>;
};

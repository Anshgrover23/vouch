import { FixtureInterfazeProvider } from "./fixture";
import { LiveInterfazeProvider } from "./live";
import type { ExtractResult, GuardResult, InterfazeProvider, PerceptionResult } from "./types";

function liveDown(error: unknown) {
  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);
  return (
    status === 400 ||
    status === 404 ||
    status === 422 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    code === "model_error" ||
    /fetch|ENOTFOUND|ECONNREFUSED|invalid url|unable to (load|fetch)/i.test(message)
  );
}

class LiveWithSampleFallback implements InterfazeProvider {
  mode: "live" | "fixture" = "live";

  constructor(
    private live: LiveInterfazeProvider,
    private sample: FixtureInterfazeProvider,
  ) {}

  private async orSample<T>(step: string, run: (provider: InterfazeProvider) => Promise<T>): Promise<T> {
    try {
      const result = await run(this.live);
      this.mode = "live";
      return result;
    } catch (error) {
      if (!liveDown(error)) throw error;
      const detail = (error as { code?: string; message?: string }).code ?? (error as Error).message;
      console.warn(`[interfaze] ${step} live call failed (${detail}). Using sample data so review can continue.`);
      this.mode = "fixture";
      return run(this.sample);
    }
  }

  guard(input: { text?: string; imageUrl?: string }): Promise<GuardResult> {
    return this.orSample("safety check", (p) => p.guard(input));
  }

  ocr(sourceUrl: string): Promise<PerceptionResult> {
    return this.orSample("read image", (p) => p.ocr(sourceUrl));
  }

  transcribe(sourceUrl: string): Promise<PerceptionResult> {
    return this.orSample("read audio", (p) => p.transcribe(sourceUrl));
  }

  scrape(url: string): Promise<PerceptionResult> {
    return this.orSample("read page", (p) => p.scrape(url));
  }

  extract(input: {
    sourceUrl: string;
    prompt: string;
    schema: Record<string, unknown>;
    schemaName: string;
    modality: "image" | "pdf" | "audio" | "url";
  }): Promise<ExtractResult> {
    return this.orSample("extract fields", (p) => p.extract(input));
  }
}

export function createProvider(): InterfazeProvider {
  const forceFixture = process.env.PROOFSHEET_FIXTURE === "1";
  const key = process.env.INTERFAZE_API_KEY?.trim();
  if (!forceFixture && key) {
    return new LiveWithSampleFallback(new LiveInterfazeProvider(key), new FixtureInterfazeProvider());
  }
  return new FixtureInterfazeProvider();
}

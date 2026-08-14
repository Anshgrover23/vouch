import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "receipts";
const MAX_EDGE = 1800;
const JPEG_QUALITY = 85;

export async function resizeReceipt(buf: Buffer) {
  const body = await sharp(buf)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return { body, mime: "image/jpeg" as const };
}

export function storageConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function isStorageNetworkError(error: unknown): boolean {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const rec = current as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
    const name = typeof rec.name === "string" ? rec.name : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    const code = typeof rec.code === "string" ? rec.code : "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ECONNREFUSED" || code === "ETIMEDOUT") {
      return true;
    }
    if (/fetch failed|storage unavailable/i.test(message)) return true;
    if (name === "TypeError" && /fetch|network/i.test(message)) return true;
    current = rec.cause;
  }
  return false;
}

function client(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function throwStorageError(error: unknown): never {
  if (error instanceof Error && error.message === "storage unavailable") throw error;
  if (isStorageNetworkError(error)) {
    throw new Error("storage unavailable", { cause: error instanceof Error ? error : undefined });
  }
  if (error instanceof Error) throw error;
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "storage failed";
  throw new Error(message);
}

export async function uploadReceipt(body: Buffer) {
  const supabase = client();
  const path = `${randomUUID()}.jpg`;
  try {
    const first = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (first.error) {
      if (isStorageNetworkError(first.error)) throwStorageError(first.error);
      const missing = /not found|does not exist|bucket/i.test(first.error.message);
      if (!missing) throw new Error(first.error.message);
      const created = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg"],
      });
      if (created.error && !/already exists/i.test(created.error.message)) {
        throwStorageError(created.error);
      }
      const retry = await supabase.storage.from(BUCKET).upload(path, body, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (retry.error) throwStorageError(retry.error);
    }
  } catch (error) {
    throwStorageError(error);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

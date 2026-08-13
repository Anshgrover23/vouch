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

function client(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function uploadReceipt(body: Buffer) {
  const supabase = client();
  const path = `${randomUUID()}.jpg`;
  const first = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (first.error) {
    const missing = /not found|does not exist|bucket/i.test(first.error.message);
    if (!missing) throw new Error(first.error.message);
    const created = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg"],
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }
    const retry = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (retry.error) throw new Error(retry.error.message);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

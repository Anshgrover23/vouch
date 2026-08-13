import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import sharp from "sharp";
import { resizeReceipt, storageConfigured } from "./receipt-storage";

describe("storageConfigured", () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  });

  it("is false when either env is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(storageConfigured(), false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.equal(storageConfigured(), false);
  });

  it("is true when both env vars are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
    assert.equal(storageConfigured(), true);
  });
});

describe("resizeReceipt", () => {
  it("converts an oversized PNG to a JPEG within 1800px", async () => {
    const png = await sharp({
      create: { width: 2400, height: 3200, channels: 3, background: { r: 240, g: 240, b: 230 } },
    })
      .png()
      .toBuffer();

    const { body, mime } = await resizeReceipt(png);
    const meta = await sharp(body).metadata();

    assert.equal(mime, "image/jpeg");
    assert.equal(meta.format, "jpeg");
    assert.ok((meta.width ?? 0) <= 1800);
    assert.ok((meta.height ?? 0) <= 1800);
    assert.ok(body.byteLength < png.byteLength);
  });
});

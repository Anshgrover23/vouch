import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayImageUrl, imageResponse } from "./image-response";

const proxy = "/api/documents/abc/image";

describe("displayImageUrl", () => {
  it("never returns a data URL in JSON", () => {
    assert.equal(displayImageUrl("data:image/jpeg;base64,QQ==", proxy), proxy);
  });

  it("passes through a Storage HTTPS URL", () => {
    const stored = "https://dmrnclmftexnyeqhfdik.supabase.co/storage/v1/object/public/receipts/a.jpg";
    assert.equal(displayImageUrl(stored, proxy), stored);
  });

  it("passes through local upload paths", () => {
    assert.equal(displayImageUrl("/uploads/a.jpg", proxy), "/uploads/a.jpg");
  });

  it("falls back to the proxy when empty", () => {
    assert.equal(displayImageUrl(null, proxy), proxy);
    assert.equal(displayImageUrl("", proxy), proxy);
  });

  it("returns no URL for a typed receipt so the photo pane stays empty paper", () => {
    assert.equal(displayImageUrl("typed", proxy), "");
  });
});

describe("imageResponse", () => {
  it("404s when nothing is stored", async () => {
    const res = imageResponse(null);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: "not found" });
  });

  it("serves decoded bytes for a data URL", async () => {
    const res = imageResponse("data:image/jpeg;base64,QQ==");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(Buffer.from(await res.arrayBuffer()).toString("base64"), "QQ==");
  });

  it("redirects HTTPS Storage URLs", () => {
    const res = imageResponse("https://example.com/receipts/a.jpg");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://example.com/receipts/a.jpg");
  });

  it("redirects relative upload paths", () => {
    const res = imageResponse("/uploads/a.jpg");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/uploads/a.jpg");
  });
});

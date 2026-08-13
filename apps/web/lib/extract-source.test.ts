import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { interfazeImageSource } from "./extract-source";

describe("interfazeImageSource", () => {
  it("passes a public HTTPS Storage URL through unchanged", async () => {
    const url = "https://dmrnclmftexnyeqhfdik.supabase.co/storage/v1/object/public/receipts/a.jpg";
    assert.equal(await interfazeImageSource(url, "image/jpeg"), url);
  });

  it("passes data URLs through for local fallback", async () => {
    const data = "data:image/jpeg;base64,QQ==";
    assert.equal(await interfazeImageSource(data, "image/jpeg"), data);
  });
});

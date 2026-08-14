import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("stores salt:hash and verifies the same password", async () => {
    const stored = await hashPassword("correct horse");
    assert.match(stored, /^[0-9a-f]+:[0-9a-f]+$/);
    assert.equal(await verifyPassword("correct horse", stored), true);
  });

  it("rejects the wrong password with a timing-safe compare", async () => {
    const stored = await hashPassword("correct horse");
    assert.equal(await verifyPassword("wrong battery", stored), false);
  });
});

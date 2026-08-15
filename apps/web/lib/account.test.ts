import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUniqueViolation } from "./account";

describe("isUniqueViolation", () => {
  it("detects Postgres 23505 on the error or its cause", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ cause: { code: "23505" } }), true);
    assert.equal(isUniqueViolation({ code: "23503" }), false);
    assert.equal(isUniqueViolation(new Error("failed")), false);
  });
});

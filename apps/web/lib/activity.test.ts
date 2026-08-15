import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activityCopy } from "./activity-copy";

describe("activityCopy", () => {
  it("says vouched an item, not a line, and uses the item name when we have it", () => {
    assert.equal(
      activityCopy({ actorName: "Ansh", action: "claimed", detail: {} }),
      "Ansh vouched an item",
    );
    assert.equal(
      activityCopy({ actorName: "Ansh", action: "claimed", detail: { item: "Oat milk" } }),
      "Ansh vouched Oat milk",
    );
  });
});

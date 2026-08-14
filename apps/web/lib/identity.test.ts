import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renameBlockedBy } from "./identity";

describe("renameBlockedBy", () => {
  it("lets a person rename without creating a ghost identity", () => {
    assert.equal(renameBlockedBy("Ansh", "Ansh-grover", ["Ansh", "Goru"]), null);
  });

  it("blocks taking a name that is already on the split", () => {
    assert.equal(renameBlockedBy("Goru", "Ansh", ["Ansh", "Goru"]), "That name is already on this split.");
  });

  it("does nothing when the name did not change", () => {
    assert.equal(renameBlockedBy("Ansh", "Ansh", ["Ansh"]), null);
  });
});

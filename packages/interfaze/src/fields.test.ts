import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findLine, flattenExtracted, usableText } from "./fields";

describe("usableText", () => {
  it("drops literal nulls that models sometimes emit", () => {
    assert.equal(usableText(null), "");
    assert.equal(usableText("null"), "");
    assert.equal(usableText("N/A"), "");
    assert.equal(usableText("  Hillcrest  "), "Hillcrest");
  });
});

describe("flattenExtracted", () => {
  it("keeps header fields and numbered line items", () => {
    const rows = flattenExtracted({
      merchant: "Hillcrest Market",
      date: "2026-08-13",
      total: "12.50",
      items: [
        { name: "Milk", price: "4.00" },
        { name: "null", price: "n/a" },
        { description: "Eggs", amount: "3.50" },
      ],
    });
    assert.deepEqual(
      rows.map((row) => `${row.key}:${row.value}`),
      ["merchant:Hillcrest Market", "date:2026-08-13", "total:12.50", "item_1:4.00", "item_3:3.50"],
    );
  });
});

describe("findLine", () => {
  it("matches an OCR line to an extracted value", () => {
    const line = findLine(
      {
        sections: [
          {
            lines: [{ text: "MILK 4.00", average_confidence: 0.97 }],
          },
        ],
      },
      "4.00",
    );
    assert.equal(line?.average_confidence, 0.97);
  });
});

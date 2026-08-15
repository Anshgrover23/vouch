import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findLine, flattenExtracted, moneyOnly, usableText } from "./fields";

describe("usableText", () => {
  it("drops literal nulls that models sometimes emit", () => {
    assert.equal(usableText(null), "");
    assert.equal(usableText("null"), "");
    assert.equal(usableText("N/A"), "");
    assert.equal(usableText("  Hillcrest  "), "Hillcrest");
  });
});

describe("moneyOnly", () => {
  it("strips a trailing POS tax flag without a polynomial whitespace regex", () => {
    assert.equal(moneyOnly("$3.52T2"), "$3.52");
    assert.equal(moneyOnly("$3.52 T2"), "$3.52");
    assert.equal(moneyOnly("  $2.96T2  "), "$2.96");
    assert.equal(moneyOnly("6.61"), "6.61");
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
      ["merchant:Hillcrest Market", "date:2026-08-13", "item_1:4.00", "item_3:3.50", "total:12.50"],
    );
  });

  it("keeps Interfaze currency as a header field", () => {
    const rows = flattenExtracted({
      merchant: "Namo Tandoori Chai",
      date: "16/08/26",
      currency: "INR",
      items: [{ name: "Masala Chai", price: "120.00" }],
      total: "265.00",
    });
    assert.deepEqual(
      rows.map((row) => `${row.key}:${row.value}`),
      [
        "merchant:Namo Tandoori Chai",
        "date:16/08/26",
        "currency:INR",
        "item_1:120.00",
        "total:265.00",
      ],
    );
  });

  it("keeps Interfaze subtotal and tax as their own fields", () => {
    const rows = flattenExtracted({
      merchant: "CASHIERS FARMERS MARKET",
      date: "07-23-2021",
      items: [
        { name: "PRODUCE", price: "$3.52" },
        { name: "PRODUCE", price: "$2.96" },
      ],
      subtotal: "$6.48",
      tax: "$0.13",
      total: "$6.61",
    });
    assert.deepEqual(
      rows.map((row) => `${row.key}:${row.value}`),
      [
        "merchant:CASHIERS FARMERS MARKET",
        "date:07-23-2021",
        "item_1:$3.52",
        "item_2:$2.96",
        "subtotal:$6.48",
        "tax:$0.13",
        "total:$6.61",
      ],
    );
  });

  it("strips POS tax codes from Interfaze prices", () => {
    const rows = flattenExtracted({
      merchant: "CASHIERS FARMERS MARKET",
      total: "$6.61",
      items: [
        { name: "PRODUCE", price: "$3.52T2" },
        { name: "PRODUCE", price: "$2.96T2" },
      ],
    });
    assert.deepEqual(
      rows.map((row) => `${row.key}:${row.label}:${row.value}`),
      [
        "merchant:Merchant:CASHIERS FARMERS MARKET",
        "item_1:PRODUCE:$3.52",
        "item_2:PRODUCE:$2.96",
        "total:Total:$6.61",
      ],
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateIssue, lineIssues, manualFieldRows, merchantIssue, sanitizeManualReceipt, totalIssue } from "./manual-receipt";

describe("sanitizeManualReceipt", () => {
  it("keeps merchant, date, total, and priced lines", () => {
    const result = sanitizeManualReceipt({
      merchant: "  Corner Deli ",
      date: "14 Aug 2026",
      total: "$12.50",
      items: [
        { name: "Coffee", price: "4.50" },
        { name: "  ", price: "" },
        { name: "Bagel", price: "8" },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value, {
      merchant: "Corner Deli",
      date: "14 Aug 2026",
      total: "12.50",
      items: [
        { name: "Coffee", price: "4.50" },
        { name: "Bagel", price: "8.00" },
      ],
      slug: "grocery-receipt",
      title: "Corner Deli",
    });
  });

  it("rejects a missing merchant or a non-money total", () => {
    const missing = sanitizeManualReceipt({ total: "12.50" });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.error, "Name the merchant.");
    const badTotal = sanitizeManualReceipt({ merchant: "Deli", total: "twelve" });
    assert.equal(badTotal.ok, false);
    if (!badTotal.ok) assert.equal(badTotal.error, "Enter a receipt total like 12.50.");
  });

  it("accepts merchant and total with no date and no lines", () => {
    const result = sanitizeManualReceipt({ merchant: "Corner Deli", total: "12.50" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.date, "");
    assert.deepEqual(result.value.items, []);
  });

  it("rejects a named line without a price", () => {
    const result = sanitizeManualReceipt({
      merchant: "Corner Deli",
      total: "4.50",
      items: [{ name: "Coffee", price: "nope" }],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /price/i);
  });

  it("names an unnamed priced line Item N", () => {
    const result = sanitizeManualReceipt({
      merchant: "Corner Deli",
      total: "4.50",
      items: [{ price: "4.50" }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.value.items, [{ name: "Item 1", price: "4.50" }]);
  });
});

describe("manual receipt field issues", () => {
  it("requires merchant and total, not date or empty lines", () => {
    assert.equal(merchantIssue(""), "Name the merchant.");
    assert.equal(dateIssue(""), null);
    assert.equal(totalIssue(""), "Enter a receipt total like 12.50.");
    assert.deepEqual(lineIssues({ name: "", price: "" }, 0), { name: null, price: null });
    assert.equal(lineIssues({ name: "Coffee", price: "" }, 0).price, "Enter a price like 4.50 for line 1.");
  });
});

describe("manualFieldRows", () => {
  it("writes merchant, items as item_N, then total", () => {
    const result = sanitizeManualReceipt({
      merchant: "Corner Deli",
      date: "14 Aug 2026",
      total: "12.50",
      items: [{ name: "Coffee", price: "4.50" }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      manualFieldRows(result.value).map((row) => `${row.key}:${row.label}:${row.modelValue}`),
      ["merchant:Merchant:Corner Deli", "date:Date:14 Aug 2026", "item_1:Coffee:4.50", "total:Total:12.50"],
    );
  });
});

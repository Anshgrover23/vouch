import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldsFromOcr, parseReceiptObject, receiptParseTrusted, receiptParseUseful } from "./receipt-ocr";

const FAMILY_MART = `24/7 FAMILY MART
7115 Paseo del Norte, Carlsbad, CA 92011
(780) 248-8970
Order Number: 0240 Cashier: 12
DATE: 06/08/2022 SUN TIME 18:43
Item Rate Quantity Subtotal
Chicken Wings Packet 2.5kg 9.98
Cigar Cubana 35.00
Peanut Butter Jar 500g 4.03
Coffee Nescafe 500g 11.56
41 11.56
6 4 99 12
TOTAL 423.25`;

describe("parseReceiptObject", () => {
  it("reads merchant, date, lines, and total from a grocery receipt", () => {
    const object = parseReceiptObject(`HILLCREST MARKET
123 Oak St
AUG 13 2026
MILK 4.00
EGGS 3.50
TAX 0.80
TOTAL 8.30`);
    assert.equal(object.merchant, "HILLCREST MARKET");
    assert.equal(object.date, "AUG 13 2026");
    assert.equal(object.total, "8.30");
    assert.deepEqual(object.items, [
      { name: "MILK", price: "4.00" },
      { name: "EGGS", price: "3.50" },
    ]);
    assert.equal(receiptParseTrusted(object), true);
  });

  it("keeps a gap between a junk line and the receipt total", () => {
    const object = parseReceiptObject(`Hostinger
How likely are you to recommend Hostinger
Refer & earn up to 20
Total 180`);
    assert.equal(object.total, "180.00");
    assert.equal(object.items[0]?.price, "20.00");
    assert.equal(receiptParseUseful(object), true);
  });

  it("skips phone, order number, cashier, and digit-only crumbs on a Family Mart receipt", () => {
    const object = parseReceiptObject(FAMILY_MART);
    assert.match(object.merchant, /FAMILY MART/i);
    assert.equal(object.total, "423.25");
    assert.ok(object.items.some((item) => /Coffee Nescafe/i.test(item.name) && item.price === "11.56"));
    assert.equal(
      object.items.find((item) => /phone|780|order|cashier|^41$|6 4 99/i.test(item.name)),
      undefined,
    );
    assert.equal(
      object.items.some((item) => item.price === "8970.00" || item.price === "12.00"),
      false,
    );
    assert.equal(receiptParseTrusted(object), true);
  });
});

describe("fieldsFromOcr", () => {
  it("flattens numbered line items with bounds from OCR lines", () => {
    const fields = fieldsFromOcr("ignored", {
      sections: [
        {
          lines: [
            { text: "HILLCREST MARKET", average_confidence: 0.99 },
            { text: "MILK 4.00", average_confidence: 0.97 },
            { text: "TOTAL 4.00", average_confidence: 0.98 },
          ],
        },
      ],
    });
    assert.deepEqual(
      fields.map((row) => `${row.key}:${row.value}`),
      ["merchant:HILLCREST MARKET", "total:4.00", "item_1:4.00"],
    );
  });

  it("returns nothing when the image is not a receipt", () => {
    assert.deepEqual(fieldsFromOcr("Settings\nNotifications\nPrivacy"), []);
  });
});

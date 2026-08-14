import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groceryFields } from "@proofsheet/interfaze";
import {
  exportReceiptRows,
  groupTotals,
  personNets,
  receiptsCsv,
  suggestedReimbursements,
  type LedgerReceipt,
} from "./ledger";
import type { SplitClaim, SplitField } from "./split";

function field(partial: Partial<SplitField> & Pick<SplitField, "key" | "label">): SplitField {
  return {
    id: partial.id ?? partial.key,
    modelValue: partial.modelValue ?? null,
    humanValue: partial.humanValue ?? null,
    ...partial,
  };
}

function hillcrest(paidByName: string, claims: SplitClaim[]): LedgerReceipt {
  const rows = groceryFields.map((row) =>
    field({ id: row.key, key: row.key, label: row.label, modelValue: row.value }),
  );
  rows.push(
    field({
      id: "remainder",
      key: "remainder",
      label: "Rest of the bill",
      modelValue: "9.57",
    }),
  );
  return { id: "hillcrest", title: "Hillcrest", paidByName, fields: rows, claims };
}

describe("personNets", () => {
  it("credits the payer only for claimed lines; unclaimed remainder stays off the books", () => {
    const nets = personNets([
      hillcrest("Ansh", [{ fieldId: "item_6", displayName: "Goru", stance: "owe" }]),
    ]);
    assert.deepEqual(nets, [
      { name: "Ansh", net: 8.91 },
      { name: "Goru", net: -8.91 },
    ]);
  });

  it("split equally splits the claimed line and still ignores unclaimed items", () => {
    const nets = personNets([
      hillcrest("Ansh", [
        { fieldId: "item_3", displayName: "Ansh", stance: "owe" },
        { fieldId: "item_3", displayName: "Goru", stance: "owe" },
      ]),
    ]);
    assert.deepEqual(nets, [
      { name: "Ansh", net: 2.65 },
      { name: "Goru", net: -2.65 },
    ]);
  });

  it("settlements reverse the pairwise debt", () => {
    const receipts = [hillcrest("Ansh", [{ fieldId: "item_6", displayName: "Goru", stance: "owe" }])];
    const settled = personNets(receipts, [{ fromName: "Goru", toName: "Ansh", amount: 8.91 }]);
    assert.deepEqual(settled, []);
  });
});

describe("suggestedReimbursements", () => {
  it("asks the debtor to pay the creditor", () => {
    const suggested = suggestedReimbursements(
      personNets([hillcrest("Ansh", [{ fieldId: "item_6", displayName: "Goru", stance: "owe" }])]),
    );
    assert.deepEqual(suggested, [{ from: "Goru", to: "Ansh", amount: 8.91 }]);
  });

  it("leaves nothing to suggest after the suggestions are booked", () => {
    const receipts = [hillcrest("Ansh", [{ fieldId: "item_6", displayName: "Goru", stance: "owe" }])];
    const suggested = suggestedReimbursements(personNets(receipts));
    const after = personNets(
      receipts,
      suggested.map((row) => ({ fromName: row.from, toName: row.to, amount: row.amount })),
    );
    assert.deepEqual(after, []);
    assert.deepEqual(suggestedReimbursements(after), []);
  });
});

describe("groupTotals", () => {
  it("ignores settlements when counting group spending (Spliit rule)", () => {
    const receipts = [
      hillcrest("Ansh", [{ fieldId: "item_6", displayName: "Goru", stance: "owe" }]),
      {
        paidByName: "Goru",
        fields: [
          field({ key: "merchant", label: "Merchant", modelValue: "Corner Deli" }),
          field({ key: "total", label: "Total", modelValue: "12.00" }),
          field({ id: "item_1", key: "item_1", label: "Coffee", modelValue: "12.00" }),
        ],
        claims: [{ fieldId: "item_1", displayName: "Ansh", stance: "owe" }],
      },
    ];
    const totals = groupTotals(receipts, "Ansh");
    assert.equal(totals.groupSpending, 96.2);
    assert.equal(totals.youPaid, 84.2);
    assert.equal(totals.yourShare, 12);
  });
});

describe("CSV export", () => {
  it("emits merchant, date, total, paid by, and per-person shares", () => {
    const receipts = [hillcrest("Ansh", [{ fieldId: "item_6", displayName: "Goru", stance: "owe" }])];
    const { headers, rows } = exportReceiptRows(receipts, ["Ansh", "Goru"]);
    assert.deepEqual(headers, ["Merchant", "Date", "Total", "Paid by", "Ansh", "Goru"]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0][0], "HILLCREST MARKET");
    assert.equal(rows[0][2], "84.20");
    assert.equal(rows[0][3], "Ansh");
    assert.equal(rows[0][4], "");
    assert.equal(rows[0][5], "8.91");
    assert.match(receiptsCsv(receipts, ["Ansh", "Goru"]), /^Merchant,Date,Total,Paid by,Ansh,Goru\n/);
  });
});

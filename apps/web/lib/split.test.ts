import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GROCERY_ITEMS_SUM,
  GROCERY_LINE_ITEMS,
  GROCERY_REMAINDER,
  GROCERY_TOTAL,
  groceryFields,
} from "@proofsheet/interfaze";
import {
  assignedTotal,
  computedReceiptTotal,
  formatMoney,
  isClaimableKey,
  isMoneyEditKey,
  lineShare,
  moneyInputText,
  partitionReceiptFields,
  personShares,
  remainderGap,
  roundMoney,
  splitBalance,
  type SplitClaim,
  type SplitField,
} from "./split";

function field(partial: Partial<SplitField> & Pick<SplitField, "key" | "label">): SplitField {
  return {
    id: partial.id ?? partial.key,
    modelValue: partial.modelValue ?? null,
    humanValue: partial.humanValue ?? null,
    ...partial,
  };
}

function hillcrest(): SplitField[] {
  const rows = groceryFields.map((row) =>
    field({ id: row.key, key: row.key, label: row.label, modelValue: row.value }),
  );
  rows.push(
    field({
      id: "remainder",
      key: "remainder",
      label: "Rest of the bill",
      modelValue: GROCERY_REMAINDER.toFixed(2),
    }),
  );
  return rows;
}

describe("Hillcrest fixture", () => {
  it("leaves $9.57 as rest of the bill after the eight grocery lines", () => {
    const fields = hillcrest();
    assert.equal(remainderGap(fields.filter((row) => row.key !== "remainder")), GROCERY_REMAINDER);
    assert.equal(roundMoney(Number(GROCERY_TOTAL) - GROCERY_ITEMS_SUM), GROCERY_REMAINDER);
    assert.equal((Number(GROCERY_TOTAL) - GROCERY_ITEMS_SUM).toFixed(2), GROCERY_REMAINDER.toFixed(2));
    assert.equal(isMoneyEditKey("merchant"), false);
    assert.equal(isMoneyEditKey("date"), false);
    assert.equal(isMoneyEditKey("total"), false);
    assert.equal(isMoneyEditKey("remainder"), false);
    assert.equal(isMoneyEditKey("item_3"), true);
    assert.equal(isMoneyEditKey("tax"), true);
    assert.equal(isMoneyEditKey("subtotal"), false);
    assert.equal(isClaimableKey("merchant"), false);
    assert.equal(isClaimableKey("item_3"), true);
    assert.equal(isClaimableKey("tax"), true);
    assert.equal(isClaimableKey("tip"), true);
    assert.equal(isClaimableKey("subtotal"), false);
    assert.equal(isClaimableKey("remainder"), true);
    const mixed = [
      fields.find((row) => row.key === "item_8")!,
      fields.find((row) => row.key === "date")!,
      fields.find((row) => row.key === "item_4")!,
      fields.find((row) => row.key === "total")!,
      fields.find((row) => row.key === "merchant")!,
      fields.find((row) => row.key === "remainder")!,
    ];
    const { header, items, footer } = partitionReceiptFields(mixed);
    assert.deepEqual(
      header.map((row) => row.key),
      ["merchant", "date"],
    );
    assert.deepEqual(
      items.map((row) => row.key),
      ["item_8", "item_4"],
    );
    assert.deepEqual(
      footer.map((row) => row.key),
      ["total", "remainder"],
    );
  });

  it("gives Ansh the full Oat milk line, not a silent half", () => {
    const fields = hillcrest();
    const oat = fields.find((row) => row.key === "item_3")!;
    assert.equal(oat.modelValue, GROCERY_LINE_ITEMS[2].price);
    const claims: SplitClaim[] = [{ fieldId: oat.id!, displayName: "Ansh", stance: "owe" }];
    const people = personShares(fields, claims);
    assert.deepEqual(
      people.map((person) => `${person.name}:${person.total}`),
      ["Ansh:5.29"],
    );
    assert.equal(people[0]?.lines[0]?.share, 5.29);
    assert.equal(splitBalance(fields, claims).open, roundMoney(Number(GROCERY_TOTAL) - 5.29));
    assert.equal(splitBalance(fields, claims).open.toFixed(2), "78.91");
  });

  it("shows both people when Goru takes Eggs and Ansh keeps Oat milk", () => {
    const fields = hillcrest();
    const oat = fields.find((row) => row.key === "item_3")!;
    const eggs = fields.find((row) => row.key === "item_6")!;
    assert.equal(eggs.modelValue, GROCERY_LINE_ITEMS[5].price);
    const claims: SplitClaim[] = [
      { fieldId: oat.id!, displayName: "Ansh", stance: "owe" },
      { fieldId: eggs.id!, displayName: "Goru", stance: "owe" },
    ];
    const people = personShares(fields, claims);
    assert.deepEqual(
      people.map((person) => `${person.name}:${person.total}`),
      ["Ansh:5.29", "Goru:8.91"],
    );
    assert.equal(people.length, 2);
  });

  it("splits Oat milk equally only when two people owe that line", () => {
    const fields = hillcrest();
    const oat = fields.find((row) => row.key === "item_3")!;
    const claims: SplitClaim[] = [
      { fieldId: oat.id!, displayName: "Ansh", stance: "owe" },
      { fieldId: oat.id!, displayName: "Goru", stance: "owe" },
    ];
    const share = lineShare(oat.modelValue ?? "", claims, oat.id!);
    assert.equal(share?.split, true);
    assert.equal(share?.each, 2.65);
    const people = personShares(fields, claims);
    assert.equal(people.find((p) => p.name === "Ansh")?.total, 2.65);
    assert.equal(people.find((p) => p.name === "Goru")?.total, 2.65);
  });

  it("keeps remainder open until someone claims it", () => {
    const fields = hillcrest();
    const oat = fields.find((row) => row.key === "item_3")!;
    const claims: SplitClaim[] = [{ fieldId: oat.id!, displayName: "Ansh", stance: "owe" }];
    const { leftover, leftoverSum } = splitBalance(fields, claims);
    assert.ok(leftover.some((row) => row.key === "remainder"));
    assert.equal(leftover.find((row) => row.key === "remainder")?.modelValue, "9.57");
    assert.ok(leftoverSum >= GROCERY_REMAINDER);
  });

  it("renames Ansh without minting a third person", () => {
    const fields = hillcrest();
    const oat = fields.find((row) => row.key === "item_3")!;
    const eggs = fields.find((row) => row.key === "item_6")!;
    const claims: SplitClaim[] = [
      { fieldId: oat.id!, displayName: "Ansh-grover", stance: "owe" },
      { fieldId: eggs.id!, displayName: "Goru", stance: "owe" },
    ];
    const people = personShares(fields, claims);
    assert.equal(people.length, 2);
    assert.deepEqual(
      people.map((person) => person.name),
      ["Ansh-grover", "Goru"],
    );
  });
});

describe("computedReceiptTotal", () => {
  it("sums visible items plus tax", () => {
    const fields = [
      field({ key: "item_1", label: "Milk", modelValue: "10.00" }),
      field({ key: "item_2", label: "Bread", modelValue: "20.00" }),
      field({ key: "tax", label: "Tax", modelValue: "1.50" }),
      field({ key: "total", label: "Total", modelValue: "999.00" }),
    ];
    assert.equal(computedReceiptTotal(fields), 31.5);
  });

  it("excludes ignored lines", () => {
    const fields = [
      field({ key: "item_1", label: "Milk", modelValue: "10.00" }),
      {
        ...field({ key: "item_2", label: "Bread", modelValue: "20.00" }),
        status: "ignored",
      },
      field({ key: "tax", label: "Tax", modelValue: "1.50" }),
      field({ key: "tip", label: "Tip", modelValue: "3.00" }),
    ];
    assert.equal(computedReceiptTotal(fields), 14.5);
  });

  it("rounds cents instead of drifting", () => {
    const fields = [
      field({ key: "item_1", label: "A", modelValue: "0.10" }),
      field({ key: "item_2", label: "B", modelValue: "0.20" }),
    ];
    assert.equal(computedReceiptTotal(fields), 0.3);
  });

  it("returns null when there are no grocery item rows", () => {
    const fields = [
      field({ key: "amount", label: "Amount", modelValue: "42.00" }),
      field({ key: "recipient", label: "To", modelValue: "Jordan" }),
    ];
    assert.equal(computedReceiptTotal(fields), null);
  });
});

describe("formatMoney", () => {
  it("does not prefix a second dollar sign when OCR already attached $", () => {
    assert.equal(formatMoney("$92.77"), "$92.77");
    assert.equal(formatMoney("$$92.7"), "$92.70");
    assert.equal(formatMoney("92.77"), "$92.77");
    assert.equal(moneyInputText("$92.77"), "92.77");
    assert.equal(moneyInputText("$$92.7"), "92.7");
    assert.equal(moneyInputText("92.77"), "92.77");
  });
});

describe("remainderGap", () => {
  it("is the receipt total minus claimed line items, not the header total", () => {
    const fields = [
      field({ key: "total", label: "Total", modelValue: "180" }),
      field({ key: "item_1", label: "Refer & earn up to", modelValue: "20" }),
    ];
    assert.equal(remainderGap(fields), 160);
    assert.equal(isClaimableKey("total"), false);
    assert.equal(isClaimableKey("remainder"), true);
  });

  it("does not treat printed tax as unnamed rest of the bill", () => {
    const fields = [
      field({ key: "item_1", label: "PRODUCE", modelValue: "3.52" }),
      field({ key: "item_2", label: "PRODUCE", modelValue: "2.96" }),
      field({ key: "subtotal", label: "Subtotal", modelValue: "6.48" }),
      field({ key: "tax", label: "Tax", modelValue: "0.13" }),
      field({ key: "total", label: "Total", modelValue: "6.61" }),
    ];
    assert.equal(remainderGap(fields), 0);
    const { header, items, footer } = partitionReceiptFields(fields);
    assert.deepEqual(
      header.map((row) => row.key),
      [],
    );
    assert.deepEqual(
      items.map((row) => row.key),
      ["item_1", "item_2"],
    );
    assert.deepEqual(
      footer.map((row) => row.key),
      ["subtotal", "tax", "total"],
    );
  });
});

describe("personShares", () => {
  it("shows every person on the shared ledger, not just the viewer", () => {
    const fields = [
      field({ id: "total", key: "total", label: "Total", modelValue: "180" }),
      field({ id: "item", key: "item_1", label: "Snacks", modelValue: "20" }),
      field({ id: "rest", key: "remainder", label: "Rest of the bill", modelValue: "160" }),
    ];
    const claims: SplitClaim[] = [
      { fieldId: "rest", displayName: "Ansh", stance: "owe" },
      { fieldId: "item", displayName: "Rio", stance: "owe" },
    ];
    const people = personShares(fields, claims);
    assert.deepEqual(
      people.map((person) => `${person.name}:${person.total}`),
      ["Ansh:160", "Rio:20"],
    );
    assert.equal(assignedTotal(fields, claims), 180);
    assert.equal(splitBalance(fields, claims).status, "settled");
  });

  it("gives the full line to one person who tapped I owe this", () => {
    const fields = [field({ id: "item", key: "item_1", label: "Snacks", modelValue: "60" })];
    const claims: SplitClaim[] = [{ fieldId: "item", displayName: "Goru", stance: "owe" }];
    const people = personShares(fields, claims);
    assert.equal(people.length, 1);
    assert.equal(people[0]?.name, "Goru");
    assert.equal(people[0]?.total, 60);
  });
});
